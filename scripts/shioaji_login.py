import shioaji as sj
import os
import sys
import json
import base64
import tempfile
from datetime import datetime
from dotenv import load_dotenv


BRANCH_MAP = {
    "9A95": "經紀部",
    "9A91": "松山",
    "9A92": "萬盛",
    "9A89": "敦北",
    "9A9d": "古亭",
    "9A9D": "忠孝",
    "9A9g": "內湖",
    "9A9G": "天母",
    "9A9R": "信義",
    "9A9S": "南京",
    "9A9U": "中正",
    "9A9Z": "復興",
    "9A9B": "中和",
    "9A9H": "新莊",
    "9A9i": "新店",
    "9A9J": "板新",
    "9A9K": "三重",
    "9A9Y": "板盛",
    "9A98": "大園",
    "9A99": "中壢",
    "9A9N": "桃盛",
    "9A9x": "桃園",
    "9A97": "新竹",
    "9A9X": "竹科",
    "9A9P": "竹北",
    "9A9Q": "豐原",
    "9A9L": "台中",
    "9A9W": "市政",
    "9A9M": "南投",
    "9A79": "埔里",
    "9A9s": "彰化",
    "9A9C": "員林",
    "9A9j": "嘉義",
    "9A9b": "虎尾",
    "9A9c": "永康",
    "9A9h": "台南",
    "9A9e": "高雄",
    "9A9r": "北高雄",
    "9A61": "鳳山",
    "9A9a": "苓雅",
    "9A9q": "潮州",
    "9A69": "屏東",
    "9A81": "匯立",
    "F002": "模擬分公司",
}


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
):
    temp_ca_path = None

    # 1. 如果有傳入 Base64 內容，優先建立臨時檔案
    if ca_content:
        print(f"DEBUG: Processing Base64 CA Content (Length: {len(ca_content)})")
        try:
            # 建立臨時檔案
            with tempfile.NamedTemporaryFile(suffix=".pfx", delete=False) as tf:
                cert_data = base64.b64decode(ca_content)
                tf.write(cert_data)
                temp_ca_path = tf.name
            ca_path = temp_ca_path
            print(f"DEBUG: Temporary CA created successfully at: {ca_path}")
            print(f"DEBUG: File exists check: {os.path.exists(ca_path)}")
            print(f"DEBUG: File size: {os.path.getsize(ca_path)} bytes")
        except Exception as e:
            print(f"ERROR: Failed to create temporary CA file: {e}")
            print(f"ERROR: Exception type: {type(e)}")
            import traceback

            traceback.print_exc()
    else:
        print("DEBUG: No Base64 CA content provided in request.")

    # 2. 如果沒有臨時檔案，執行既有的 Fallback 邏輯
    if not temp_ca_path and not os.path.exists(ca_path):
        # 1. 優先嘗試使用身分證字號命名的檔名 (例如 R124731212.pfx)
        id_fallback = os.path.join(os.path.dirname(__file__), "ca", f"{person_id}.pfx")

        # 2. 備案：嘗試使用原本的檔名 (例如 Sinopac.pfx)
        ca_filename = os.path.basename(ca_path)
        name_fallback = os.path.join(os.path.dirname(__file__), "ca", ca_filename)

        if os.path.exists(id_fallback):
            print(f"DEBUG: CA Path not found, using ID fallback: {id_fallback}")
            ca_path = id_fallback
        elif os.path.exists(name_fallback):
            print(f"DEBUG: CA Path not found, using filename fallback: {name_fallback}")
            ca_path = name_fallback
        else:
            print(
                f"DEBUG: CA Path not found locally, and no fallback in scripts/ca/ for ID: {person_id}"
            )

    # Set simulation to True based on user request/testing
    api = sj.Shioaji(simulation=simulation)
    environment = "simulation" if simulation else "production"

    try:
        # 1. Login
        try:
            accounts = api.login(
                api_key=api_key, secret_key=secret_key, fetch_contract=True
            )
        except Exception as login_err:
            # Capture Public IP for diagnosis if login crashes
            try:
                import requests

                ip_info = requests.get(
                    "https://api.ipify.org?format=json", timeout=3
                ).json()
                public_ip = ip_info.get("ip")
            except:
                public_ip = "Unknown"

            print(f"[ERROR] api.login failed: {login_err}")
            return {
                "status": "error",
                "message": f"Login Crashed. Server IP: {public_ip}. Error: {str(login_err)}",
            }

        # 2. Extract Basic Info & Select Stock Account
        print(
            f"\n[LOGIN DEBUG] Received API Key: {api_key[:5]}...{api_key[-5:] if len(api_key)>10 else ''}",
            flush=True,
        )
        print(f"[LOGIN DEBUG] Received Person ID: {person_id}", flush=True)

        print(f"DEBUG: Total accounts found: {len(accounts)}", flush=True)
        for i, acc in enumerate(accounts):
            print(
                f"DEBUG: Account[{i}]: ID={acc.account_id}, Type={acc.account_type}, Broker={acc.broker_id}, Name={getattr(acc, 'username', 'N/A')}",
                flush=True,
            )

        branch_code = "Unknown"
        username = "User"

        # Priority 1: Look for any Stock Account
        # Note: acc.account_type might be "S" (str) or AccountType.Stock (Enum)
        stock_acc = None
        debug_logs = []

        # Try to find the BEST match
        for acc in accounts:
            acc_type_str = str(getattr(acc, "account_type", "")).upper()
            acc_id = getattr(acc, "account_id", "N/A")
            p_id = getattr(acc, "person_id", "N/A")
            log_line = f"Check: ID={acc_id}, Type={acc_type_str}, PersonID={p_id}"
            debug_logs.append(log_line)
            print(f"DEBUG: {log_line}", flush=True)

            # Match "S", "P" (Production), or "STOCK" (Enum string representation)
            if any(x in acc_type_str for x in ["STOCK", "S", "P"]):
                # Filter out "FUTURES" or "H" if needed, but usually STOCK is unique enough
                if not stock_acc:
                    stock_acc = acc

                # Check for person_id match
                if hasattr(acc, "person_id") and acc.person_id == person_id:
                    stock_acc = acc
                    debug_logs.append(f"-> MATCHED PersonID: {p_id}")
                    break

        # Fallback 2: If no "S" or "P" account, take the first account available
        if not stock_acc and len(accounts) > 0:
            stock_acc = accounts[0]
            debug_logs.append(f"-> FALLBACK used: {stock_acc.account_id}")

        if stock_acc:
            raw_broker_id = str(getattr(stock_acc, "broker_id", "Unknown")).strip()
            # Most Shioaji branch codes are 4 chars (e.g., 9A9J)
            branch_code = (
                raw_broker_id[:4] if len(raw_broker_id) >= 4 else raw_broker_id
            )

            # Use username if available, otherwise use person_id or account_id
            origin_username = getattr(stock_acc, "username", "")
            if not origin_username or origin_username.lower() == "user":
                origin_username = person_id

            # Format as requested: 【Name】
            username = f"【{origin_username}】"

            # Branch Name resolution
            branch_name = BRANCH_MAP.get(branch_code, "未知分公司")

            # STRICT PRODUCTION CHECK
            # If we are in Production Mode (simulation=False), reject Mock branches.
            if not simulation and "模擬" in branch_name:
                return {
                    "status": "error",
                    "message": "Production mode required but Simulation account detected. Please check your credentials.",
                    "environment": environment,
                }

            print(
                f"[LOGIN DEBUG] Selected Account: {stock_acc.account_id}, Branch: {branch_code} ({branch_name}), User: {username}",
                flush=True,
            )

            # 3. Activate CA
            print(f"[LOGIN DEBUG] Activating CA: {ca_path}", flush=True)
            try:
                api.activate_ca(
                    ca_path=ca_path,
                    ca_passwd=ca_password,
                    person_id=person_id,
                )
                print("[LOGIN DEBUG] CA Activated Successfully", flush=True)
            except Exception as e:
                print(f"[ERROR] CA Activation Failed: {e}", flush=True)
                import traceback

                traceback.print_exc()
                return {"status": "error", "message": f"CA Activation Failed: {str(e)}"}

            # 4. Return Login Success Info + P&L Placeholder

            details = []
            daily_stats = []
            total_realized_pnl = 0

            if start_date and end_date:
                # 4. Fetch P&L (Realized)
                if not start_date:
                    start_date = datetime.now().strftime("%Y-%m-%d")
                if not end_date:
                    end_date = start_date

                # api.list_profit_loss returns realized P&L within the range
                target_account = stock_acc if stock_acc else api.stock_account
                print(
                    f"[LOGIN DEBUG] Requesting P&L for account: {target_account.account_id if target_account else 'NONE'}",
                    flush=True,
                )

                try:
                    pnl_data = api.list_profit_loss(
                        target_account, start_date, end_date
                    )
                except Exception as pnl_e:
                    print(f"[ERROR] P&L Fetch Failed: {pnl_e}")
                    pnl_data = []

                total_pnl = 0
                details = []
                daily_map = {}

                if pnl_data:
                    # 建立代碼快取以加速名稱查閱
                    code_name_map = {}

                    for item in pnl_data:
                        pnl_val = getattr(item, "pnl", 0)
                        tax_val = getattr(item, "tax", 0)
                        fee_val = getattr(item, "fee", 0)
                        raw_date = getattr(item, "date", start_date)
                        item_date = raw_date.replace("/", "-")
                        code = getattr(item, "code", "N/A")

                        # 嘗試取得股票名稱
                        if code not in code_name_map:
                            try:
                                contract = api.Contracts.Stocks[code]
                                code_name_map[code] = (
                                    contract.name if hasattr(contract, "name") else ""
                                )
                            except:
                                code_name_map[code] = ""

                        name = code_name_map.get(code, "")
                        display_code = f"{code} {name}".strip()

                        realized = pnl_val - tax_val - fee_val
                        total_pnl += realized

                        details.append(
                            {
                                "date": item_date,
                                "category": "現股",
                                "code": display_code,
                                "quantity": int(getattr(item, "quantity", 0)),
                                "price": float(getattr(item, "price", 0)),
                                "buyAmt": int(getattr(item, "buy_amt", 0)),
                                "sellAmt": int(getattr(item, "sell_amt", 0)),
                                "pnl": int(realized),
                                "yield": float(getattr(item, "yield", 0)),
                                "orderNo": getattr(item, "order_no", "N/A"),
                                "currency": "台幣",
                            }
                        )

                        if item_date not in daily_map:
                            daily_map[item_date] = 0
                        daily_map[item_date] += realized

                # Convert simple map to list of objects
                daily_results = [
                    {"date": k, "pnl": int(v)} for k, v in daily_map.items()
                ]
                total_realized_pnl = int(total_pnl)
                daily_stats = daily_results
            else:
                print(
                    "[LOGIN DEBUG] No start_date/end_date provided, skipping P&L fetch.",
                    flush=True,
                )
                daily_stats = []
                details = []
                total_realized_pnl = 0

            return {
                "status": "success",
                "message": "Login successful",
                "broker_id": raw_broker_id,
                "branch_code": branch_code,
                "username": username,
                "person_id": person_id,
                "branch": branch_name,
                "account_id": stock_acc.account_id,
                "environment": environment,
                "total_pnl": total_realized_pnl,
                "daily_results": daily_stats,
                "details": details,
                "details_count": len(details),
            }
        else:
            # Capture Public IP for diagnosis
            try:
                import requests

                ip_info = requests.get(
                    "https://api.ipify.org?format=json", timeout=3
                ).json()
                public_ip = ip_info.get("ip")
            except:
                public_ip = "Unknown"

            return {
                "status": "error",
                "message": f"Login Failed. Server IP: {public_ip}. Debug Info: {'; '.join(debug_logs)}",
            }

    except Exception as e:
        return {
            "status": "error",
            "message": str(e),
            "environment": "simulation" if simulation else "production",
        }
    finally:
        if temp_ca_path and os.path.exists(temp_ca_path):
            try:
                os.remove(temp_ca_path)
                print(f"DEBUG: Temporary CA deleted: {temp_ca_path}")
            except Exception as cleanup_err:
                print(f"ERROR: Failed to delete temporary CA: {cleanup_err}")


