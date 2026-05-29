import logging
import os
import gc
import time
import base64
import tempfile
import threading
from datetime import datetime, timedelta
from .session import get_session_manager
from .constants import BRANCH_MAP
import shioaji as sj


# ─── Shared Logger ───
# Delegate to the stdlib logger so container hosts (Render / Docker / k8s)
# can collect logs through their normal pipeline. A side file is kept for
# local-machine debugging of the long-running shioaji loop where stdout
# from a backgrounded process is hard to reach.
logger = logging.getLogger("tradetrack.backend.pnl")
_LOG_FILE = os.path.join(os.path.expanduser("~"), "debug_backend.log")


def _log(msg):
    try:
        with open(_LOG_FILE, "a", encoding="utf-8") as f:
            f.write(f"[{datetime.now()}] {msg}\n")
    except Exception:
        # Local file logging is best-effort — never block the request.
        pass
    logger.info(msg)


def _rss_mb():
    """目前 process 的 RSS 記憶體用量 (MB)；用於 Render free tier 512MB OOM 監控。"""
    try:
        with open("/proc/self/status") as f:
            for line in f:
                if line.startswith("VmRSS:"):
                    return int(line.split()[1]) / 1024
    except Exception:
        pass
    return -1


class _Stage:
    """以 with block 量測一段流程耗時 + 結束後 RSS，輸出到 log。

    使用：
        with _Stage("login"):
            ...

    會在進入時印 [STAGE] login start (rss=NMB)、結束時印
    [STAGE] login done in X.XXs (rss=NMB).
    """
    def __init__(self, name: str):
        self.name = name
        self.t0 = 0.0

    def __enter__(self):
        self.t0 = time.perf_counter()
        _log(f"⏱️  [STAGE] {self.name} start (rss={_rss_mb():.0f}MB)")
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        dt = time.perf_counter() - self.t0
        status = "FAIL" if exc_type else "done"
        _log(f"⏱️  [STAGE] {self.name} {status} in {dt:.2f}s (rss={_rss_mb():.0f}MB)")
        return False  # 不吃例外


# ─── Futures Contract Multiplier Lookup ───
_FUTURES_MULTIPLIERS = {
    'MTX': 50, 'MTE': 500, 'TE': 4000, 'TF': 1000,
    'T5F': 100, 'XIF': 200, 'GTF': 100, 'UNF': 200,
    'TXF': 200,  # Default for 台指期
}

_FUTURES_NAMES = {
    'TXF': '台指期', 'MTX': '小台指', 'TE': '電子期', 'MTE': '小電子期',
    'TF': '金融期', 'T5F': '櫃買期', 'UNF': '非金電期', 'GTF': '黃金期',
    'XIF': '東證期', 'SP': 'S&P期', 'ND': '那斯達克期',
}


def _resolve_futures_name(code):
    """Resolve futures contract code to Chinese name."""
    if not code or len(code) < 2:
        return ""
    upper = code.upper()
    for prefix in [upper[:3], upper[:2]]:
        if prefix in _FUTURES_NAMES:
            return _FUTURES_NAMES[prefix]
    if len(upper) > 3 and upper.endswith('O'):
        return '選擇權'
    return ""


def _get_contract_multiplier(code):
    """Get futures contract multiplier for yield calculation."""
    upper = str(code).upper()
    for prefix in [upper[:3], upper[:2]]:
        if prefix in _FUTURES_MULTIPLIERS:
            return _FUTURES_MULTIPLIERS[prefix]
    return 200  # Default


def _normalize_date(d):
    """Normalize date string to YYYY-MM-DD format."""
    d = str(d).strip()
    if len(d) == 8 and d.isdigit():  # "20250401" → "2025-04-01"
        return f"{d[:4]}-{d[4:6]}-{d[6:]}"
    return d


def _parse_item_date(raw_date):
    """Parse various date formats from Shioaji response."""
    if hasattr(raw_date, 'strftime'):
        return raw_date.strftime("%Y-%m-%d")
    item_date = str(raw_date).strip()
    if len(item_date) == 8 and item_date.isdigit():
        return f"{item_date[:4]}-{item_date[4:6]}-{item_date[6:]}"
    return item_date


# ─── Shioaji SolClient session readiness ───
# 'SessionNotEstablished' / 'NotReady' / "Unable to wait for session ... to be established"
# 是 Solace 訊息通道 (例如 (c0,s1)_sinopac) 尚未握手完成；常見於 fresh login 後立刻
# 對期貨帳號呼叫 list_profit_loss。對策：偵測到這類錯誤就退避重試，給通道時間建立。
_SESSION_RETRY_BACKOFFS = (1.5, 3.0, 6.0)  # 累積最多 10.5s


