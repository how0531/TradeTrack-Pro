import sys
import os
import time
import statistics
from datetime import datetime, timedelta

# User-provided Shioaji check
import shioaji as sj

def run_stress_test():
    print("==============================================")
    print("🚀 API Stability Stress Test (10 Iterations)")
    print("==============================================")
    print("This script will fetch PnL data 10 times for the last 90 days.")
    print("Objective: Measure data consistency and loss rate.")
    
    # User Credentials Input
    api_key = input("Enter API Key: ").strip()
    secret_key = input("Enter Secret Key: ").strip()
    person_id = input("Enter Person ID: ").strip()
    
    # PFX Path Handling
    default_pfx = os.path.join(os.getcwd(), 'Sinopac.pfx')
    pf_path = input(f"Enter PFX Certificate Path [Default: {default_pfx}]: ").strip() or default_pfx
    pf_password = input("Enter PFX Password: ").strip()

    if not api_key or not secret_key:
        print("❌ Missing credentials. Aborting.")
        return

    # Initialize API
    api = sj.Shioaji()
    try:
        print(f"🔌 Connecting to Shioaji API...")
        api.login(
            api_key=api_key,
            secret_key=secret_key,
            contracts_cb=lambda security_type: print(f"   Shape of {security_type} contracts is {api.Contracts[security_type]}")
        )
        api.activate_ca(
            ca_path=pf_path,
            ca_passwd=pf_password,
            person_id=person_id,
        )
        print("✅ Login & CA Activation Successful.")
    except Exception as e:
        print(f"❌ Login Failed: {str(e)}")
        return

    # Get Account
    accounts = api.list_accounts()
    futures_acc = next((acc for acc in accounts if "Future" in str(acc.account_type) or "F" in str(acc.account_type) or "H" in str(acc.account_type)), None)
    
    if not futures_acc:
        print("❌ No Futures/Sub-Brokerage account found.")
        return
        
    print(f"📋 Target Account: {futures_acc.account_id} ({futures_acc.username})")

    # Define Range (90 Days)
    end_date = datetime.now().strftime("%Y-%m-%d")
    start_date = (datetime.now() - timedelta(days=90)).strftime("%Y-%m-%d")
    print(f"📅 Date Range: {start_date} to {end_date}")
    
    results = []
    
    print("\n🔄 Starting 10 Iterations...")
    for i in range(1, 11):
        print(f"   Attempt {i}/10...", end="", flush=True)
        try:
            start_t = time.time()
            # Direct API call, bypassing pnl.py wrapper to test raw stability
            data = api.list_profit_loss(futures_acc, start_date, end_date)
            duration = time.time() - start_t
            count = len(data) if data else 0
            results.append(count)
            print(f" Done. Found: {count} records ({duration:.2f}s)")
            
            # Rate limit protection
            time.sleep(1.5) 
        except Exception as e:
            print(f" Failed: {e}")
            results.append(-1) # Error marker

    # Analysis
    report_content = []
    report_content.append("\n📊 Analysis Report")
    report_content.append("==============================================")
    
    valid_results = [r for r in results if r >= 0]
    if not valid_results:
        report_content.append("❌ All attempts failed.")
        print("\n".join(report_content))
        return

    max_count = max(valid_results)
    min_count = min(valid_results)
    avg_count = statistics.mean(valid_results)
    mode_count = statistics.mode(valid_results)
    
    stability_count = valid_results.count(max_count)
    stability_rate = (stability_count / len(valid_results)) * 100
    loss_rate = 100 - stability_rate
    
    report_content.append(f"Max Records (Baseline): {max_count}")
    report_content.append(f"Min Records:            {min_count}")
    report_content.append(f"Average Records:        {avg_count:.2f}") 
    report_content.append(f"Mode (Most Common):     {mode_count}")
    report_content.append(f"Stability Score:        {stability_rate:.1f}% ({stability_count}/{len(valid_results)} matching max)")
    report_content.append(f"Inconsistency Rate:     {loss_rate:.1f}%")
    
    report_content.append("\n📌 Detail Log:")
    for idx, count in enumerate(results):
        status = "✅ Perfect" if count == max_count else f"⚠️ Missing {max_count - count} records"
        if count == -1: status = "❌ Error"
        report_content.append(f"   Run {idx+1}: {count} records - {status}")

    report_content.append("\n📝 Conclusion:")
    if loss_rate == 0:
        report_content.append("   ✅ The API is currently STABLE. No data loss detected.")
    elif loss_rate < 50:
        report_content.append("   ⚠️ The API is UNSTABLE but usable with retry logic.")
    else:
        report_content.append("   🔴 The API is HIGHLY UNSTABLE. Multiple retries are mandatory.")

    # Output to Console
    full_report = "\n".join(report_content)
    print(full_report)
    
    # Save to File
    with open("stability_report.txt", "w", encoding="utf-8") as f:
        f.write(full_report)
    print("\n💾 Report saved to: stability_report.txt")

if __name__ == "__main__":
    run_stress_test()