if __name__ == "__main__":
    # Usage: python shioaji_login.py <API_KEY> <SECRET> <ID> <CA_PATH> <CA_PASS> [START_DATE] [END_DATE]

    # Force simulation=True for this test script as requested
    SIMULATION_MODE = False

    if len(sys.argv) < 6:
        load_dotenv(".env.local")
        api_key = os.getenv("SHIOAJI_API_KEY")

        secret_key = os.getenv("SHIOAJI_SECRET_KEY")
        person_id = os.getenv("SHIOAJI_PERSON_ID")
        ca_path = os.getenv("SHIOAJI_CA_PATH")
        ca_pass = os.getenv("SHIOAJI_CA_PASS")

        # Test Default
        start_date = (
            sys.argv[1]
            if len(sys.argv) > 1 and sys.argv[1].startswith("20")
            else datetime.now().strftime("%Y-%m-%d")
        )
        end_date = (
            sys.argv[2]
            if len(sys.argv) > 2 and sys.argv[2].startswith("20")
            else start_date
        )

        if api_key and secret_key:
            res = login_and_fetch_pnl(
                api_key,
                secret_key,
                person_id,
                ca_path,
                ca_pass,
                start_date,
                end_date,
                SIMULATION_MODE,
            )
            print(json.dumps(res, indent=2))
        else:
            print(json.dumps({"status": "error", "message": "Missing credentials"}))
            sys.exit(1)
    else:
        # CLI Mode
        # argv[1]..argv[5] are creds
        # argv[6] = start_date
        # argv[7] = end_date (optional)
        start_date = sys.argv[6] if len(sys.argv) > 6 else None
        end_date = sys.argv[7] if len(sys.argv) > 7 else start_date

        res = login_and_fetch_pnl(
            sys.argv[1],
            sys.argv[2],
            sys.argv[3],
            sys.argv[4],
            sys.argv[5],
            start_date,
            end_date,
            SIMULATION_MODE,
        )
        print(json.dumps(res, indent=2))
