import os
import time
import base64
import tempfile
import threading
from datetime import datetime, timedelta
from .session import get_session_manager
from .constants import BRANCH_MAP
import shioaji as sj

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
    type_filter=None,
    profile_only=False,
):
    """
    Main Logic with FILE LOGGING for debugging
    """
    # LOGGING SETUP
    log_file = os.path.join(os.path.expanduser("~"), "debug_backend.log")
    def log(msg):
        try:
            with open(log_file, "a", encoding="utf-8") as f:
                f.write(f"[{datetime.now()}] {msg}\n")
        except: pass
        print(msg, flush=True)

    log(f"--- START REQUEST ---")
    log(f"Params: Sim={simulation}, PersonID={person_id}, Filter={branch_filter}, Type={type_filter}")

    # 1. Handle Dynamic CA
    temp_ca_path = None
    final_ca_path = ca_path

    if ca_content:
        try:
            # 🔧 FIX: Use a predictable temp file rather than a random one.
            # Do NOT use `delete=False` NamedTemporaryFile because we will NOT delete it in finally.
            # Shioaji C++ library accesses this file dynamically on *every* query signature.
            temp_ca_path = os.path.join(tempfile.gettempdir(), f"tradetrack_ca_{person_id}.pfx")
            with open(temp_ca_path, "wb") as f:
                f.write(base64.b64decode(ca_content))
            final_ca_path = temp_ca_path
        except Exception as e:
            return {"status": "error", "message": f"憑證處理失敗 (CA Failed): {str(e)}", "details": []}

    try:
        # 2. Get API Session
        manager = get_session_manager()
        api = manager.get_api(
            api_key, secret_key, person_id, final_ca_path, ca_password, simulation=simulation
        )

        # 🔑 Check CA activation status and warn if not activated
        ca_is_active = manager.ensure_ca_active(final_ca_path, ca_password, person_id)
        
        if not ca_is_active:
            log("⚠️ CA NOT ACTIVATED — PnL queries may return empty results!")
            # B5: profile_only 模式下 CA 不是必要的，只需列帳號，不阻斷
            if not profile_only and not ca_content and (not ca_path or not os.path.exists(ca_path)):
                return {
                    "status": "error",
                    "message": "CA 憑證未啟動：雲端伺服器找不到 .pfx 檔案。請在設定頁面重新上傳憑證檔案 (.pfx)。",
                    "details": [],
                    "ca_error": True
                }
        
        # 3. List Accounts
        try:
            accounts = api.list_accounts()
        except Exception as acc_err:
            log(f"⚠️ [list_accounts] First attempt failed: {acc_err}")
            time.sleep(1)
            try:
                accounts = api.list_accounts()
            except Exception as acc_err2:
                log(f"❌ [list_accounts] Second attempt also failed: {acc_err2}")
                return {
                    "status": "error",
                    "message": f"無法取得帳號列表，連線可能已中斷：{str(acc_err2)}",
                    "details": []
                }
            
        log(f"API Returned {len(accounts)} accounts.")
        
        valid_accounts = []
        
        for acc in accounts:
            acc_type_str = str(getattr(acc, "account_type", "")).upper()
            acc_branch = str(getattr(acc, "broker_id", "")).strip()[:4]
            acc_id = str(acc.account_id)
            
            is_futures = "F" in acc_type_str or "FUTURE" in acc_type_str
            
            # Type Filter Logic
            if type_filter:
                pf = type_filter.upper()
                if pf == 'F' and not is_futures:
                    log(f"SKIP: ID={acc_id} Type={acc_type_str} (Wanted Futures)")
                    continue
                if pf == 'S' and is_futures:
                    log(f"SKIP: ID={acc_id} Type={acc_type_str} (Wanted Stock)")
                    continue

            log(f"SCAN: ID={acc_id} Type={acc_type_str} Branch={acc_branch}")

            # Branch Filter Logic
            if branch_filter:
                allowed = []
                if isinstance(branch_filter, list):
                    allowed = [str(x).strip() for x in branch_filter]
                else:
                    allowed = [x.strip() for x in str(branch_filter).split(",") if x.strip()]
                
                # Normalize branch comparison (4 digits)
                match = False
                for b in allowed:
                    if acc_branch.endswith(b[-4:]) or acc_id == b or b in acc_id:
                        match = True
                        break
                
                if match:
                    log(f"MATCH: Found account {acc_id} for branch {acc_branch}")
                    valid_accounts.append(acc)
                else:
                    log(f"SKIP: ID={acc_id} Branch={acc_branch} not in {allowed}")
            else:
                valid_accounts.append(acc)
        
        log(f"Filtered to {len(valid_accounts)} valid accounts.")
        
        if not valid_accounts:
            msg = f"找不到符合條件的帳號 (Branch={branch_filter}, Type={type_filter})"
            log(f"⚠️ {msg}")
            return {"status": "error", "message": msg, "details": [], "details_count": 0}

        # M4: Profile-only 模式 — 只需登入並列出帳號，跳過 CA probe 和 PnL 抓取
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
                elif acc_id_str.startswith("0") or "SUB" in atype_upper or "H" in atype_upper:
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
            log(f"✅ [Profile] Returning {len(choices)} accounts (profile_only mode)")
            return {
                "status": "multiple_accounts",
                "accounts": choices,
                "environment": "simulation" if simulation else "production"
            }

        # Optimization #18: Proactive CA Verification Probe
        # 🔧 FIX: 不再重複呼叫 ensure_ca_active（L62 已執行），直接使用既有結果
        # 🔧 FIX: CA probe 只針對期貨帳號，股票帳號不支援 margin()
        if ca_is_active and valid_accounts:
            try:
                futures_acc = next((a for a in valid_accounts if "F" in str(getattr(a, "account_type", "")).upper()), None)
                if futures_acc:
                    api.margin(futures_acc)
                    log("✅ [CA Probe] CA is active and functional (futures account).")
                else:
                    # 股票帳號用 list_positions 測試 CA
                    api.list_positions(valid_accounts[0])
                    log("✅ [CA Probe] CA is active and functional (stock account).")
            except Exception as probe_err:
                log(f"⚠️ [CA Probe] CA probe non-fatal failure: {probe_err}")

        # 4. Fetch PnL — Sequential Execution
        # Default dates
        if not start_date:
            start_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        if not end_date:
            end_date = datetime.now().strftime("%Y-%m-%d")

        # 日期格式標準化：確保為 "YYYY-MM-DD" 格式
        def normalize_date(d):
            d = str(d).strip()
            if len(d) == 8 and d.isdigit():  # "20250401" → "2025-04-01"
                return f"{d[:4]}-{d[4:6]}-{d[6:]}"
            return d
        start_date = normalize_date(start_date)
        end_date = normalize_date(end_date)
        log(f"📅 Date range: {start_date} → {end_date}")

        # 移除未使用的 concurrent.futures import
        
        # 帶 timeout 的 list_profit_loss wrapper——避免 API 永遠等待
        def safe_list_profit_loss(account, start, end, timeout_sec=15):
            """Calls api.list_profit_loss with a timeout to prevent indefinite hangs."""
            result_holder = [None]
            error_holder = [None]
            def _call():
                try:
                    result_holder[0] = api.list_profit_loss(account, start, end)
                except Exception as e:
                    error_holder[0] = e
            t = threading.Thread(target=_call, daemon=True)
            t.start()
            t.join(timeout=timeout_sec)
            if t.is_alive():
                raise TimeoutError(f"list_profit_loss 超時 ({timeout_sec}秒)")
            if error_holder[0]:
                raise error_holder[0]
            return result_holder[0]
        
        # Internal Worker Function (Closure to capture log/api context)
        def fetch_worker(target_account):
            acc_pnl = 0
            acc_details = []
            acc_equity = 0    # New: 權益數
            acc_open_pnl = 0  # New: 未平倉損益
            empty_reason = None # New: 空結果的原因
            
            try:
                acc_type_str = str(getattr(target_account, "account_type", "")).upper()
                is_futures = "F" in acc_type_str or "FUTURE" in acc_type_str
                is_sub = "H" in acc_type_str
                
                category = "期貨" if is_futures else ("複委託" if is_sub else "台股")
                
                log(f"🚀 [Thread Start] Fetching {target_account.account_id} ({category})")
                
                # 1. 複委託 (Sub-brokerage) - Skip (Not supported)
                if is_sub:
                     log(f"ℹ️ [Skip PnL] Skipping PnL for Sub-brokerage account {target_account.account_id}")
                     return 0, acc_details, 0, 0, "not_supported"

                # 2. 期貨額外數據：權益數 (Equity) & 未平倉 (Open Positions)
                if is_futures:
                    try:
                        # Fetch Margin (Equity)
                        log(f"💰 [Futures Margin] Fetching margin for {target_account.account_id}...")
                        margin_data = api.margin(target_account)
                        acc_equity = int(getattr(margin_data, "equity", 0))
                        log(f"💰 [Futures Margin] Equity: {acc_equity}")

                        # Fetch Open Positions
                        log(f"📜 [Futures Positions] Fetching open positions for {target_account.account_id}...")
                        positions = api.list_positions(target_account)
                        for pos in positions:
                            open_pnl = float(getattr(pos, "pnl", 0))
                            acc_open_pnl += open_pnl
                            
                            # Optional: Add open positions to details list? 
                            # User asked for "Total Asset" view, but mixing open/closed in list might be confusing.
                            # For now, we aggregate open PnL.
                        log(f"📜 [Futures Positions] Open PnL: {acc_open_pnl}")

                    except Exception as me:
                        log(f"⚠️ [Futures Margin/Pos Error] {me}")

                # 3. 核心 PnL 抓取 (Unified Logic for Stock & Futures)
                # 使用 list_profit_loss — 單次查詢 + 錯誤時才重試
                pnl_data = None  # None = 尚未取得, [] = 確認無資料
                for attempt in range(2):
                    try:
                        try:
                            raw_result = safe_list_profit_loss(target_account, start_date, end_date)
                        except Exception as api_e:
                            err_str = str(api_e)
                            if "406" in err_str or "Account Not Acceptable" in err_str:
                                log(f"ℹ️ [Skip 406] Account {target_account.account_id} not supported by list_profit_loss.")
                                pnl_data = []
                                break  # 406 不需重試
                            else:
                                raise api_e 

                        # 區分 None（異常）和 []（真的沒資料）
                        if raw_result is None:
                            log(f"⚠️ [API Fetch] {target_account.account_id} Attempt {attempt+1}: Returned None (abnormal)")
                            if attempt == 0:
                                time.sleep(1.5)  # None 表示連線可能有問題，多等一下
                                continue
                            else:
                                pnl_data = []  # 第二次仍 None，視為無資料
                        else:
                            pnl_data = raw_result
                            count = len(pnl_data)
                            log(f"🔍 [API Fetch] {target_account.account_id} Attempt {attempt+1}: Found {count} records.")
                            if count > 0:
                                break  # 成功取得資料，不再重試
                            elif attempt == 0:
                                time.sleep(1)  # 第一次空值，等 1 秒後重試一次

                    except Exception as e:
                        if "406" in str(e): break
                        log(f"❌ [API Error] {target_account.account_id} Attempt {attempt+1}: {str(e)}")
                        if attempt == 0:
                            time.sleep(1)

                if pnl_data is None:
                    pnl_data = []
                if not pnl_data:
                    empty_reason = "ca_not_activated" if not ca_is_active else "no_trades_in_range"
                
                # 🔍 診斷日誌：列出 API 回傳的所有原始資料（含海外期貨）
                log(f"📊 [Raw PnL Data] Account {target_account.account_id}: {len(pnl_data)} items returned")
                for idx, item in enumerate(pnl_data):
                    item_code = getattr(item, "code", "?")
                    item_pnl = getattr(item, "pnl", 0)
                    item_date = getattr(item, "date", "?")
                    item_currency = getattr(item, "currency", "N/A")
                    item_entry = getattr(item, "entry_price", "N/A")
                    item_cover = getattr(item, "cover_price", "N/A")
                    log(f"  [{idx}] code={item_code}, pnl={item_pnl}, date={item_date}, currency={item_currency}, entry={item_entry}, cover={item_cover}")
                
                for item in pnl_data:
                    try:
                        code = getattr(item, "code", "Unknown")
                        # 🛡️ 強化日期解析：支援 datetime.date / "20250401" / "2025-04-01"
                        raw_date = getattr(item, "date", "")
                        if hasattr(raw_date, 'strftime'):
                            item_date = raw_date.strftime("%Y-%m-%d")
                        else:
                            item_date = str(raw_date).strip()
                            if len(item_date) == 8 and item_date.isdigit():
                                item_date = f"{item_date[:4]}-{item_date[4:6]}-{item_date[6:]}"
                        
                        raw_qty = int(getattr(item, "quantity", 0))
                        # pnl from Shioaji is ALWAYS in NTD for both Stock and Futures
                        realized = round(float(getattr(item, "pnl", 0)), 4)
                        
                        # Helper to resolve futures names
                        def resolve_name(c, is_f):
                           FUTURES_NAMES = {
                               'TXF': '台指期', 'MTX': '小台指', 'TE': '電子期', 'MTE': '小電子期',
                               'TF': '金融期', 'T5F': '櫃買期', 'UNF': '非金電期', 'GTF': '黃金期',
                               'XIF': '東證期', 'SP': 'S&P期', 'ND': '那斯達克期',
                           }
                           n = ""
                           if is_f and len(c) >= 2:
                                for prefix in [c[:3].upper(), c[:2].upper()]:
                                    if prefix in FUTURES_NAMES: 
                                        n = FUTURES_NAMES[prefix]
                                        break
                                if not n and len(c) > 3 and c.endswith('O'):
                                    n = '選擇權'
                           if "臺股期" in n: n = "台指期"
                           elif "小型臺指" in n: n = "小台指"
                           return n

                        name = getattr(item, "name", "") or resolve_name(code, is_futures)
                        display_code = name if code in name else f"{code} {name}" if name else code
                        
                        # Initialize output fields BEFORE type-specific branch
                        price = 0.0
                        buy_amt = 0.0
                        sell_amt = 0.0
                        pr_ratio_val = 0.0
                        entry_price = 0.0
                        exit_price = 0.0
                        
                        if is_futures:
                            # ═══════════════════════════════════════════
                            # FutureProfitLoss (官方文件)
                            # 屬性: code, quantity, pnl, date, direction,
                            #       entry_price, cover_price, tax, fee
                            # ═══════════════════════════════════════════
                            entry_price = float(getattr(item, "entry_price", 0))
                            exit_price = float(getattr(item, "cover_price", 0))
                            price = entry_price
                            
                            # 自行計算報酬率 (期貨沒有 pr_ratio)
                            # 🔧 FIX: 加入合約乘數，避免報酬率異常（如 200% → 實際 1%）
                            if entry_price > 0 and raw_qty > 0:
                                upper_code = str(code).upper()
                                contract_multiplier = 200  # 台指期預設
                                if 'MTX' in upper_code or '小台' in upper_code: contract_multiplier = 50
                                elif 'MTE' in upper_code or '小電' in upper_code: contract_multiplier = 500
                                elif 'TE' in upper_code or '電子' in upper_code: contract_multiplier = 4000
                                elif 'TF' in upper_code or '金融' in upper_code: contract_multiplier = 1000
                                elif 'T5F' in upper_code or '櫃買' in upper_code: contract_multiplier = 100
                                elif 'XIF' in upper_code or '東證' in upper_code: contract_multiplier = 200
                                elif 'GTF' in upper_code or '黃金' in upper_code: contract_multiplier = 100
                                elif 'UNF' in upper_code or '非金電' in upper_code: contract_multiplier = 200
                                denom = entry_price * raw_qty * contract_multiplier
                                if denom > 0:
                                    pr_ratio_val = round((realized / denom) * 100, 2)
                            
                        elif not is_sub:
                            # ═══════════════════════════════════════════
                            # StockProfitLoss (官方文件)
                            # 屬性: code, seqno, dseq, quantity(張), price,
                            #       pnl, pr_ratio(小數), cond, date
                            # ═══════════════════════════════════════════
                            price = round(float(getattr(item, "price", 0)), 4)
                            # pr_ratio 是小數 (如 0.1237)，需乘 100 轉為百分比
                            pr_ratio_val = round(float(getattr(item, "pr_ratio", 0)) * 100, 2)
                            
                            # Unit.Common (預設) 回傳的 quantity 已是「張」數
                            # 不需要除以 1000
                            cond_str = str(getattr(item, "cond", "")).upper()
                        
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
                            "accountId": target_account.account_id
                        })
                        acc_pnl += realized
                    except Exception as item_e:
                         log(f"❌ [Item Error] {getattr(item, 'code', '?')}: {item_e}")
                         continue
                         
                return acc_pnl, acc_details, acc_equity, acc_open_pnl, empty_reason

            except Exception as e:
                log(f"❌ [Worker Error] {target_account.account_id}: {e}")
                import traceback
                log(traceback.format_exc())
                return 0, [], 0, 0, "error"

        
        total_pnl = 0
        details = []
        total_equity = 0      # New: 總權益數
        total_open_pnl = 0    # New: 總未平倉損益
        final_empty_reason = None
        
        # 收集錯誤，如果所有帳號都失敗，就要拋出明確錯誤給前端
        account_errors = []
        
        log(f"🚀 Starting Sequential Execution for {len(valid_accounts)} accounts...")
        for acc in valid_accounts:
            try:
                # Unpack 5 values now
                pnl, acc_dets, equity, open_pnl, empty_reason = fetch_worker(acc)
                
                if empty_reason and empty_reason.startswith("error:"):
                    error_msg = empty_reason[6:]
                    account_errors.append(f"帳號 {acc.account_id}: {error_msg}")
                    log(f"❌ [Worker Reported Error] {acc.account_id} failed with: {error_msg}")
                else:
                    if pnl != 0 or acc_dets:
                        total_pnl += pnl
                        details.extend(acc_dets)
                    elif empty_reason:
                        # 優先記錄 ca_not_activated
                        if empty_reason == "ca_not_activated":
                            final_empty_reason = "ca_not_activated"
                        elif not final_empty_reason:
                            final_empty_reason = empty_reason
                
                # Aggregate Futures Data
                total_equity += equity
                total_open_pnl += open_pnl
                log(f"✅ [Done] {acc.account_id} finished via {acc.broker_id}")
                    
            except Exception as exc:
                log(f"❌ [Exception] {acc.account_id} generated an exception: {exc}")
                account_errors.append(f"帳號 {acc.account_id}: {str(exc)}")

        # 如果帳號有失敗且沒有成功取得任何 details，則認定這是一次失敗的查詢
        if account_errors and not details:
            error_summary = " | ".join(account_errors)
            log(f"❌ [Fetch Failed] All valid accounts failed: {error_summary}")
            return {
                "status": "error",
                "message": f"擷取資料失敗: {error_summary}",
                "details": [],
                "environment": "simulation" if simulation else "production"
            }

        # B6: temp CA cleanup is handled exclusively in the `finally` block below

        # Final Sort
        details.sort(key=lambda x: x["date"], reverse=True)
        
        # Get final metadata from the valid accounts
        signed_ids = []
        branch_codes = set()
        
        if valid_accounts:
             for acc in valid_accounts:
                 if getattr(acc, "signed", False):
                     signed_ids.append(str(acc.account_id))
                 
                 bid = str(getattr(acc, "broker_id", "")).strip()[:4]
                 if bid: branch_codes.add(bid)

        # Result Construction
        result = {
            "status": "success",
            "total_pnl": round(total_pnl, 2),
            "details": details,
            "details_count": len(details),
            "branch_code": branch_filter or ",".join(sorted(list(branch_codes))) or "ALL",
            "environment": "simulation" if simulation else "production",
            "signed_accounts": signed_ids,
            "ca_status": "activated" if ca_is_active else "not_activated", # 新增 CA 狀態
            "empty_reason": final_empty_reason if not details else None,   # 新增空結果原因
            # New Summary Fields
            "summary": {
                "equity": total_equity,
                "open_pnl": round(total_open_pnl, 2),
                "realized_pnl": round(total_pnl, 2)
            }
        }
        
        # Helper to extract name (simplified)
        if accounts:
            result["username"] = getattr(accounts[0], "username", person_id)

        log(f"✅ [Done] PnL: {total_pnl}, Items: {len(details)}, Equity: {total_equity}, EmptyReason: {final_empty_reason}")
        
        return result

    except Exception as e:
        import traceback
        log(f"Exception: {str(e)}")
        log(traceback.format_exc())
        return {
            "status": "error", 
            "message": str(e),
            "error": str(e), 
            "details": [],
            "environment": "simulation" if simulation else "production"
        }
    finally:
        # 🔧 FIX: DO NOT clean up the temp CA file here! 
        # Because we reuse the Shioaji session across multiple requests (Chunking / Stock vs Futures),
        # the Shioaji C++ library expects the PFX file to still exist at the precise path 
        # provided during `activate_ca`. If we delete it here, the next chunk will fail mysteriously.
        # Since we use a deterministic filename (`tradetrack_ca_{person_id}.pfx`), we won't leak thousands of files.
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
    log_file = os.path.join(os.path.expanduser("~"), "debug_backend.log")
    def log(msg):
        try:
            with open(log_file, "a", encoding="utf-8") as f:
                f.write(f"[{datetime.now()}] [VERIFY] {msg}\n")
        except: pass
        print(f"[VERIFY] {msg}", flush=True)

    log(f"Starting verification for account: {account_id}")
    
    temp_ca_path = None
    final_ca_path = ca_path

    if ca_content:
        try:
            import base64
            tf = tempfile.NamedTemporaryFile(delete=False, suffix=".pfx")
            tf.write(base64.b64decode(ca_content))
            tf.close()
            temp_ca_path = tf.name
            final_ca_path = temp_ca_path
        except Exception as e:
            return {"status": "error", "message": f"憑證處理失敗: {str(e)}"}

    try:
        manager = get_session_manager()
        # MUST use simulation=True for verification tests
        api = manager.get_api(
            api_key, secret_key, person_id, final_ca_path, ca_password, simulation=True
        )
        
        # 1. Activate CA (Required for ordering)
        if not final_ca_path or not os.path.exists(final_ca_path):
            log(f"CA File not found at: {final_ca_path}")
            return {"status": "error", "message": f"找不到憑證檔案，請確認路徑或重新上傳憑證 (.pfx)。\n路徑: {final_ca_path}"}

        try:
            api.activate_ca(ca_path=final_ca_path, ca_passwd=ca_password, person_id=person_id)
            log("CA activated successfully.")
        except Exception as e:
            log(f"CA activation failed: {e}")
            return {"status": "error", "message": f"憑證啟動失敗: {str(e)}\n請確認憑證密碼是否正確。"}

        # 2. Find target account
        accounts = api.list_accounts()
        target_acc = next((acc for acc in accounts if acc.account_id == account_id), None)
        
        if not target_acc:
            log(f"Account {account_id} not found in simulation login.")
            return {"status": "error", "message": "找不到該帳號，請確認帳號是否正確。"}

        log(f"Target account set: {target_acc.account_id}")

        # 3. Place Simulation Order
        # Stock 2881 (Fubon Financial) is a common stable liquid stock for tests
        contract = api.Contracts.Stocks["2881"]
        if not contract:
            # Fallback if 2881 is not available in sim
            log("Contract 2881 not found, trying fallback 2890 (Sinopac)")
            contract = api.Contracts.Stocks["2890"]
        
        if not contract:
             return {"status": "error", "message": "無法取得測試商品資訊 (Contracts lookup failed)"}

        order = api.Order(
            price=10.0, 
            quantity=1, 
            action=sj.constant.Action.Buy, 
            price_type=sj.constant.StockPriceType.LMT, 
            order_type=sj.constant.OrderType.ROD, 
            account=target_acc
        )
        
        log(f"Placing simulation order for {contract.code}...")
        trade = api.place_order(contract, order)
        
        # Safe access to order ID (Order is an object, not a dict)
        current_ord = getattr(trade, 'order', None)
        ord_id = getattr(current_ord, 'id', 'unknown') if current_ord else 'unknown'
        log(f"Order placed. Trade ID: {ord_id}")
        
        # Wait a bit for system to register
        time.sleep(2)
        
        # 4. Check status again
        accounts_after = api.list_accounts()
        target_after = next((acc for acc in accounts_after if acc.account_id == account_id), None)
        is_signed = getattr(target_after, "signed", False)
        
        if is_signed:
            log("Verification SUCCESS: Account is now signed.")
            return {"status": "success", "message": "驗證成功！該帳號已開通 API 權限。"}
        else:
            log("Order placed but status still NOT signed. (System might need more time)")
            return {
                "status": "pending", 
                "message": "測試訂單已送出，但狀態尚未更新。請等待約 5 分鐘後重新檢查。"
            }

    except Exception as e:
        log(f"Verification process failed: {str(e)}")
        return {"status": "error", "message": f"驗證過程中出錯: {str(e)}"}
    finally:
        if temp_ca_path and os.path.exists(temp_ca_path):
            try: os.unlink(temp_ca_path)
            except: pass
