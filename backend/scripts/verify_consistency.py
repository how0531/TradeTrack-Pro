import sys
import os
import json
import time
from datetime import datetime, timedelta

# Add backend to path to import core modules
sys.path.append(os.getcwd())

try:
    from backend.core.session import get_session_manager
    # We'll use the API directly to have full control
except ImportError:
    print("❌ Error: Please run this script from the project root directory.")
    print("   Example: python backend/scripts/verify_consistency.py")
    sys.exit(1)

def main():
    print("="*60)
    print("🛠️  TradeTrack Pro - Data Consistency Verifier")
    print("="*60)
    print("此腳本將執行兩次完全相同的 Shioaji API 查詢，並比對結果。")
    print("⚠️  注意：執行此測試可能會踢掉您目前運行的後端連線 (Single Login)。")
    print("-" * 60)

    # 1. Get Credentials
    print("請輸入您的 Shioaji 帳戶資訊 (僅用於本地測試，不會上傳):")
    api_key = input("API Key: ").strip()
    secret_key = input("Secret Key: ").strip()
    person_id = input("Person ID (身分證): ").strip()
    ca_path = input("CA Path (憑證 .pfx 路徑): ").strip().strip('"') # Handle quotes from copy-paste
    ca_password = input("CA Password: ").strip()
    
    if not os.path.exists(ca_path):
        print(f"❌ Error: 憑證檔案不存在: {ca_path}")
        return

    # 2. Setup Session
    print("\n[Step 1] Connecting to Shioaji API...")
    manager = get_session_manager()
    try:
        api = manager.get_api(
            api_key=api_key,
            secret_key=secret_key,
            person_id=person_id,
            ca_path=ca_path,
            ca_password=ca_password,
            simulation=False # Real production data
        )
    except Exception as e:
        print(f"❌ Connection Failed: {e}")
        return

    # 3. List Accounts to find Futures account
    print("\n[Step 2] Listing Accounts...")
    accounts = api.list_accounts()
    futures_acc = None
    for acc in accounts:
        acc_type = str(getattr(acc, "account_type", "")).upper()
        if "F" in acc_type or "FUTURE" in acc_type:
            futures_acc = acc
            break
            
    if not futures_acc:
        print("❌ Error: No Futures account found!")
        return
        
    print(f"✅ Found Futures Account: {futures_acc.account_id} ({futures_acc.broker_id})")

    # 4. Define Test Parameters
    end_dt = datetime.now()
    start_dt = end_dt - timedelta(days=30)
    start_date = start_dt.strftime("%Y-%m-%d")
    end_date = end_dt.strftime("%Y-%m-%d")
    
    print(f"\n[Test Config] Period: {start_date} ~ {end_date} (Last 30 days)")

    # 5. Run Test 1
    print("\n🚀 Running Fetch #1...")
    t1_start = time.time()
    try:
        pnl1 = api.list_profit_loss(futures_acc, start_date, end_date)
        # Force convert to list of dicts for comparison
        data1 = []
        if pnl1:
            for item in pnl1:
                data1.append({
                    "code": getattr(item, "code", ""),
                    "date": getattr(item, "date", ""),
                    "price": float(getattr(item, "price", 0)),
                    "pnl": float(getattr(item, "pnl", 0)),
                    "quantity": float(getattr(item, "quantity", 0))
                })
    except Exception as e:
        print(f"❌ Fetch #1 Failed: {e}")
        return
        
    print(f"✅ Fetch #1 Completed in {time.time() - t1_start:.2f}s. Found {len(data1)} records.")

    # 6. Wait
    print("\n⏳ Waiting 3 seconds before next fetch...")
    time.sleep(3)

    # 7. Run Test 2
    print("\n🚀 Running Fetch #2...")
    t2_start = time.time()
    try:
        pnl2 = api.list_profit_loss(futures_acc, start_date, end_date)
        data2 = []
        if pnl2:
            for item in pnl2:
                data2.append({
                    "code": getattr(item, "code", ""),
                    "date": getattr(item, "date", ""),
                    "price": float(getattr(item, "price", 0)),
                    "pnl": float(getattr(item, "pnl", 0)),
                    "quantity": float(getattr(item, "quantity", 0))
                })
    except Exception as e:
        print(f"❌ Fetch #2 Failed: {e}")
        return

    print(f"✅ Fetch #2 Completed in {time.time() - t2_start:.2f}s. Found {len(data2)} records.")

    # 8. Compare
    print("\n" + "="*60)
    print("📊 COMPARISON RESULT")
    print("="*60)
    
    if len(data1) != len(data2):
        print(f"❌ MISMATCH: Count differs! #1={len(data1)}, #2={len(data2)}")
    else:
        print(f"✅ Count Matches: {len(data1)} records")
        
    # Serialize for deep comparison
    json1 = json.dumps(sorted(data1, key=lambda x: x['code']+x['date']), default=str)
    json2 = json.dumps(sorted(data2, key=lambda x: x['code']+x['date']), default=str)
    
    if json1 == json2:
        print("✅ CONTENT PERFECT MATCH: All data fields are identical.")
    else:
        print("❌ CONTENT MISMATCH: The data content is different!")
        # Find numeric difference
        total_pnl1 = sum(d['pnl'] for d in data1)
        total_pnl2 = sum(d['pnl'] for d in data2)
        print(f"   Total PnL #1: {total_pnl1}")
        print(f"   Total PnL #2: {total_pnl2}")
        print(f"   Diff: {total_pnl1 - total_pnl2}")

    print("\nDone.")

if __name__ == "__main__":
    main()
