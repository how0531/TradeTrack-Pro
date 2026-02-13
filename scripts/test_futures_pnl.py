
import shioaji as sj
import json
import os
import sys
from datetime import datetime, timedelta

# Create a Shioaji instance
api = sj.Shioaji()

def main():
    print("="*60)
    print("TradeTrack Pro - Futures PnL Discovery Tool")
    print("="*60)

    # 1. Login (Interactive)
    api_key = input("Enter API_KEY: ").strip()
    secret_key = input("Enter SECRET_KEY: ").strip()
    person_id = input("Enter PERSON_ID: ").strip()
    
    if not api_key or not secret_key or not person_id:
        print("Error: All fields are required.")
        return

    try:
        print("\nLogging in...")
        accounts = api.login(api_key, secret_key, person_id=person_id)
        print("Login success!")
    except Exception as e:
        print(f"Login failed: {e}")
        return

    # 2. Find Futures Account
    fut_account = None
    for acc in accounts:
        if "Future" in str(acc.account_type):
            fut_account = acc
            break
    
    if not fut_account:
        print("❌ No Futures account found.")
        return

    print(f"\n✅ Found Futures Account: {fut_account.account_id}")

    # 3. Test list_settlements (Most likely for Realized PnL)
    print("\n[Test 1] Fetching Settlements (list_settlements)...")
    try:
        # Fetch last 30 days
        settlements = api.list_settlements(fut_account, timeout=10000)
        print(f"Result count: {len(settlements)}")
        if settlements:
            print("First item sample:")
            print(settlements[0])
    except Exception as e:
        print(f"Error fetching settlements: {e}")

    # 4. Test list_profit_loss (Confirming it fails or returns empty)
    print("\n[Test 2] Fetching Profit/Loss (list_profit_loss)...")
    try:
        pnl = api.list_profit_loss(fut_account, timeout=10000)
        print(f"Result count: {len(pnl)}")
        if pnl:
            print(pnl[0])
    except Exception as e:
        print(f"Error (Expected): {e}")

    print("\nDone.")

if __name__ == "__main__":
    main()
