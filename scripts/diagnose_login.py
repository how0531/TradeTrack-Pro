import os
import sys
import requests
import base64
from dotenv import load_dotenv

# 新增路徑以便導入
sys.path.append(os.path.dirname(__file__))


def test_remote_login():
    print("=== [DIAGNOSE] Starting REMOTE Cloud Login Test ===")

    # 1. 讀取 .env.local
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env.local")
    load_dotenv(env_path)

    api_key = os.getenv("SHIOAJI_API_KEY")
    secret_key = os.getenv("SHIOAJI_SECRET_KEY")
    person_id = os.getenv("SHIOAJI_PERSON_ID")
    ca_path = os.getenv("SHIOAJI_CA_PATH")
    ca_pass = os.getenv("SHIOAJI_CA_PASS")
    # remote_url = os.getenv("VITE_API_URL", "http://localhost:5000")
    # Force use of the specific URL requested by user
    remote_url = "https://tradetrack-backend-8h4x.onrender.com"

    print(f"DEBUG: Testing Target URL: {remote_url}")
    print(f"DEBUG: Person ID: {person_id}")

    if not api_key or not secret_key:
        print("ERROR: Missing API Key or Secret in .env.local")
        return

    # 2. 準備 Payload (包含 Base64 Certificate)
    ca_content = ""
    if ca_path and os.path.exists(ca_path):
        try:
            with open(ca_path, "rb") as f:
                ca_content = base64.b64encode(f.read()).decode("utf-8")
            print(f"DEBUG: CA Certificate prepared (Length: {len(ca_content)})")
        except Exception as e:
            print(f"ERROR: Failed to read CA file: {e}")
            return
    else:
        print(f"ERROR: CA Path not found: {ca_path}")
        return

    payload = {
        "apiKey": api_key,
        "apiSecret": secret_key,
        "personId": person_id,
        "caPath": "cloud_upload.pfx",  # 雲端會忽略這個路徑，只看內容
        "caPassword": ca_pass,
        "caContent": ca_content,
    }

    # 3. 發送請求
    try:
        target_endpoint = f"{remote_url}/api/broker/profile"
        print(f"DEBUG: Sending POST to {target_endpoint}...")

        response = requests.post(target_endpoint, json=payload, timeout=30)

        print(f"DEBUG: Status Code: {response.status_code}")

        if response.status_code == 200:
            result = response.json()
            print("\n[SUCCESS] REMOTE LOGIN SUCCESSFUL!")
            print(f"Username: {result.get('username')}")
            print(f"Branch: {result.get('branch')} ({result.get('branchCode')})")
            print(f"Environment: {result.get('environment')}")
        else:
            print("\n[FAILURE] REMOTE LOGIN FAILED!")
            print(f"Status: {response.status_code}")
            try:
                print(f"Response: {response.text}")
            except:
                pass

    except Exception as e:
        print(f"\n[EXCEPTION] connection Error: {str(e)}")


if __name__ == "__main__":
    test_remote_login()
