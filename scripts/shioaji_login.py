import shioaji as sj
import os
import sys
import json
import base64
import tempfile
from datetime import datetime
from dotenv import load_dotenv


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
        try:
            # 建立臨時檔案
            with tempfile.NamedTemporaryFile(suffix=".pfx", delete=False) as tf:
                cert_data = base64.b64decode(ca_content)
                tf.write(cert_data)
                temp_ca_path = tf.name
            ca_path = temp_ca_path
            print(f"DEBUG: Using temporary CA from Base64: {ca_path}")
        except Exception as e:
            print(f"ERROR: Failed to process ca_content: {e}")

    # 2. 如果沒有臨時檔案，執行既有的 Fallback 邏輯
    elif not os.path.exists(ca_path):
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

    try:
        # 1. Login
        accounts = api.login(
            api_key=api_key, secret_key=secret_key, fetch_contract=True
        )

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

        # Priority 1: Look for a Stock Account that matches person_id (if available in acc)
        # Priority 2: Look for any Stock Account ("S")
        stock_acc = None

        # Try to find the BEST match
        for acc in accounts:
            if acc.account_type == "S":
                if not stock_acc:
                    stock_acc = acc
                # If we find one that matches the provided credentials ID, that's likely the one
                if hasattr(acc, "person_id") and acc.person_id == person_id:
                    stock_acc = acc
                    break

        if stock_acc:
            # broker_id is usually the branch code (4 digits)
            raw_broker_id = str(getattr(stock_acc, "broker_id", "Unknown")).strip()
            # Most Shioaji branch codes are 4 chars (e.g., 9A9J)
            branch_code = (
                raw_broker_id[:4] if len(raw_broker_id) >= 4 else raw_broker_id
            )
            username = getattr(stock_acc, "username", "User")
            print(
                f"DEBUG: Selected Stock Account: {stock_acc.account_id}, Branch: {branch_code}, User: {username}",
                flush=True,
            )
        elif accounts and len(accounts) > 0:
            # Fallback to first account if no stock account found
            stock_acc = accounts[0]
            raw_broker_id = str(getattr(stock_acc, "broker_id", "Unknown")).strip()
            branch_code = (
                raw_broker_id[:4] if len(raw_broker_id) >= 4 else raw_broker_id
            )
            username = getattr(stock_acc, "username", "User")
            print(
                f"DEBUG: No specific stock account found. Using first found: {stock_acc.account_id}, Branch: {branch_code}",
                flush=True,
            )
        else:
            print("DEBUG: No accounts found at all.", flush=True)
            return {
                "status": "error",
                "message": "No valid account found in this login session.",
            }

        # 3. Activate CA
        print(f"[LOGIN DEBUG] Activating CA: {ca_path}", flush=True)
        api.activate_ca(ca_path=ca_path, ca_passwd=ca_password, person_id=person_id)

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

        pnl_data = api.list_profit_loss(target_account, start_date, end_date)

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
        daily_results = [{"date": k, "pnl": int(v)} for k, v in daily_map.items()]

        return {
            "status": "success",
            "start_date": start_date,
            "end_date": end_date,
            "total_pnl": int(total_pnl),
            "daily_results": daily_results,
            "details": details,
            "details_count": len(details),
            "environment": "simulation" if simulation else "production",
            "branch_code": branch_code,
            "username": username,
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
