import shioaji as sj
import time
import os

# User Credentials - from environment variables or interactive input
API_KEY = os.getenv("SHIOAJI_API_KEY") or input("Enter API_KEY: ").strip()
SECRET_KEY = os.getenv("SHIOAJI_SECRET_KEY") or input("Enter SECRET_KEY: ").strip()
PERSON_ID = os.getenv("SHIOAJI_PERSON_ID") or input("Enter PERSON_ID: ").strip()
PFX_PATH = os.getenv("SHIOAJI_CA_PATH") or input("Enter PFX_PATH (e.g. C:\\ekey\\551\\...\\Sinopac.pfx): ").strip()
CA_PASS = os.getenv("SHIOAJI_CA_PASS") or input("Enter CA_PASSWORD: ").strip()

def check_status():
    print("=== Shioaji Simulation Status Check ===")
    
    api = sj.Shioaji()
    
    try:
        # 1. Login with API Key/Secret for Simulation Check
        print(f"\n[Login] Authenticating with ID: {PERSON_ID}...")
        
        accounts = api.login(
            api_key=API_KEY,
            secret_key=SECRET_KEY
        )
        print("LOGIN SUCCESSFUL!")
        
        # 2. Activate CA (Required for some operations, good to test if CA is valid too)
        if os.path.exists(PFX_PATH):
             print(f"[CA] Activating CA Certificate at {PFX_PATH}...")
             api.activate_ca(
                 ca_path=PFX_PATH,
                 ca_passwd=CA_PASS,
                 person_id=PERSON_ID
             )
             print("CA ACTIVATED!")
        else:
             print(f"CA File not found at {PFX_PATH}")

        # 3. Check Account Status
        print("\n[Account Status Report]")
        print(f"{'Account ID':<15} | {'Broker':<10} | {'Type':<10} | {'Signed (Passed?)':<20}")
        print("-" * 65)
        
        needs_testing = False
        
        for acc in accounts:
            acc_type = getattr(acc, "account_type", "Unknown")
            broker_id = getattr(acc, "broker_id", "Unknown")
            acc_id = getattr(acc, "account_id", "Unknown")
            signed = getattr(acc, "signed", False)
            
            status_text = "YES" if signed else "NO"
            print(f"{acc_id:<15} | {broker_id:<10} | {acc_type:<10} | {status_text}")
            
            if not signed:
                needs_testing = True
    
        print("-" * 65)
        
        if needs_testing:
            print("\nACTION REQUIRED: You have accounts that are 'Not Signed'.")
            print("You must complete the simulation test (Login + Place Order) for these accounts.")
            print("Please refer to: https://sinotrade.github.io/zh/tutor/prepare/terms/#api_1")
        else:
            print("\nAll accounts are Signed and Verified. You are good to go!")

    except Exception as e:
        print(f"\nLogin/Check Failed: {str(e)}")
    finally:
        api.logout()

if __name__ == "__main__":
    check_status()