def _is_session_not_ready(err_str: str) -> bool:
    """偵測 Shioaji SolClient session 尚未建立的 transient error。"""
    if not err_str:
        return False
    compact = err_str.lower().replace(" ", "")
    if "sessionnotestablished" in compact:
        return True
    if "unabletowaitforsession" in compact:
        return True
    if "notready" in compact and "solclient" in compact:
        return True
    return False


# ─── Worker: Fetch PnL for a single account ───

def _fetch_single_account(api, target_account, start_date, end_date, ca_is_active):
    """
    Fetch PnL data for a single account. Designed to run in a thread.
    Returns: (pnl, details, equity, open_pnl, empty_reason)
    """
    acc_pnl = 0
    acc_details = []
    acc_equity = 0
    acc_open_pnl = 0
    empty_reason = None

    try:
        acc_type_str = str(getattr(target_account, "account_type", "")).upper()
        is_futures = "F" in acc_type_str or "FUTURE" in acc_type_str
        is_sub = "H" in acc_type_str
        category = "期貨" if is_futures else ("複委託" if is_sub else "台股")
        acc_id = target_account.account_id

        _log(f"🚀 [Worker] Fetching {acc_id} ({category})")

        # Skip sub-brokerage accounts
        if is_sub:
            _log(f"ℹ️ [Skip] Sub-brokerage {acc_id} not supported")
            return 0, [], 0, 0, "not_supported"

        # Futures: fetch equity & open positions (non-blocking, best-effort)
        if is_futures:
            try:
                margin_data = api.margin(target_account)
                acc_equity = int(getattr(margin_data, "equity", 0))
                positions = api.list_positions(target_account)
                for pos in positions:
                    acc_open_pnl += float(getattr(pos, "pnl", 0))
                _log(f"💰 [Futures] {acc_id} Equity={acc_equity}, OpenPnL={acc_open_pnl}")
            except Exception as me:
                _log(f"⚠️ [Futures Extra] {acc_id}: {me}")

        # Shioaji 1.3.3 quirk: list_profit_loss has different type signatures
        # depending on account type:
        #   - Stock accounts: requires datetime.date (passing str silently
        #     returns empty list — fixed in v3.1.1)
        #   - Futures accounts: requires str (passing datetime.date raises
        #     "Argument 'begin_date' has incorrect type" — discovered v3.3.3)
        # Build both forms, pass the right one per account type, and on
        # type errors swap and retry once for forward compat.
        from datetime import date as _date
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d").date() if isinstance(start_date, str) else start_date
            end_dt = datetime.strptime(end_date, "%Y-%m-%d").date() if isinstance(end_date, str) else end_date
            start_str = start_dt.strftime("%Y-%m-%d")
            end_str = end_dt.strftime("%Y-%m-%d")
        except ValueError as ve:
            _log(f"❌ [Date Error] Invalid date format: {ve}")
            return 0, [], 0, 0, f"error:日期格式錯誤，請確認日期是否為 YYYY-MM-DD 格式 ({ve})"

        def _call_pnl(chunk_start_dt, chunk_end_dt, use_str: bool):
            """單次 list_profit_loss 呼叫；接受自訂日期區間以支援 chunking。"""
            if use_str:
                return api.list_profit_loss(
                    target_account,
                    chunk_start_dt.strftime("%Y-%m-%d"),
                    chunk_end_dt.strftime("%Y-%m-%d"),
                )
            return api.list_profit_loss(target_account, chunk_start_dt, chunk_end_dt)

        # Shioaji type signature for list_profit_loss has drifted across
        # versions. Historically stock accounts wanted datetime.date and
        # futures wanted str. But Shioaji 1.3.3 rejects a date for stock
        # accounts too — "argument 'begin_date': 'date' object is not an
        # instance of 'str'" — i.e. it now wants `str` for BOTH. So we send
        # `str` by default and keep the swap-and-retry as forward/backward
        # compat for any version that flips back to wanting date.
        primary_use_str = True

        # ── Bug B 修復 (v3.7.1) ──
        # 證券帳戶 list_profit_loss 對單次呼叫的日期區間有 ~90 天上限，
        # 超過會回「Argument 'begin_date' has incorrect type」這種誤導性錯誤。
        # 將證券帳戶長區間自動切成 ≤90 天 chunks，逐段呼叫並合併結果。
        # 期貨帳戶經 v3.3.2 timing logs 驗證可單次抓完整一年，不需切。
        STOCK_PNL_MAX_DAYS = 90
        range_days = (end_dt - start_dt).days
        if not is_futures and range_days > STOCK_PNL_MAX_DAYS:
            _log(f"📅 [Chunk] {acc_id} 證券帳戶 {range_days} 天 > {STOCK_PNL_MAX_DAYS}，分段抓取")
            chunks = []
            cursor = start_dt
            while cursor <= end_dt:
                chunk_end = cursor + timedelta(days=STOCK_PNL_MAX_DAYS - 1)
                if chunk_end > end_dt:
                    chunk_end = end_dt
                chunks.append((cursor, chunk_end))
                cursor = chunk_end + timedelta(days=1)
            _log(f"📅 [Chunk] {acc_id} 分為 {len(chunks)} 段")
        else:
            chunks = [(start_dt, end_dt)]

        # 對每個 chunk 呼叫 _call_pnl，套用 type-swap fallback，並累積結果
        pnl_data = []
        for chunk_idx, (chunk_start, chunk_end) in enumerate(chunks):
            chunk_label = f"chunk {chunk_idx + 1}/{len(chunks)}" if len(chunks) > 1 else "single"
            try:
                chunk_data = _call_pnl(chunk_start, chunk_end, use_str=primary_use_str)
            except Exception as api_e:
                err_str = str(api_e)
                if "406" in err_str or "Account Not Acceptable" in err_str:
                    _log(f"ℹ️ [Skip 406] {acc_id} {chunk_label} not supported")
                    chunk_data = []
                elif any(s in err_str.lower() for s in ("incorrect type", "expected", "not an instance", "instance of")):
                    # Shioaji 改了型別簽名（1.3.3 用 "... is not an instance of
                    # 'str'" 措辭），交換型別再試一次。
                    # 注意：此分支必須在下面的 "date" 分支之前 —— 型別錯誤訊息
                    # 含 "begin_date" 會誤觸 date 分支，導致回傳誤導性的
                    # 「日期範圍無效」而非真正交換型別重試。
                    _log(f"⚠️ [Type Swap] {acc_id} {chunk_label} primary({'str' if primary_use_str else 'date'}) failed: {api_e}; retrying swapped")
                    try:
                        chunk_data = _call_pnl(chunk_start, chunk_end, use_str=not primary_use_str)
                        _log(f"✅ [Type Swap] {acc_id} {chunk_label} succeeded with {'date' if primary_use_str else 'str'}")
                    except Exception as swap_e:
                        # 兩種型別都失敗：保留兩者錯誤訊息給上層判斷
                        _log(f"❌ [Type Swap] {acc_id} {chunk_label} both failed: primary={api_e}, swapped={swap_e}")
                        return 0, [], 0, 0, f"error:Shioaji API 拒絕請求（兩種型別皆失敗，可能為日期範圍超出限制）：primary={api_e}; swapped={swap_e}"
                elif "date" in err_str.lower() or "invalid" in err_str.lower():
                    _log(f"❌ [Date Error] {acc_id} {chunk_label}: {api_e}")
                    return 0, [], 0, 0, f"error:日期範圍無效，請確認起訖日期是否正確 ({api_e})"
                elif _is_session_not_ready(err_str):
                    # Solace SolClient session 尚未握手完成 — 指數退避重試
                    _log(f"⏳ [SessionNotReady] {acc_id} {chunk_label} initial fail: {api_e}")
                    last_e = api_e
                    chunk_data = None
                    for attempt, backoff in enumerate(_SESSION_RETRY_BACKOFFS, start=1):
                        _log(f"⏳ [SessionNotReady] {acc_id} {chunk_label} sleep {backoff}s → retry #{attempt}")
                        time.sleep(backoff)
                        try:
                            chunk_data = _call_pnl(chunk_start, chunk_end, use_str=primary_use_str)
                            _log(f"✅ [SessionNotReady] {acc_id} {chunk_label} succeeded on retry #{attempt}")
                            last_e = None
                            break
                        except Exception as rt_e:
                            last_e = rt_e
                            if not _is_session_not_ready(str(rt_e)):
                                # 改變錯誤類型 → 停止 session retry，交由 last_e 處理
                                _log(f"⚠️ [SessionNotReady] {acc_id} {chunk_label} retry #{attempt} 切換錯誤類型: {rt_e}")
                                break
                    if last_e is not None:
                        if _is_session_not_ready(str(last_e)):
                            _log(f"❌ [SessionNotReady] {acc_id} {chunk_label} 重試全部失敗: {last_e}")
                            return 0, [], 0, 0, (
                                "error:永豐金期貨連線尚未就緒 (SessionNotEstablished)。"
                                f"已退避重試 {len(_SESSION_RETRY_BACKOFFS)} 次仍失敗，"
                                "請稍候 30 秒後重試；若持續發生請確認 API 是否在交易時段內開通。"
                            )
                        # session 退避途中錯誤類型變了 — 回傳新錯誤，避免誤導訊息
                        _log(f"❌ [SessionNotReady→Other] {acc_id} {chunk_label} 切換錯誤: {last_e}")
                        return 0, [], 0, 0, f"error:{last_e}"
                else:
                    # transient error → single retry
                    _log(f"⚠️ [Retry] {acc_id} {chunk_label} first attempt failed: {api_e}")
                    try:
                        chunk_data = _call_pnl(chunk_start, chunk_end, use_str=primary_use_str)
                    except Exception as retry_e:
                        _log(f"❌ [Failed] {acc_id} {chunk_label} retry also failed: {retry_e}")
                        if _is_session_not_ready(str(retry_e)):
                            return 0, [], 0, 0, (
                                "error:永豐金期貨連線尚未就緒 (SessionNotEstablished)，"
                                "請稍候 30 秒後重試。"
                            )
                        return 0, [], 0, 0, f"error:{retry_e}"

            if chunk_data:
                pnl_data.extend(chunk_data)
                if len(chunks) > 1:
                    _log(f"📊 [Chunk] {acc_id} {chunk_label} → {len(chunk_data)} 筆")

        if pnl_data is None:
            pnl_data = []
        if not pnl_data:
            empty_reason = "ca_not_activated" if not ca_is_active else "no_trades_in_range"

        _log(f"📊 [Result] {acc_id}: {len(pnl_data)} records")

        # Parse each PnL item
        for item in pnl_data:
            try:
                code = getattr(item, "code", "Unknown")
                item_date = _parse_item_date(getattr(item, "date", ""))
                raw_qty = int(getattr(item, "quantity", 0))
                realized = round(float(getattr(item, "pnl", 0)), 4)

                # Initialize
                price = 0.0
                buy_amt = 0.0
                sell_amt = 0.0
                pr_ratio_val = 0.0
                entry_price = 0.0
                exit_price = 0.0

                name = getattr(item, "name", "") or (_resolve_futures_name(code) if is_futures else "")
                display_code = name if code in name else f"{code} {name}" if name else code

                if is_futures:
                    entry_price = float(getattr(item, "entry_price", 0))
                    exit_price = float(getattr(item, "cover_price", 0))
                    price = entry_price
                    if entry_price > 0 and raw_qty > 0:
                        multiplier = _get_contract_multiplier(code)
                        denom = entry_price * raw_qty * multiplier
                        if denom > 0:
                            pr_ratio_val = round((realized / denom) * 100, 2)
                else:
                    price = round(float(getattr(item, "price", 0)), 4)
                    pr_ratio_val = round(float(getattr(item, "pr_ratio", 0)) * 100, 2)

                # Unique broker order id. Shioaji's ProfitLoss exposes a stable
                # unique `id` per realized-P&L record; `dseq`/`seqno` are often
                # EMPTY on stock rows (see scripts/simulate_pnl_logic.py
                # "Might be missing"). When orderNo ends up None the frontend
                # can't use exact-id matching and falls back to lossy
                # date+code+pnl matching, which flags distinct same-day
                # same-stock trades as "already exists". Prefer `id` so every
                # row carries a reliable unique key.
                _order_id = (
                    getattr(item, "id", None)
                    or getattr(item, "dseq", None)
                    or getattr(item, "seqno", None)
                )
                _order_id = str(_order_id) if _order_id not in (None, "", 0) else None

                acc_details.append({
                    "date": item_date,
                    "code": display_code,
                    "price": price,
                    "quantity": raw_qty,
                    "pnl": realized,
                    "orderNo": _order_id,
                    "category": category,
                    "buyAmt": buy_amt,
                    "sellAmt": sell_amt,
                    "entryPrice": entry_price,
                    "exitPrice": exit_price,
                    "yield": pr_ratio_val,
                    "accountId": acc_id,
                })
                acc_pnl += realized
            except Exception as item_e:
                _log(f"❌ [Item Error] {getattr(item, 'code', '?')}: {item_e}")
                continue

        return acc_pnl, acc_details, acc_equity, acc_open_pnl, empty_reason

    except Exception as e:
        _log(f"❌ [Worker Error] {target_account.account_id}: {e}")
        import traceback
        _log(traceback.format_exc())
        return 0, [], 0, 0, f"error:{e}"


