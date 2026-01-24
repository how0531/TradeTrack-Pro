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
    branch_filter=None,
):
    temp_ca_path = None

    # 1. 如果有傳入 Base64 內容，優先建立臨時檔案
    if ca_content:
        print(f"DEBUG: Processing Base64 CA Content (Length: {len(ca_content)})")
        try:
            with tempfile.NamedTemporaryFile(suffix=".pfx", delete=False) as tf:
                cert_data = base64.b64decode(ca_content)
                tf.write(cert_data)
                temp_ca_path = tf.name
            ca_path = temp_ca_path
        except Exception as e:
            print(f"ERROR: Failed to create temporary CA file: {e}")

    try:
        # 根據 SKILL.md 標準範例：明確指定 simulation 模式
        print(f"DEBUG: Initializing Shioaji (simulation={simulation})", flush=True)
        api = sj.Shioaji(simulation=simulation)

        # 2. 執行登入（Profile 驗證時不需載入全部合約，避免超時）
        print(f"DEBUG: Logging in with API Key...", flush=True)
        accounts = api.login(
            api_key=api_key,
            secret_key=secret_key,
            fetch_contract=False,  # Profile 驗證階段不需要合約資料
        )
        print(f"DEBUG: Login successful. Found {len(accounts)} account(s).", flush=True)

        environment = "production" if not simulation else "simulation"

        # Extract Valid Stock Accounts
        valid_accounts = []
        for acc in accounts:
            acc_type_str = str(getattr(acc, "account_type", "")).upper()
            p_id = getattr(acc, "person_id", "N/A")

            # Match Stock accounts (S, P, or STOCK)
            if any(x in acc_type_str for x in ["STOCK", "S", "P"]):
                raw_bid = str(getattr(acc, "broker_id", "Unknown")).strip()
                b_code = raw_bid[:4] if len(raw_bid) >= 4 else raw_bid
                b_name = BRANCH_MAP.get(b_code, "未知分公司")

                # Filter out mock accounts in production
                if not simulation and ("模擬" in b_name or b_code == "F002"):
                    continue

                # Check for person_id match
                if p_id == person_id:
                    # Apply Branch Filter if provided
                    if branch_filter and b_code != branch_filter:
                        continue
                    valid_accounts.append(acc)

        if not valid_accounts:
            return {
                "status": "error",
                "message": f"登入失敗：找不到指定的證券帳號 (ID: {person_id}, 分公司過濾: {branch_filter or '無'})。",
                "environment": environment,
            }

        # If multiple accounts found AND NO FILTER provided -> Ask user to choose
        if len(valid_accounts) > 1 and not branch_filter:
            choices = []
            for acc in valid_accounts:
                bid = str(getattr(acc, "broker_id", "Unknown")).strip()[:4]
                choices.append(
                    {
                        "branch_code": bid,
                        "branch_name": BRANCH_MAP.get(bid, "未知分公司"),
                        "account_id": acc.account_id,
                    }
                )
            return {
                "status": "multiple_accounts",
                "accounts": choices,
                "message": "偵測到多個分公司帳號，請選擇其一。",
            }

        primary_acc = valid_accounts[0]
        branches = []
        for acc in valid_accounts:
            bid = str(getattr(acc, "broker_id", "Unknown")).strip()[:4]
            name = BRANCH_MAP.get(bid, "未知分公司")
            if name not in branches:
                branches.append(name)

        branch_name = ", ".join(branches)
        branch_code = str(getattr(primary_acc, "broker_id", "Unknown")).strip()[:4]

        origin_username = getattr(primary_acc, "username", "")
        if origin_username and origin_username.lower() != "user":
            username = f"【{origin_username}】"
        else:
            username = person_id

        # 3. Activate CA
        ca_status = "Not Attempted"
        try:
            if not os.path.exists(ca_path):
                # Try CWD fallback
                cwd_path = os.path.join(os.getcwd(), os.path.basename(ca_path))
                if os.path.exists(cwd_path):
                    ca_path = cwd_path

            api.activate_ca(
                ca_path=ca_path,
                ca_passwd=ca_password,
                person_id=person_id,
            )
            ca_status = "Success"
        except Exception as e:
            print(f"[WARNING] CA Activation Failed: {e}", flush=True)
            ca_status = f"Failed: {str(e)}"

        # 4. Fetch P&L
        details = []
        daily_stats = []
        total_realized_pnl = 0

        if start_date and end_date:
            total_pnl = 0
            daily_map = {}
            code_name_map = {}

            # We iterate through the valid_accounts (if filter provided, it's just one)
            for target_account in valid_accounts:
                try:
                    pnl_data = api.list_profit_loss(
                        target_account, start_date, end_date
                    )
                    if pnl_data:
                        for item in pnl_data:
                            realized = getattr(item, "pnl", 0)
                            yield_ratio = getattr(item, "pr_ratio", 0)
                            yield_pct = float(yield_ratio) * 100
                            raw_date = getattr(item, "date", start_date)
                            item_date = raw_date.replace("/", "-")
                            code = getattr(item, "code", "N/A")
                            order_no = getattr(
                                item, "dseq", getattr(item, "seqno", "N/A")
                            )

                            if code not in code_name_map:
                                try:
                                    contract = api.Contracts.Stocks[code]
                                    code_name_map[code] = (
                                        contract.name
                                        if hasattr(contract, "name")
                                        else ""
                                    )
                                except:
                                    code_name_map[code] = ""

                            name = code_name_map.get(code, "")
                            display_code = f"{code} {name}".strip()

                            total_pnl += realized
                            details.append(
                                {
                                    "date": item_date,
                                    "category": getattr(item, "cond", "現股"),
                                    "code": display_code,
                                    "quantity": int(getattr(item, "quantity", 0)),
                                    "price": float(getattr(item, "price", 0)),
                                    "buyAmt": int(getattr(item, "buy_amt", 0)),
                                    "sellAmt": int(getattr(item, "sell_amt", 0)),
                                    "pnl": int(realized),
                                    "yield": round(yield_pct, 2),
                                    "orderNo": order_no,
                                    "currency": "台幣",
                                    "account": target_account.account_id,
                                }
                            )

                            if item_date not in daily_map:
                                daily_map[item_date] = 0
                            daily_map[item_date] += realized
                except Exception as pnl_e:
                    print(
                        f"[ERROR] P&L Fetch Failed for {target_account.account_id}: {pnl_e}",
                        flush=True,
                    )

            daily_stats = [{"date": k, "pnl": int(v)} for k, v in daily_map.items()]
            total_realized_pnl = int(total_pnl)

        return {
            "status": "success",
            "message": "Login successful",
            "branch_code": branch_code,
            "username": username,
            "person_id": person_id,
            "branch": branch_name,
            "account_id": primary_acc.account_id,
            "environment": environment,
            "total_pnl": total_realized_pnl,
            "daily_results": daily_stats,
            "details": details,
            "details_count": len(details),
            "ca_status": ca_status,
        }

    except Exception as login_err:
        return {
            "status": "error",
            "message": f"Login Failed: {str(login_err)}",
        }
    finally:
        # Cleanup temp file
        if temp_ca_path and os.path.exists(temp_ca_path):
            try:
                os.remove(temp_ca_path)
            except:
                pass


if __name__ == "__main__":
    if len(sys.argv) < 6:
        print(json.dumps({"status": "error", "message": "Missing arguments"}))
        sys.exit(1)

    # Simple CLI wrapper
    p_api_key = sys.argv[1]
    p_secret = sys.argv[2]
    p_id = sys.argv[3]
    p_ca_path = sys.argv[4]
    p_ca_pass = sys.argv[5]
    p_start = sys.argv[6] if len(sys.argv) > 6 else None
    p_end = sys.argv[7] if len(sys.argv) > 7 else p_start

    res = login_and_fetch_pnl(
        p_api_key,
        p_secret,
        p_id,
        p_ca_path,
        p_ca_pass,
        start_date=p_start,
        end_date=p_end,
        simulation=False,
    )
    print(json.dumps(res, indent=2))
