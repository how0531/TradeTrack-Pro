import os
import sys
import requests
import base64
import shioaji as sj
import json
from dotenv import load_dotenv

# Load env
env_path = os.path.join(os.path.dirname(__file__), "..", ".env.local")
load_dotenv(env_path)

API_URL = "https://tradetrack-backend-8h4x.onrender.com"


def check_cloud_version():
    print(f"\n[1] Checking Cloud Version at {API_URL}...")
    try:
        resp = requests.get(API_URL, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            print(f"    Status: {data.get('status')}")
            print(f"    Version: {data.get('version', 'Unknown')}")
            print(f"    Shioaji Lib: {data.get('shioaji_version', 'Unknown')}")
            return data
        else:
            print(f"    ERROR: Status {resp.status_code}")
            return None
    except Exception as e:
        print(f"    ERROR: {e}")
        return None


def test_local_shioaji():
    print(f"\n[2] Testing LOCAL Shioaji Login (Python Direct)...")
    api_key = os.getenv("SHIOAJI_API_KEY")
    secret_key = os.getenv("SHIOAJI_SECRET_KEY")
    person_id = os.getenv("SHIOAJI_PERSON_ID")
    ca_path = os.getenv("SHIOAJI_CA_PATH")
    ca_pass = os.getenv("SHIOAJI_CA_PASS")

    if not all([api_key, secret_key, person_id, ca_path, ca_pass]):
        print("    ERROR: Missing credentials in .env.local")
        return

    print(f"    Person ID: {person_id}")
    print(f"    CA Path: {ca_path} (Exists: {os.path.exists(ca_path)})")

    try:
        api = sj.Shioaji(simulation=False)
        print("    Logging in...")
        accounts = api.login(
            api_key=api_key, secret_key=secret_key, fetch_contract=False
        )
        print(f"    Accounts Found: {len(accounts)}")
        for acc in accounts:
            print(f"    - {acc.account_type} {acc.account_id} {acc.broker_id}")

        print("    Activating CA...")
        result = api.activate_ca(
            ca_path=ca_path, ca_passwd=ca_pass, person_id=person_id
        )
        print(f"    CA Activation Result: {result}")
        print("    [SUCCESS] Local Login OK!")
    except Exception as e:
        print(f"    [FAILURE] Local Login Failed: {e}")
        import traceback

        traceback.print_exc()


def test_remote_login():
    print(f"\n[3] Testing REMOTE Cloud Login (POST /api/broker/profile)...")

    # Read and encode CA file
    ca_path = os.getenv("SHIOAJI_CA_PATH")
    if not ca_path or not os.path.exists(ca_path):
        print("    ERROR: CA Path invalid")
        return

    with open(ca_path, "rb") as f:
        ca_content = base64.b64encode(f.read()).decode("utf-8")

    payload = {
        "apiKey": os.getenv("SHIOAJI_API_KEY"),
        "apiSecret": os.getenv("SHIOAJI_SECRET_KEY"),
        "personId": os.getenv("SHIOAJI_PERSON_ID"),
        "caPath": "cloud_upload.pfx",
        "caPassword": os.getenv("SHIOAJI_CA_PASS"),
        "caContent": ca_content,
    }

    try:
        resp = requests.post(f"{API_URL}/api/broker/profile", json=payload, timeout=60)
        print(f"    Status: {resp.status_code}")
        if resp.status_code == 200:
            print("    [SUCCESS] Remote Login OK!")
            print(f"    Response: {resp.json()}")
        else:
            print("    [FAILURE] Remote Login Failed")
            print(f"    Body: {resp.text}")
    except Exception as e:
        print(f"    [EXCEPTION] {e}")


if __name__ == "__main__":
    check_cloud_version()
    test_local_shioaji()
    test_remote_login()