# ─── Main: login_and_fetch_pnl ───

def login_and_fetch_pnl(
    api_key,
    secret_key,
    person_id,
    ca_path,
    ca_password,
    ca_content=None,
    start_date=None,
    end_date=None,
    simulation=True,
    branch_filter=None,
    type_filter=None,      # Kept for backwards compatibility but IGNORED
    profile_only=False,
    progress_callback=None,
):
    """
    Optimized PnL fetcher:
    - Single login for all account types (stock + futures)
    - No date chunking required — accepts any date range
    - Parallel account queries via threading
    - No redundant CA probe or sleeps
    """
    _log(f"--- START REQUEST ---")
    _log(f"Params: Sim={simulation}, PersonID={person_id}, BranchFilter={branch_filter}")

    if progress_callback:
        progress_callback(5, "環境初始化中...")

    # 1. Handle Dynamic CA
    temp_ca_path = None
    final_ca_path = ca_path

    if ca_content:
        try:
            temp_ca_path = os.path.join(tempfile.gettempdir(), f"tradetrack_ca_{person_id}.pfx")
            with open(temp_ca_path, "wb") as f:
                f.write(base64.b64decode(ca_content))
            final_ca_path = temp_ca_path
        except Exception as e:
            return {"status": "error", "message": f"憑證處理失敗 (CA Failed): {str(e)}", "details": []}

    try:
        _log(f"🔍 [REQUEST START] person_id={person_id[-3:] if person_id else '?'}, "
             f"range={start_date}~{end_date}, sim={simulation}, profile_only={profile_only}, "
             f"rss_start={_rss_mb():.0f}MB")
        request_start = time.perf_counter()

        # 2. Get API Session (reuses existing if same credentials)
        if progress_callback:
            progress_callback(10, "正在登入永豐金 API...")

        manager = get_session_manager()
        with _Stage("get_api (login or reuse)"):
            api = manager.get_api(
                api_key, secret_key, person_id, final_ca_path, ca_password, simulation=simulation
            )

        if progress_callback:
            progress_callback(20, "API 登入成功，檢查憑證狀態...")

        # 3. Check CA activation
        # 改用 expiry 機制 (1800s) 取代每次 force=True，省 0.5-2s/請求；
        # 若 CA 真的失效會在 list_profit_loss 階段拋錯，retry 機制能補救。
        with _Stage("ensure_ca_active"):
            ca_is_active = manager.ensure_ca_active(final_ca_path, ca_password, person_id, force=False)

        if not ca_is_active:
            _log("⚠️ CA NOT ACTIVATED — aborting PnL fetch to avoid silent empty results.")
            if not profile_only:
                # 根據情況給出最具體的錯誤訊息
                if ca_content:
                    msg = "CA 憑證啟動失敗：已上傳 .pfx 但 activate_ca 未成功，請確認憑證密碼是否正確。"
                elif not ca_path or not os.path.exists(ca_path):
                    msg = "CA 憑證未啟動：雲端伺服器找不到 .pfx 檔案。請在設定頁面重新上傳憑證檔案 (.pfx)。"
                else:
                    msg = "CA 憑證啟動失敗，請確認憑證密碼是否正確或重新上傳 .pfx 檔案。"
                return {
                    "status": "error",
                    "message": msg,
                    "details": [],
                    "ca_error": True
                }

        # 4. List Accounts
        if progress_callback:
            progress_callback(30, "正在取得帳號列表...")

        with _Stage("list_accounts"):
            try:
                accounts = api.list_accounts()
            except Exception as acc_err:
                _log(f"⚠️ [list_accounts] First attempt failed: {acc_err}")
                try:
                    accounts = api.list_accounts()
                except Exception as acc_err2:
                    _log(f"❌ [list_accounts] Failed: {acc_err2}")
                    return {
                        "status": "error",
                        "message": f"無法取得帳號列表，連線可能已中斷：{str(acc_err2)}",
                        "details": []
                    }

        _log(f"API Returned {len(accounts)} accounts.")

        # 5. Filter accounts by branch_filter ONLY (no type_filter)
        valid_accounts = []
        for acc in accounts:
            acc_branch = str(getattr(acc, "broker_id", "")).strip()[:4]
            acc_id = str(acc.account_id)
            acc_type_str = str(getattr(acc, "account_type", "")).upper()

            _log(f"SCAN: ID={acc_id} Type={acc_type_str} Branch={acc_branch}")

            if branch_filter:
                allowed = []
                if isinstance(branch_filter, list):
                    allowed = [str(x).strip() for x in branch_filter]
                else:
                    allowed = [x.strip() for x in str(branch_filter).split(",") if x.strip()]

                match = False
                for b in allowed:
                    if acc_branch.endswith(b[-4:]) or acc_id == b or b in acc_id:
                        match = True
                        break

                if match:
                    _log(f"MATCH: {acc_id} (Branch={acc_branch})")
                    valid_accounts.append(acc)
                else:
                    _log(f"SKIP: {acc_id} Branch={acc_branch} not in {allowed}")
            else:
                valid_accounts.append(acc)

        _log(f"Filtered to {len(valid_accounts)} valid accounts.")

        if not valid_accounts:
            msg = f"找不到符合條件的帳號 (Branch={branch_filter})"
            _log(f"⚠️ {msg}")
            return {"status": "error", "message": msg, "details": [], "details_count": 0}

        # ─── Profile-only mode ───
        if profile_only:
            choices = []
            acc_name = getattr(accounts[0], "username", person_id) if accounts else person_id
            for acc in accounts:
                bid = str(getattr(acc, "broker_id", "")).strip()[:4]
                atype = str(getattr(acc, "account_type", "")).replace("AccountType.", "")
                bname = BRANCH_MAP.get(bid, f"未知[{bid}]") + f" ({atype})"
                acc_id_str = str(getattr(acc, "account_id", ""))
                atype_upper = atype.upper()
                category = "Stock"
                if atype_upper in ("FUTURE", "F"):
                    category = "Futures"
                elif bid in ["F002", "9162"]:
                    category = "Futures"
                elif "SUB" in atype_upper or "H" in atype_upper:
                    category = "SubBrokerage"
                choices.append({
                    "branch_code": str(bid),
                    "branch_name": str(bname),
                    "account_id": acc_id_str,
                    "account_type": str(atype),
                    "category": category,
                    "username": str(acc_name),
                    "signed": bool(getattr(acc, "signed", False)),
                    "environment": "simulation" if simulation else "production"
                })
            _log(f"✅ [Profile] Returning {len(choices)} accounts")
            return {
                "status": "multiple_accounts",
                "accounts": choices,
                "environment": "simulation" if simulation else "production"
            }

        # ─── PnL Fetch ───

        # Default dates
        if not start_date:
            start_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        if not end_date:
            end_date = datetime.now().strftime("%Y-%m-%d")
        start_date = _normalize_date(start_date)
        end_date = _normalize_date(end_date)

        # Validate date range
        try:
            from datetime import date as _date
            start_dt_check = datetime.strptime(start_date, "%Y-%m-%d").date()
            end_dt_check = datetime.strptime(end_date, "%Y-%m-%d").date()
            today = _date.today()

            if start_dt_check > end_dt_check:
                return {
                    "status": "error",
                    "message": f"日期範圍錯誤：起始日期 ({start_date}) 不可晚於結束日期 ({end_date})，請重新選擇。",
                    "details": []
                }
            if end_dt_check > today:
                end_date = today.strftime("%Y-%m-%d")
                _log(f"⚠️ [Date] 結束日期超過今天，自動調整為今天: {end_date}")
        except ValueError as ve:
            return {
                "status": "error",
                "message": f"日期格式錯誤，請確認日期為 YYYY-MM-DD 格式：{ve}",
                "details": []
            }

        _log(f"📅 Date range: {start_date} → {end_date}")

        # ════════════════════════════════════════════════
        # 🚀 Sequential-fast account queries
        # ⚠️ Shioaji C++ API is NOT thread-safe — parallel calls crash
        # ════════════════════════════════════════════════
        # ════════════════════════════════════════════════
        results = []

        total_accs = len(valid_accounts)
        _log(f"🚀 Starting sequential-fast fetch for {total_accs} accounts...")
        if progress_callback:
            progress_callback(40, f"準備同步 {total_accs} 個帳號的損益資料...")

        for i, acc in enumerate(valid_accounts):
            acc_display = f"{acc.account_id} ({getattr(acc, 'account_type', 'Unknown')})"
            if progress_callback:
                pct = 40 + int((i / total_accs) * 50)  # 40% to 90%
                progress_callback(pct, f"正在下載帳號 {acc_display} [{i+1}/{total_accs}]...")

            with _Stage(f"fetch acc {acc.account_id} [{i+1}/{total_accs}]"):
                result = _fetch_single_account(api, acc, start_date, end_date, ca_is_active)
            results.append((acc, result))

        # ════════════════════════════════════════════════
        # Aggregate results
        # ════════════════════════════════════════════════
        total_pnl = 0
        details = []
        total_equity = 0
        total_open_pnl = 0
        final_empty_reason = None
        account_errors = []
        # 每帳號診斷摘要 — 讓前端能精確顯示「哪個帳號 / 為什麼 / 多少筆」，
        # 取代以往只看 details_count = 0 卻不知所以然的情況。
        account_summaries = []

        for acc, result in results:
            pnl, acc_dets, equity, open_pnl, empty_reason = result
            acc_id_str = str(acc.account_id)
            atype_str = str(getattr(acc, "account_type", "")).replace("AccountType.", "") or "Unknown"
            is_signed = bool(getattr(acc, "signed", False))
            summary = {
                "account_id": acc_id_str,
                "account_type": atype_str,
                "signed": is_signed,
                "record_count": len(acc_dets),
                "pnl": round(pnl, 2),
                "status": "ok",
                "reason": None,
            }

            if empty_reason and str(empty_reason).startswith("error:"):
                error_msg = str(empty_reason)[6:]
                account_errors.append(f"帳號 {acc_id_str}: {error_msg}")
                _log(f"❌ [Error] {acc_id_str}: {error_msg}")
                summary["status"] = "error"
                summary["reason"] = error_msg
            else:
                if pnl != 0 or acc_dets:
                    total_pnl += pnl
                    details.extend(acc_dets)
                    summary["status"] = "ok"
                elif empty_reason:
                    if empty_reason == "ca_not_activated":
                        final_empty_reason = "ca_not_activated"
                        summary["status"] = "empty"
                        summary["reason"] = "CA 憑證未啟動，無法取得資料"
                    elif empty_reason == "not_supported":
                        summary["status"] = "skipped"
                        summary["reason"] = "複委託帳號目前不支援"
                    else:
                        if not final_empty_reason:
                            final_empty_reason = empty_reason
                        summary["status"] = "empty"
                        if not is_signed:
                            summary["reason"] = "帳號尚未授權簽署 (請至帳號管理執行驗證)"
                        else:
                            summary["reason"] = "此區間內無交易紀錄"
                else:
                    summary["status"] = "empty"
                    summary["reason"] = "此區間內無交易紀錄"

            account_summaries.append(summary)
            total_equity += equity
            total_open_pnl += open_pnl
            _log(f"✅ [Done] {acc_id_str}: {len(acc_dets)} records, PnL={pnl}")

        # If all accounts failed and no details were fetched
        if account_errors and not details:
            error_summary = " | ".join(account_errors)
            _log(f"❌ [All Failed] {error_summary}")
            return {
                "status": "error",
                "message": f"擷取資料失敗: {error_summary}",
                "details": [],
                "environment": "simulation" if simulation else "production"
            }

        # Sort by date descending
        details.sort(key=lambda x: x["date"], reverse=True)

        # Aggregate daily results
        daily_map = {}
        for d in details:
            daily_map[d["date"]] = round(daily_map.get(d["date"], 0) + d["pnl"], 2)
        daily_results = [{"date": k, "pnl": v} for k, v in sorted(daily_map.items())]

        # Metadata
        signed_ids = []
        branch_codes = set()
        for acc in valid_accounts:
            if getattr(acc, "signed", False):
                signed_ids.append(str(acc.account_id))
            bid = str(getattr(acc, "broker_id", "")).strip()[:4]
            if bid:
                branch_codes.add(bid)

        # 0 筆但無錯誤的情況：根據各帳號摘要組一段可診斷的訊息，
        # 取代以往的「查無交易紀錄」黑盒子。
        empty_diagnostic_msg = None
        if not details and not account_errors:
            unsigned = [s for s in account_summaries if not s["signed"] and s["status"] != "skipped"]
            ca_blocked = [s for s in account_summaries if s["status"] == "empty" and s["reason"] and "CA" in s["reason"]]
            empty_only = [s for s in account_summaries if s["status"] == "empty" and not (s["reason"] and "CA" in s["reason"])]
            skipped = [s for s in account_summaries if s["status"] == "skipped"]
            parts = []
            if ca_blocked:
                ids = ", ".join(s["account_id"] for s in ca_blocked)
                parts.append(f"CA 未啟動 ({ids})")
            if unsigned:
                ids = ", ".join(s["account_id"] for s in unsigned)
                parts.append(f"帳號未授權 ({ids}) — 請至「帳號管理」執行驗證")
            if skipped:
                ids = ", ".join(s["account_id"] for s in skipped)
                parts.append(f"已跳過 ({ids}, 複委託暫不支援)")
            if not parts and empty_only:
                ids = ", ".join(s["account_id"] for s in empty_only)
                parts.append(f"此區間 {start_date}~{end_date} 內 {ids} 確實無交易")
            if parts:
                empty_diagnostic_msg = "；".join(parts)

        result = {
            "status": "success",
            "total_pnl": round(total_pnl, 2),
            "daily_results": daily_results,
            "details": details,
            "details_count": len(details),
            "branch_code": branch_filter or ",".join(sorted(list(branch_codes))) or "ALL",
            "environment": "simulation" if simulation else "production",
            "signed_accounts": signed_ids,
            "ca_status": "activated" if ca_is_active else "not_activated",
            "empty_reason": final_empty_reason if not details else None,
            # 每帳號診斷摘要 — 前端可直接顯示，user / dev 一眼判斷哪個帳號哪裡卡
            "account_summaries": account_summaries,
            "empty_diagnostic": empty_diagnostic_msg,
            "date_range_used": {"start": start_date, "end": end_date},
            "summary": {
                "equity": total_equity,
                "open_pnl": round(total_open_pnl, 2),
                "realized_pnl": round(total_pnl, 2)
            }
        }

        if accounts:
            result["username"] = getattr(accounts[0], "username", person_id)

        request_total = time.perf_counter() - request_start
        _log(f"✅ [Done] PnL={total_pnl}, Items={len(details)}, Equity={total_equity} | "
             f"total_request={request_total:.2f}s, rss_end={_rss_mb():.0f}MB")
        return result

    except Exception as e:
        import traceback
        err_str = str(e)
        _log(f"Exception: {err_str}")
        _log(traceback.format_exc())

        # Classify common Shioaji / network errors into user-friendly messages
        friendly_msg = err_str
        if "key:" in err_str and "not exist" in err_str:
            friendly_msg = "API Key 無效或不存在，請至「設定」重新確認 API Key。"
        elif "Account Not Acceptable" in err_str:
            friendly_msg = "帳號授權失敗：該帳號尚未開通 API 權限。請至「帳號管理」執行驗證。"
        elif _is_session_not_ready(err_str):
            friendly_msg = (
                "⏳ 永豐金期貨連線尚未就緒 (SessionNotEstablished)。"
                "通常稍候 30 秒後重試即可；若持續發生請確認 API 是否在交易時段內開通。"
            )
        elif "CA" in err_str or "activate_ca" in err_str or "憑證" in err_str:
            friendly_msg = "CA 憑證錯誤：請至「設定」重新上傳 .pfx 憑證並確認密碼正確。"
        elif "timeout" in err_str.lower() or "timed out" in err_str.lower() or "Timeout" in err_str:
            friendly_msg = "登入逾時：連線永豐金 API 超過時限，請檢查網路連線後重試。"
        elif "Connection" in err_str or "connect" in err_str.lower():
            friendly_msg = "無法連接永豐金 API，請確認網路連線是否正常。"
        elif "simulation" in err_str.lower() and "production" in err_str.lower():
            friendly_msg = "環境設定錯誤：帳號環境不符（正式/模擬），請至「設定」確認帳號環境。"

        return {
            "status": "error",
            "message": friendly_msg,
            "error": err_str,
            "details": [],
            "environment": "simulation" if simulation else "production"
        }
    finally:
        # 清理臨時 CA 檔案，避免免費雲端磁碟配額累積
        if temp_ca_path and os.path.exists(temp_ca_path):
            try:
                os.unlink(temp_ca_path)
            except OSError as _cleanup_err:
                _log(f"[CA Cleanup] Failed to remove {temp_ca_path}: {_cleanup_err}")
        # Render free tier 只有 512MB RAM；fetch_contract=False 已大幅降基礎佔用，
        # 額外做一輪 GC 釋放這次 PnL 抓取累積的暫存物件 (pnl_data items, parsed dicts 等)
        # 避免下一個請求進來時又踩到 OOM 上限。
        gc.collect()


