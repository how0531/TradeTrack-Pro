from flask import Flask, request, jsonify
from flask_cors import CORS
import sys
import os
import traceback

# 添加 core 目錄到路徑 (如果尚未添加) - 雖然通常在同一包下不需要，但為了確保
# sys.path.append(os.path.join(os.path.dirname(__file__), "core"))

try:
    from core.pnl import login_and_fetch_pnl
    import core.pnl
    import os
    import datetime
    log_file = os.path.join(os.path.expanduser("~"), "debug_backend.log")
    with open(log_file, "a") as f:
        f.write(f"[{datetime.datetime.now()}] LOADED PNL FROM: {core.pnl.__file__}\n")
    print(f"DEBUG: Imported login_and_fetch_pnl from core.pnl: {core.pnl.__file__}", flush=True)
except ImportError as e:
    print(f"Error importing core.pnl: {e}")
    # Fallback for dev environment path issues
    try: 
        from backend.core.pnl import login_and_fetch_pnl
        print(f"DEBUG: Imported login_and_fetch_pnl from backend.core.pnl: {login_and_fetch_pnl}", flush=True)
    except:
        print(f"Critical Import Error: {e}")
        raise

app = Flask(__name__)
CORS(app)  # 允許跨域請求 (Cloud 佈署必備)


@app.route("/", methods=["GET"])
def index():
    import shioaji

    return (
        jsonify(
            {
                "status": "online",
                "message": "TradeTrack-Pro Backend is active.",
                "version": "v1.3.1",
                "shioaji_version": getattr(shioaji, "__version__", "unknown"),
                "endpoints": ["/health", "/api/broker/profile", "/api/broker/pnl"],
            }
        ),
        200,
    )


@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({"status": "ok", "message": "Backend is running"}), 200


@app.route("/api/broker/profile", methods=["POST"])
def get_broker_profile():
    try:
        data = request.json
        print(f"\n{'='*20} PROFILE REQUEST {'='*20}", flush=True)
        print(f"Keys received: {list(data.keys())}", flush=True)
        print(f"Person ID: {data.get('personId')}", flush=True)
        print(f"CA Path: {data.get('caPath')}", flush=True)

        required_fields = ["apiKey", "apiSecret", "personId", "caPath", "caPassword"]
        missing_fields = [field for field in required_fields if not data.get(field)]

        if missing_fields:
            error_msg = f"缺少必要欄位 (Missing fields): {', '.join(missing_fields)}"
            print(f"[ERROR] {error_msg}", flush=True)
            return jsonify({"status": "error", "message": error_msg}), 400



        # 從請求中獲取環境設定，預設為正式環境
        env_pref = data.get("environment", "production")
        is_simulation = env_pref == "simulation"

        result = login_and_fetch_pnl(
            api_key=data["apiKey"],
            secret_key=data["apiSecret"],
            person_id=data["personId"],
            ca_path=data["caPath"],
            ca_password=data["caPassword"],
            ca_content=data.get("caContent"),
            start_date=None,
            end_date=None,
            simulation=is_simulation,
            branch_filter=data.get("branchCode"),  # Pass the branch filter
        )

        print(f"[RESULT] Status: {result.get('status')}", flush=True)

        if result.get("status") == "error":
            return jsonify(result), 400

        # Handle the new "multiple_accounts" status for frontend selection
        if result.get("status") == "multiple_accounts":
            return jsonify(result)

        # Standardize for frontend (camelCase)
        response = {
            "status": "success",
            "username": result.get("username", "Unknown"),
            "branchCode": result.get("branch_code", "Unknown"),
            "environment": result.get("environment", "unknown"),
            "apiKeyHint": (
                f"{data['apiKey'][:4]}...{data['apiKey'][-4:]}"
                if data.get("apiKey")
                else "Unknown"
            ),
        }
        return jsonify(response)

    except Exception as e:
        print(f"\n[EXCEPTION] Profile Error: {str(e)}", flush=True)
        traceback.print_exc()
        error_response = jsonify({"status": "error", "message": str(e)})
        return error_response, 500


@app.route("/api/broker/pnl", methods=["POST"])
def get_broker_pnl():
    """
    獲取券商損益資料
    """
    try:
        data = request.json
        print(f"\n{'='*20} PNL REQUEST {'='*20}", flush=True)
        print(
            f"Date Range: {data.get('startDate')} to {data.get('endDate')}", flush=True
        )

        required_fields = [
            "apiKey",
            "apiSecret",
            "personId",
            "caPath",
            "caPassword",
            "startDate",
            "endDate",
        ]
        missing_fields = [field for field in required_fields if not data.get(field)]

        if missing_fields:
            error_msg = f"缺少必要欄位 (Missing fields): {', '.join(missing_fields)}"
            print(f"[ERROR] {error_msg}", flush=True)
            return jsonify({"status": "error", "message": error_msg}), 400

        # 從請求中獲取環境設定
        env_pref = data.get("environment", "production")
        is_simulation = env_pref == "simulation"

        result = login_and_fetch_pnl(
            api_key=data["apiKey"],
            secret_key=data["apiSecret"],
            person_id=data["personId"],
            ca_path=data["caPath"],
            ca_password=data["caPassword"],
            ca_content=data.get("caContent"),
            start_date=data["startDate"],
            end_date=data["endDate"],
            simulation=is_simulation,
            branch_filter=data.get("branchCode"),  # Pass the branch filter
            type_filter=data.get("accountType"),   # Pass strict account type filter
        )

        print(
            f"[RESULT] Status: {result.get('status')} | Items: {result.get('details_count', 0)}",
            flush=True,
        )

        if result.get("status") == "error":
            return jsonify(result), 400

        # Mapping to frontend-friendly keys
        response = {
            "status": "success",
            "total_pnl": result.get("total_pnl", 0),
            "daily_results": result.get("daily_results", []),
            "details": result.get("details", []),
            "username": result.get("username"),
            "branchCode": result.get("branch_code"),
        }
        return jsonify(response)

    except Exception as e:
        print(f"\n[EXCEPTION] P&L Error: {str(e)}", flush=True)
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 500


if __name__ == "__main__":
    print("=" * 60)
    print("TradeTrack Pro - Backend Service (Cloud Ready)")
    print("=" * 60)

    # Cloud platforms set PORT environment variable
    port = int(os.environ.get("PORT", 5000))

    print(f"Server starting on http://0.0.0.0:{port}", flush=True)

    # Run locally (for cloud we use gunicorn)
    # 啟用 debug=True 以支援熱重載 (Hot Reload)
    app.run(host="0.0.0.0", port=port, debug=True)
