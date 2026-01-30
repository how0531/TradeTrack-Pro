import os
import time
import base64
import tempfile
from datetime import datetime, timedelta
from .session import get_session_manager
from .constants import BRANCH_MAP

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
            return {"error": f"CA Processing Failed: {str(e)}", "details": []}

    try:
        # 2. Get API Session
        manager = get_session_manager()
        api = manager.get_api(
            api_key, secret_key, person_id, final_ca_path, ca_password, simulation=simulation
        )
        
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

                bname = BRANCH_MAP.get(bid, "未知分公司") + f" ({atype})"
                choices.append({
                    "branch_code": str(bid),
                    "branch_name": str(bname),
                    "account_id": str(getattr(acc, "account_id", "")),
                    "account_type": str(atype),
                    "username": str(acc_name),
                    "environment": "simulation" if simulation else "production"
                })
            
            log(f"Returning Choices: {choices}")
            return {
                "status": "multiple_accounts",
                "accounts": choices,
                "environment": "simulation" if simulation else "production"
            }

        # 4. Fetch PnL (If logic reaches here, it means single account or filtered)
        # Default dates
        if not start_date:
            start_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        if not end_date:
            end_date = datetime.now().strftime("%Y-%m-%d")

        total_pnl = 0
        details = []
        
        for target_account in valid_accounts:
            try:
                acc_type_str = str(getattr(target_account, "account_type", "")).upper()
                is_futures = "F" in acc_type_str or "FUTURE" in acc_type_str
                is_sub = "H" in acc_type_str
                
                category = "期貨" if is_futures else ("複委託" if is_sub else "台股")
                
                log(f"Fetching PnL for {target_account.account_id} ({category})")
                pnl_data = api.list_profit_loss(target_account, start_date, end_date)
                
                if not pnl_data: continue
                
                for item in pnl_data:
                    code = getattr(item, "code", "Unknown")
                    realized = float(getattr(item, "pnl", 0))
                    item_date = str(getattr(item, "date", ""))
                    if len(item_date) == 8:
                        item_date = f"{item_date[:4]}-{item_date[4:6]}-{item_date[6:]}"
                    
                    raw_qty = int(getattr(item, "quantity", 0))
                    price = float(getattr(item, "price", 0))
                    buy_amt = float(getattr(item, "buy_amt", 0))
                    sell_amt = float(getattr(item, "sell_amt", 0))
                    
                    # Share quantity correction for Stocks
                    if not is_futures and not is_sub:
                        cond_str = str(getattr(item, "cond", "")).upper()
                        is_margin = any(x in cond_str for x in ["MARGIN", "SHORT", "融資", "融券"])
                        if is_margin and 0 < raw_qty < 500: raw_qty *= 1000
                        elif price > 0 and raw_qty > 0 and (max(buy_amt, sell_amt)) >= 500:
                             if ((max(buy_amt, sell_amt)) / price) > raw_qty * 800:
                                 raw_qty *= 1000

                    # Try to get Chinese Name (item_name/name are common in PnL objects)
                    name = str(getattr(item, "item_name", getattr(item, "name", getattr(item, "stock_name", "")))).strip()
                    
                    if not name or name == code:
                        try:
                            if is_futures:
                                # Futures lookup: nested under product codes (e.g., api.Contracts.Futures["TXF"]["TXFB6"])
                                # We search across categories to find the match
                                for category in api.Contracts.Futures:
                                    cat_obj = api.Contracts.Futures[category]
                                    if code in cat_obj:
                                        contract = cat_obj[code]
                                        name = getattr(contract, "name", "")
                                        break
                            elif is_sub:
                                # SubBrokerage lookup (複委託)
                                for exch in api.Contracts.SubBrokerage:
                                    exch_obj = api.Contracts.SubBrokerage[exch]
                                    if code in exch_obj:
                                        contract = exch_obj[code]
                                        name = getattr(contract, "name", "")
                                        break
                            else:
                                # For stocks: Index lookup is standard
                                contract = api.Contracts.Stocks[code]
                                if contract:
                                    name = getattr(contract, "name", "")
                        except:
                            pass

                    # If name found, append to code
                    display_code = f"{code} {name}".strip() if name and name != code else code
                    
                    details.append({
                        "date": item_date, 
                        "code": display_code, 
                        "price": price, 
                        "quantity": raw_qty, 
                        "pnl": realized, 
                        "orderNo": getattr(item, "dseq", ""),
                        "category": category,
                        "buyAmt": buy_amt,
                        "sellAmt": sell_amt
                    })
                    total_pnl += realized
            except Exception as e:
                log(f"Error fetching pnl for {target_account.account_id}: {e}")

        if temp_ca_path and os.path.exists(temp_ca_path):
            try: os.unlink(temp_ca_path)
            except: pass

        details.sort(key=lambda x: x["date"], reverse=True)
        
        # Get final metadata from the valid accounts
        final_branch = ""
        final_user = ""
        if valid_accounts:
            # Join all branch codes if multiple, otherwise just the one
            all_bids = sorted(list(set([str(getattr(acc, "broker_id", "")).strip()[:4] for acc in valid_accounts])))
            final_branch = ",".join(all_bids)
            
            acc = valid_accounts[0]
            final_user = getattr(acc, "username", getattr(acc, "name", ""))
            if not final_user:
                final_user = person_id[:3] + "*****" + person_id[-2:] if person_id else "User"

        return {
            "status": "success", 
            "total_pnl": total_pnl, 
            "details": details,
            "environment": "simulation" if simulation else "production",
            "branch_code": final_branch,
            "username": final_user
        }

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
