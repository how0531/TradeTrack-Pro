import os
import time
import base64
import tempfile
import threading
from datetime import datetime, timedelta
from .session import get_session_manager
from .constants import BRANCH_MAP
import shioaji as sj


# ─── Shared Logger ───
_LOG_FILE = os.path.join(os.path.expanduser("~"), "debug_backend.log")

def _log(msg):
    try:
        with open(_LOG_FILE, "a", encoding="utf-8") as f:
            f.write(f"[{datetime.now()}] {msg}\n")
    except:
        pass
    print(msg, flush=True)


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

        # Core: list_profit_loss — single attempt, no redundant retry sleep
        pnl_data = None
        try:
            pnl_data = api.list_profit_loss(target_account, start_date, end_date)
        except Exception as api_e:
            err_str = str(api_e)
            if "406" in err_str or "Account Not Acceptable" in err_str:
                _log(f"ℹ️ [Skip 406] {acc_id} not supported by list_profit_loss")
                pnl_data = []
            else:
                # Single retry on non-406 errors
                _log(f"⚠️ [Retry] {acc_id} first attempt failed: {api_e}")
                try:
                    pnl_data = api.list_profit_loss(target_account, start_date, end_date)
                except Exception as retry_e:
                    _log(f"❌ [Failed] {acc_id} retry also failed: {retry_e}")
                    return 0, [], 0, 0, f"error:{retry_e}"

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

                acc_details.append({
                    "date": item_date,
                    "code": display_code,
                    "price": price,
                    "quantity": raw_qty,
                    "pnl": realized,
                    "orderNo": getattr(item, "dseq", getattr(item, "seqno", "")),
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
        # 2. Get API Session (reuses existing if same credentials)
        manager = get_session_manager()
        api = manager.get_api(
            api_key, secret_key, person_id, final_ca_path, ca_password, simulation=simulation
        )

        # 3. Check CA activation
        ca_is_active = manager.ensure_ca_active(final_ca_path, ca_password, person_id)

        if not ca_is_active:
            _log("⚠️ CA NOT ACTIVATED — PnL queries may return empty results!")
            if not profile_only and not ca_content and (not ca_path or not os.path.exists(ca_path)):
                return {
                    "status": "error",
                    "message": "CA 憑證未啟動：雲端伺服器找不到 .pfx 檔案。請在設定頁面重新上傳憑證檔案 (.pfx)。",
                    "details": [],
                    "ca_error": True
                }

        # 4. List Accounts
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
        _log(f"📅 Date range: {start_date} → {end_date}")

        # ════════════════════════════════════════════════
        # 🚀 Sequential-fast account queries
        # ⚠️ Shioaji C++ API is NOT thread-safe — parallel calls crash
        # ════════════════════════════════════════════════
        results = []

        _log(f"🚀 Starting sequential-fast fetch for {len(valid_accounts)} accounts...")

        for acc in valid_accounts:
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

        for acc, result in results:
            pnl, acc_dets, equity, open_pnl, empty_reason = result

            if empty_reason and str(empty_reason).startswith("error:"):
                error_msg = str(empty_reason)[6:]
                account_errors.append(f"帳號 {acc.account_id}: {error_msg}")
                _log(f"❌ [Error] {acc.account_id}: {error_msg}")
            else:
                if pnl != 0 or acc_dets:
                    total_pnl += pnl
                    details.extend(acc_dets)
                elif empty_reason:
                    if empty_reason == "ca_not_activated":
                        final_empty_reason = "ca_not_activated"
                    elif not final_empty_reason:
                        final_empty_reason = empty_reason

            total_equity += equity
            total_open_pnl += open_pnl
            _log(f"✅ [Done] {acc.account_id}: {len(acc_dets)} records, PnL={pnl}")

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

        # Metadata
        signed_ids = []
        branch_codes = set()
        for acc in valid_accounts:
            if getattr(acc, "signed", False):
                signed_ids.append(str(acc.account_id))
            bid = str(getattr(acc, "broker_id", "")).strip()[:4]
            if bid:
                branch_codes.add(bid)

        result = {
            "status": "success",
            "total_pnl": round(total_pnl, 2),
            "details": details,
            "details_count": len(details),
            "branch_code": branch_filter or ",".join(sorted(list(branch_codes))) or "ALL",
            "environment": "simulation" if simulation else "production",
            "signed_accounts": signed_ids,
            "ca_status": "activated" if ca_is_active else "not_activated",
            "empty_reason": final_empty_reason if not details else None,
            "summary": {
                "equity": total_equity,
                "open_pnl": round(total_open_pnl, 2),
                "realized_pnl": round(total_pnl, 2)
            }
        }

        if accounts:
            result["username"] = getattr(accounts[0], "username", person_id)

        _log(f"✅ [Done] PnL={total_pnl}, Items={len(details)}, Equity={total_equity}")
        return result

    except Exception as e:
        import traceback
        _log(f"Exception: {str(e)}")
        _log(traceback.format_exc())
        return {
            "status": "error",
            "message": str(e),
            "error": str(e),
            "details": [],
            "environment": "simulation" if simulation else "production"
        }
    finally:
        pass


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
        api = manager.get_api(
            api_key, secret_key, person_id, final_ca_path, ca_password, simulation=True
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
