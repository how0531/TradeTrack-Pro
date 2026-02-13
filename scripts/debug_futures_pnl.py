import shioaji as sj
import getpass
import time
from datetime import datetime, timedelta
import json

def debug_futures():
    print("=== Futures PnL Debug Tool ===")
    
    # Credentials
    person_id = input("Enter Person ID: ").strip().upper()
    password = getpass.getpass("Enter Password: ").strip()
    
    api = sj.Shioaji()
    
    try:
        print("\nLogging in...")
        accounts = api.login(person_id, password)
        print("Login success.")
        
        # Find Futures Account
        f_acc = None
        for acc in accounts:
            if "F" in str(getattr(acc, "account_type", "")).upper() or "FUTURE" in str(getattr(acc, "account_type", "")).upper():
                f_acc = acc
                break
        
        if not f_acc:
            print("❌ No Futures account found!")
            return

        print(f"\n🎯 Target Account: {f_acc.account_id} ({f_acc.broker_id})")
        
        start_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        end_date = datetime.now().strftime("%Y-%m-%d")
        print(f"📅 Date Range: {start_date} to {end_date}")

        # Test 1: list_profit_loss
        print("\n[Test 1] api.list_profit_loss() ...")
        try:
            pnl = api.list_profit_loss(f_acc, start_date, end_date)
            print(f"✅ Result: {len(pnl)} records found.")
            if pnl:
                print(f"   First record: {pnl[0]}")
        except Exception as e:
            print(f"❌ Failed: {e}")

        # Test 2: list_settlements (Often used for Futures PnL)
        print("\n[Test 2] api.list_settlements() ...")
        try:
            settlements = api.list_settlements(f_acc)
            # Filter by date manually just to see
            print(f"✅ Result: {len(settlements)} records found (Total).")
            if settlements:
                print(f"   First record: {settlements[0]}")
        except Exception as e:
            print(f"❌ Failed: {e}")

    except Exception as e:
        print(f"Fatal Error: {e}")
    finally:
        api.logout()

if __name__ == "__main__":
    debug_futures()
