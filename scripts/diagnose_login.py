import os
import sys
from dotenv import load_dotenv

# 新增路徑以便導入
sys.path.append(os.path.dirname(__file__))
from shioaji_login import login_and_fetch_pnl


def test_local_login():
    print("=== [DIAGNOSE] Starting Local Login Test ===")

    # 1. 讀取 .env.local
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env.local")
    load_dotenv(env_path)

    api_key = os.getenv("SHIOAJI_API_KEY")
    secret_key = os.getenv("SHIOAJI_SECRET_KEY")
    person_id = os.getenv("SHIOAJI_PERSON_ID")
    ca_path = os.getenv("SHIOAJI_CA_PATH")
    ca_pass = os.getenv("SHIOAJI_CA_PASS")

    print(f"DEBUG: Person ID: {person_id}")
    print(f"DEBUG: CA Path exists: {os.path.exists(ca_path) if ca_path else False}")

    if not api_key or not secret_key:
        print("ERROR: Missing API Key or Secret in .env.local")
        return

    # 2. 執行登入邏輯 (模擬非仿真環境，測試真實登入)
    try:
        print("DEBUG: Calling login_and_fetch_pnl (simulation=False)...")
        result = login_and_fetch_pnl(
            api_key=api_key,
            secret_key=secret_key,
            person_id=person_id,
            ca_path=ca_path,
            ca_password=ca_pass,
            simulation=False,  # 真實環境測試
        )

        if result["status"] == "success":
            print("\n[SUCCESS] LOGIN SUCCESSFUL!")
            print(f"Username: {result.get('username')}")
            print(f"Branch: {result.get('branch')} ({result.get('branch_code')})")
            print(f"Realized P&L: {result.get('total_pnl')}")
        else:
            print("\n[FAILURE] LOGIN FAILED!")
            print(f"Message: {result.get('message')}")

    except Exception as e:
        print(f"\n[EXCEPTION] Error: {str(e)}")


if __name__ == "__main__":
    test_local_login()