def verify_simulation_account(
    api_key,
    secret_key,
    person_id,
    ca_path,
    ca_password,
    account_id,
    ca_content=None
):
    """
    Performs a simulation order to satisfy Shioaji's "signed" requirement.
    """
    temp_ca_path = None
    final_ca_path = ca_path

    if ca_content:
        try:
            tf = tempfile.NamedTemporaryFile(delete=False, suffix=".pfx")
            tf.write(base64.b64decode(ca_content))
            tf.close()
            temp_ca_path = tf.name
            final_ca_path = temp_ca_path
        except Exception as e:
            return {"status": "error", "message": f"憑證處理失敗: {str(e)}"}

    try:
        manager = get_session_manager()
        # 模擬下單需要 api.Contracts.Stocks 取契約物件，此處必須帶 contracts
        api = manager.get_api(
            api_key, secret_key, person_id, final_ca_path, ca_password, simulation=True,
            fetch_contract=True,
        )

        if not final_ca_path or not os.path.exists(final_ca_path):
            return {"status": "error", "message": f"找不到憑證檔案，請確認路徑或重新上傳憑證 (.pfx)。"}

        try:
            api.activate_ca(ca_path=final_ca_path, ca_passwd=ca_password, person_id=person_id)
        except Exception as e:
            return {"status": "error", "message": f"憑證啟動失敗: {str(e)}"}

        accounts = api.list_accounts()
        target_acc = next((acc for acc in accounts if acc.account_id == account_id), None)

        if not target_acc:
            return {"status": "error", "message": "找不到該帳號，請確認帳號是否正確。"}

        contract = api.Contracts.Stocks["2881"]
        if not contract:
            contract = api.Contracts.Stocks["2890"]
        if not contract:
            return {"status": "error", "message": "無法取得測試商品資訊"}

        order = api.Order(
            price=10.0,
            quantity=1,
            action=sj.constant.Action.Buy,
            price_type=sj.constant.StockPriceType.LMT,
            order_type=sj.constant.OrderType.ROD,
            account=target_acc
        )

        trade = api.place_order(contract, order)
        time.sleep(2)

        accounts_after = api.list_accounts()
        target_after = next((acc for acc in accounts_after if acc.account_id == account_id), None)
        is_signed = getattr(target_after, "signed", False)

        if is_signed:
            return {"status": "success", "message": "驗證成功！該帳號已開通 API 權限。"}
        else:
            return {
                "status": "pending",
                "message": "測試訂單已送出，但狀態尚未更新。請等待約 5 分鐘後重新檢查。"
            }

    except Exception as e:
        return {"status": "error", "message": f"驗證過程中出錯: {str(e)}"}
    finally:
        if temp_ca_path and os.path.exists(temp_ca_path):
            try:
                os.unlink(temp_ca_path)
            except:
                pass
