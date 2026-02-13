import os
import time
import base64
import tempfile
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
            import tempfile
            tf = tempfile.NamedTemporaryFile(delete=False, suffix=".pfx")
            tf.write(base64.b64decode(ca_content))
            tf.close()
            temp_ca_path = tf.name
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
        if not manager.ca_activated:
            log("⚠️ CA NOT ACTIVATED — PnL queries may return empty results!")
            if not ca_content and (not ca_path or not os.path.exists(ca_path)):
                return {
                    "status": "error",
                    "message": "CA 憑證未啟動：雲端伺服器找不到 .pfx 檔案。請在設定頁面重新上傳憑證檔案 (.pfx)。",
                    "details": [],
                    "ca_error": True
                }
        
        # 3. List Accounts
        try:
            accounts = api.list_accounts()
        except:
            time.sleep(1)
            accounts = api.list_accounts()
            
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
                
                if acc_branch in allowed or acc_id in allowed:
                    valid_accounts.append(acc)
            else:
                valid_accounts.append(acc)
        
        log(f"Filtered to {len(valid_accounts)} valid accounts.")

        if len(valid_accounts) > 1 and not branch_filter:
            choices = []
            for acc in valid_accounts:
                bid = str(getattr(acc, "broker_id", "Unknown")).strip()[:4]
                raw_type = str(getattr(acc, "account_type", "??"))
                atype = raw_type.replace("AccountType.", "")
                
                # Try to get username, fallback to masked person_id
                acc_name = getattr(acc, "username", getattr(acc, "name", ""))
                if not acc_name:
                    acc_name = person_id[:3] + "*****" + person_id[-2:] if person_id else "User"

                # Get branch name with logging for unknown codes
                if bid in BRANCH_MAP:
                    bname = BRANCH_MAP[bid] + f" ({atype})"
                else:
                    log(f"⚠️ [BRANCH_MAP] Unknown branch code: {bid} - Please update constants.py")
                    bname = f"未知分公司[{bid}] ({atype})"

                # determine simplified category
                category = "Stock"
                if "FUTURE" in atype.upper() or "F" in atype.upper(): category = "Futures"
                elif "SUB" in atype.upper() or "H" in atype.upper(): category = "SubBrokerage"
                elif bid in ["F002", "9162"]: category = "Futures" # Fallback by known branch

                choices.append({
                    "branch_code": str(bid),
                    "branch_name": str(bname),
                    "account_id": str(getattr(acc, "account_id", "")),
                    "account_type": str(atype),
                    "category": category, # Explicit Category
                    "username": str(acc_name),
                    "signed": bool(getattr(acc, "signed", False)), # New field
                    "environment": "simulation" if simulation else "production"
                })
            
            log(f"Returning Choices: {choices}")
            return {
                "status": "multiple_accounts",
                "accounts": choices,
                "environment": "simulation" if simulation else "production"
            }

        # 4. Fetch PnL (If logic reaches here, it means single account or filtered)
        # 4. Fetch PnL Parallel Execution
        # Default dates
        if not start_date:
            start_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        if not end_date:
            end_date = datetime.now().strftime("%Y-%m-%d")

        import concurrent.futures
        
        # Internal Worker Function (Closure to capture log/api context)
        def fetch_worker(target_account):
            acc_pnl = 0
            acc_details = []
            acc_equity = 0    # New: 權益數
            acc_open_pnl = 0  # New: 未平倉損益
            
            try:
                acc_type_str = str(getattr(target_account, "account_type", "")).upper()
                is_futures = "F" in acc_type_str or "FUTURE" in acc_type_str
                is_sub = "H" in acc_type_str
                
                category = "期貨" if is_futures else ("複委託" if is_sub else "台股")
                
                log(f"🚀 [Thread Start] Fetching {target_account.account_id} ({category})")
                
                # 1. 複委託 (Sub-brokerage) - Skip (Not supported)
                if is_sub:
                     log(f"ℹ️ [Skip PnL] Skipping PnL for Sub-brokerage account {target_account.account_id}")
                     return 0, acc_details, 0, 0

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

                candidates = []
                max_attempts = 2
                import random
                time.sleep(random.uniform(0.1, 0.5))

                # 3. 核心 PnL 抓取 (Unified Logic for Stock & Futures)
                # 使用 list_profit_loss (已驗證期貨也有資料)
                for attempt in range(max_attempts):
                    try:
                        try:
                            current_pnl = api.list_profit_loss(target_account, start_date, end_date)
                        except Exception as api_e:
                            err_str = str(api_e)
                            if "406" in err_str or "Account Not Acceptable" in err_str:
                                log(f"ℹ️ [Skip 406] Account {target_account.account_id} not supported by list_profit_loss.")
                                current_pnl = []
                            else:
                                raise api_e 
                        
                        count = len(current_pnl) if current_pnl else 0
                        log(f"🔍 [API Fetch] {target_account.account_id} Attempt {attempt+1}/{max_attempts}: Found {count} records.")
                        
                        if current_pnl and count > 0:
                            candidates.append(current_pnl)
                            
                        if attempt < max_attempts - 1:
                            time.sleep(0.5) 

                    except Exception as e:
                        if "406" in str(e): break
                        log(f"❌ [API Error] {target_account.account_id} Attempt {attempt+1}: {str(e)}")
                        time.sleep(0.5)

                # Decision Logic
                pnl_data = [] 
                if candidates:
                    candidates.sort(key=len, reverse=True)
                    pnl_data = candidates[0]
                
                for item in pnl_data:
                    try:
                        code = getattr(item, "code", "Unknown")
                        realized = round(float(getattr(item, "pnl", 0)), 4)
                        item_date = str(getattr(item, "date", ""))
                        if len(item_date) == 8:
                            item_date = f"{item_date[:4]}-{item_date[4:6]}-{item_date[6:]}"
                        
                        raw_qty = int(getattr(item, "quantity", 0))
                        price = round(float(getattr(item, "price", 0)), 4)
                        buy_amt = round(float(getattr(item, "buy_amt", 0)), 4)
                        sell_amt = round(float(getattr(item, "sell_amt", 0)), 4)
                        
                        # Share quantity correction (Stock only)
                        if not is_futures and not is_sub:
                            cond_str = str(getattr(item, "cond", "")).upper()
                            is_margin = any(x in cond_str for x in ["MARGIN", "SHORT", "融資", "融券"])
                            if is_margin and 0 < raw_qty < 500: raw_qty *= 1000
                            elif price > 0 and raw_qty > 0 and (max(buy_amt, sell_amt)) >= 500:
                                 if ((max(buy_amt, sell_amt)) / price) > raw_qty * 800:
                                     raw_qty *= 1000

                        # Helper to resolve names
                        def resolve_name(code, is_futures):
                           FUTURES_NAMES = {
                               'TXF': '台指期', 'MTX': '小台指', 'TE': '電子期', 'MTE': '小電子期',
                               'TF': '金融期', 'T5F': '櫃買期', 'UNF': '非金電期', 'GTF': '黃金期',
                               'XIF': '東證期', 'SP': 'S&P期', 'ND': '那斯達克期',
                           }
                           name = ""
                           if is_futures and len(code) >= 2:
                                for prefix in [code[:3].upper(), code[:2].upper()]:
                                    if prefix in FUTURES_NAMES: 
                                        name = FUTURES_NAMES[prefix]
                                        break
                           if "臺股期" in name: name = "台指期"
                           elif "小型臺指" in name: name = "小台指"
                           return name

                        name = getattr(item, "name", "") or resolve_name(code, is_futures)
                        
                        if name and name != code:
                            display_code = name if code in name else f"{code} {name}"
                        else:
                            display_code = code
                        
                        acc_details.append({
                            "date": item_date, 
                            "code": display_code, 
                            "price": price, 
                            "quantity": raw_qty, 
                            "pnl": realized, 
                            "orderNo": getattr(item, "dseq", ""),
                            "category": category,
                            "buyAmt": buy_amt,
                            "sellAmt": sell_amt,
                            "entryPrice": float(getattr(item, "entry_price", 0)),
                            "exitPrice": float(getattr(item, "cover_price", 0)),
                            "yield": round(float(getattr(item, "pr_ratio", 0)) * 100, 2),
                            "accountId": target_account.account_id
                        })
                        acc_pnl += realized
                    except Exception as item_e:
                         log(f"❌ [Item Error] {getattr(item, 'code', '?')}: {item_e}")
                         continue
                         
                return acc_pnl, acc_details, acc_equity, acc_open_pnl

            except Exception as e:
                log(f"❌ [Worker Error] {target_account.account_id}: {e}")
                import traceback
                log(traceback.format_exc())
                return 0, [], 0, 0

        
        total_pnl = 0
        details = []
        total_equity = 0      # New: 總權益數
        total_open_pnl = 0    # New: 總未平倉損益
        
        # Threads
        import concurrent.futures
        max_workers = min(len(valid_accounts), 5) if len(valid_accounts) > 0 else 1
        log(f"🚀 Starting Parallel Execution with {max_workers} workers...")
        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
             future_to_acc = {executor.submit(fetch_worker, acc): acc for acc in valid_accounts}
             
             for future in concurrent.futures.as_completed(future_to_acc):
                 acc = future_to_acc[future]
                 try:
                     # Unpack 4 values now
                     pnl, acc_dets, equity, open_pnl = future.result()
                     
                     if pnl != 0 or acc_dets:
                         total_pnl += pnl
                         details.extend(acc_dets)
                    
                     # Aggregate Futures Data
                     total_equity += equity
                     total_open_pnl += open_pnl
                     log(f"✅ [Thread Done] {acc.account_id} finished via {acc.broker_id}")
                         
                 except Exception as exc:
                     log(f"❌ [Thread Exception] {acc.account_id} generated an exception: {exc}")

        if temp_ca_path and os.path.exists(temp_ca_path):
            try: os.unlink(temp_ca_path)
            except: pass

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

        log(f"✅ [Done] PnL: {total_pnl}, Items: {len(details)}, Equity: {total_equity}")
        
        return result

    except Exception as e:
        import traceback
        log(f"Exception: {str(e)}")
        if temp_ca_path and os.path.exists(temp_ca_path):
             try: os.unlink(temp_ca_path)
             except: pass
        return {
            "status": "error", 
            "error": str(e), 
            "details": [],
            "environment": "simulation" if simulation else "production"
        }

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
