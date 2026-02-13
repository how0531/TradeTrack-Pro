import shioaji as sj
import getpass
import time
from datetime import datetime, timedelta

def verify_account():
    print("=== Shioaji Account Verification Tool ===")
    print("This script will help you verify your account status and API permissions.")
    
    # 1. Credentials
    person_id = input("Enter Person ID (身分證字號): ").strip().upper()
    password = getpass.getpass("Enter Password (密碼): ").strip()
    
    api = sj.Shioaji()
    
    try:
        # 2. Login
        print("\n[Authenticating] Logging in...")
        accounts = api.login(person_id, password)
        print("✅ Login Successful!")
        print(f"found {len(accounts)} accounts.")
        
        # 3. List Accounts
        print("\n[Account Details]")
        for i, acc in enumerate(accounts):
            acc_type = getattr(acc, "account_type", "Unknown")
            broker_id = getattr(acc, "broker_id", "Unknown")
            acc_id = getattr(acc, "account_id", "Unknown")
            username = getattr(acc, "username", "Unknown")
            signed = getattr(acc, "signed", False)
            
            print(f"{i+1}. [{broker_id}] {acc_id} ({acc_type}) - {username} | Signed: {signed}")
            
            # Check for specific branch code previously reported
            if "9A92" in str(broker_id):
                print(f"   ⚠️  Note: This account belongs to branch 9A92 (Wan Sheng).")

        # 4. Test PnL Query
        print("\n[Testing PnL Query for Stock Accounts]")
        start_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        end_date = datetime.now().strftime("%Y-%m-%d")
        
        for acc in accounts:
            acc_type_str = str(getattr(acc, "account_type", "")).upper()
            is_futures = "F" in acc_type_str or "FUTURE" in acc_type_str
            is_sub = "H" in acc_type_str or "SUB" in acc_type_str
            
            print(f"\n--- Testing Account: {acc.account_id} ({acc.broker_id}) ---")
            
            if is_futures:
                print("   ℹ️  Skipping PnL query (Futures account not supported by list_profit_loss)")
                continue
                
            if is_sub:
                print("   ℹ️  Skipping PnL query (Sub-brokerage account not supported by list_profit_loss)")
                continue
                
            try:
                print(f"   🔄 Querying PnL ({start_date} to {end_date})...")
                pnl = api.list_profit_loss(acc, start_date, end_date)
                print(f"   ✅ Success! Retrieved {len(pnl)} records.")
            except Exception as e:
                print(f"   ❌ Failed: {str(e)}")
                if "406" in str(e) or "Account Not Acceptable" in str(e):
                    print("   💡 Diagnosis: This specific account does not support the PnL query API.")

    except Exception as e:
        print(f"\n❌ Fatal Error: {str(e)}")
    finally:
        api.logout()
        print("\n=== Verification Complete ===")

if __name__ == "__main__":
    verify_account()
