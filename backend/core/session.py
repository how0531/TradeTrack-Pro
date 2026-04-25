import shioaji as sj
import os
import threading
from datetime import datetime
from threading import Lock

# Global Session Manager Instance
_SESSION_MANAGER = None
_SINGLETON_LOCK = Lock()  # B1: 保護 singleton 建立避免 race condition

# CA 啟動有效期（秒）：從 0 改為 1800，避免頻繁重複啟動 CA 導致 Shioaji 底層狀態異常 (PnL 回傳空值)
_CA_EXPIRY_SECONDS = 1800 

class ShioajiSessionManager:
    def __init__(self):
        self.api = None
        self.current_person_id = None
        self.current_api_key_suffix = None  # Store last 6 chars for validation
        self.last_used_time = None
        self.is_simulation = True
        self.ca_activated = False
        self.ca_activated_time = None  # 記錄 CA 最後啟動時間
        self._lock = Lock()

    def get_api(
        self, api_key, secret_key, person_id, ca_path, ca_password, simulation=True,
        fetch_contract=False,
    ):
        """
        Get an active API instance. Reused if possible, otherwise create new.
        Always ensures CA is activated when a valid path is provided.

        fetch_contract:
          False (default) — for PnL / profile / list_accounts paths.
            list_profit_loss / margin / list_positions don't need contract data;
            skipping the contract download saves ~200MB on Render free tier
            (was the trigger for OOM crashes pre-v3.3.1).
          True — only when api.Contracts.Stocks is needed (e.g. simulated
            order placement in verify_simulation_account).

        If a cached session exists with fetch_contract=False but a True is
        requested, we drop and re-login to ensure contracts are loaded.
        """
        # Comparison key (suffix)
        key_suffix = api_key[-6:] if api_key and len(api_key) > 6 else api_key

        with self._lock:
            # 1. Double check under lock if we can reuse the existing session.
            #    If contracts are now needed but the cached session was created
            #    without them, force a fresh login.
            cached_has_contracts = getattr(self, "_cached_with_contracts", False)
            if (
                self.api
                and self.current_person_id == person_id
                and self.current_api_key_suffix == key_suffix
                and self.is_simulation == simulation
                and (not fetch_contract or cached_has_contracts)
            ):
                # 快速存活檢查：如果最近 60 秒內有使用過，跳過健康檢查
                if self.last_used_time:
                    idle_seconds = (datetime.now() - self.last_used_time).total_seconds()
                    if idle_seconds < 60:
                        print(
                            f"DEBUG: [SessionReuse] Reusing connection (idle {idle_seconds:.0f}s < 60s, skip health check)",
                            flush=True,
                        )
                        self.last_used_time = datetime.now()
                        return self.api

                # B4: 健康檢查加 timeout，防止 Shioaji 卡住導致 Lock deadlock
                health_ok = [False]
                def _health_check():
                    try:
                        self.api.list_accounts()
                        health_ok[0] = True
                    except Exception:
                        pass
                ht = threading.Thread(target=_health_check, daemon=True)
                ht.start()
                ht.join(timeout=5)

                if health_ok[0]:
                    print(
                        f"DEBUG: [SessionReuse] Reusing existing connection for {person_id} (health OK)",
                        flush=True,
                    )
                    self.last_used_time = datetime.now()
                    return self.api
                else:
                    reason = "timed out (5s)" if ht.is_alive() else "failed"
                    print(
                        f"WARNING: [SessionReuse] Health check {reason}. Will reconnect.",
                        flush=True,
                    )
                    self._safe_logout()
                    self.api = None
                    self.ca_activated = False
                    self.ca_activated_time = None

            # 2. If valid session exists but credentials changed, drop old session
            if self.api:
                print(
                    f"DEBUG: [Session] Dropping old session to avoid deadlock. Credentials changed.",
                    flush=True,
                )
                self._safe_logout()
                self.api = None
                self.ca_activated = False
                self.ca_activated_time = None

            # 3. Create new connection with timeout protection
            print(
                f"DEBUG: [SessionReuse] Creating NEW connection for {person_id} (Sim={simulation})",
                flush=True,
            )
            new_api = sj.Shioaji(simulation=simulation)

            # Login with timeout
            login_result = [None]
            login_error = [None]
            def _do_login():
                try:
                    login_result[0] = new_api.login(
                        api_key=api_key,
                        secret_key=secret_key,
                        fetch_contract=fetch_contract,  # default False — saves ~200MB on free tier
                    )
                except Exception as e:
                    login_error[0] = e

            login_thread = threading.Thread(target=_do_login, daemon=True)
            login_thread.start()
            login_thread.join(timeout=30)

            if login_thread.is_alive():
                print("ERROR: [Session] Login timed out after 30 seconds!", flush=True)
                # B2: 嘗試釋放殭屍連線，避免撞 Shioaji 5 連線上限
                try:
                    new_api.logout()
                    print("DEBUG: [Session] Zombie connection cleaned up after timeout.", flush=True)
                except Exception:
                    pass
                raise TimeoutError("Shioaji login 超時 (30秒)，請檢查網路連線或稍後重試。")

            if login_error[0]:
                raise login_error[0]

            accounts = login_result[0]
            print(f"DEBUG: Login successful. Found {len(accounts)} account(s).", flush=True)

            self._try_activate_ca(new_api, ca_path, ca_password, person_id)

            self.api = new_api
            self.current_person_id = person_id
            self.current_api_key_suffix = key_suffix
            self.is_simulation = simulation
            self.last_used_time = datetime.now()
            self._cached_with_contracts = fetch_contract

            return self.api

    def ensure_ca_active(self, ca_path, ca_password, person_id, force=False):
        """
        每次 PnL 查詢前必須呼叫。確保 CA 處於活躍狀態。
        - force=True  → 無條件重新啟動（PnL 查詢時使用，避免 Shioaji 內部狀態失效卻被快取遮蔽）
        - force=False → 只在從未啟動或超過有效期時才重新啟動
        回傳 True 表示 CA 已啟動，False 表示啟動失敗。
        """
        if not self.api:
            print("WARNING: [CA] No API session, cannot activate CA.", flush=True)
            return False

        # 判斷是否需要重新啟動
        needs_activation = force
        reason = "強制重新啟動 (PnL 查詢前)" if force else ""

        if not force:
            if not self.ca_activated:
                needs_activation = True
                reason = "CA 從未成功啟動"
            elif self.ca_activated_time:
                elapsed = (datetime.now() - self.ca_activated_time).total_seconds()
                if elapsed > _CA_EXPIRY_SECONDS:
                    needs_activation = True
                    reason = f"CA 已超過 {_CA_EXPIRY_SECONDS // 60} 分鐘有效期"

        if needs_activation:
            print(f"DEBUG: [CA] 重新啟動原因: {reason}", flush=True)
            self._try_activate_ca(self.api, ca_path, ca_password, person_id)

        return self.ca_activated

    def _try_activate_ca(self, api, ca_path, ca_password, person_id):
        """
        Attempt CA activation. Updates self.ca_activated on success.
        B3: Returns True on success, False on failure/skip.
        """
        if not ca_path:
            print("DEBUG: [CA] No CA path provided, skipping activation.", flush=True)
            return False
            
        if not os.path.exists(ca_path):
            print(
                f"WARNING: [CA] Path '{ca_path}' does not exist. "
                f"If using cloud deployment, ensure caContent (Base64) is uploaded via the frontend.",
                flush=True,
            )
            return False
            
        try:
            result = api.activate_ca(
                ca_path=ca_path,
                ca_passwd=ca_password,
                person_id=person_id,
            )
            # 驗證回傳值：activate_ca 成功時回傳 SystemRandom 物件 (truthy)
            # 失敗時可能回傳 False 或 None（部分版本）— 統一用 not result 判斷
            if not result:
                self.ca_activated = False
                self.ca_activated_time = None
                print(f"WARNING: [CA] ❌ activate_ca returned {result!r} — CA not activated", flush=True)
                return False
            else:
                self.ca_activated = True
                self.ca_activated_time = datetime.now()
                print(f"DEBUG: [CA] ✅ CA Activated successfully! Result type: {type(result).__name__}", flush=True)
                return True
        except Exception as e:
            self.ca_activated = False
            self.ca_activated_time = None
            print(f"WARNING: [CA] ❌ CA Activation failed: {e}", flush=True)
            return False

    def _safe_logout(self):
        """嘗試安全登出舊連線，避免撞 Shioaji 5 連線上限。"""
        if self.api:
            try:
                self.api.logout()
                print("DEBUG: [Session] Old connection logged out successfully.", flush=True)
            except Exception as e:
                print(f"DEBUG: [Session] Logout failed (non-critical): {e}", flush=True)


def get_session_manager():
    """B1: Thread-safe singleton with double-checked locking."""
    global _SESSION_MANAGER
    if _SESSION_MANAGER is None:
        with _SINGLETON_LOCK:
            if _SESSION_MANAGER is None:
                _SESSION_MANAGER = ShioajiSessionManager()
    return _SESSION_MANAGER
