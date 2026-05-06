from flask import Flask, request, jsonify
from flask_cors import CORS
import sys
import os
import traceback

# 添加 core 目錄到路徑 (如果尚未添加) - 雖然通常在同一包下不需要，但為了確保
# sys.path.append(os.path.join(os.path.dirname(__file__), "core"))

try:
    from core.pnl import login_and_fetch_pnl, verify_simulation_account
    from core import job_store
    print(f"DEBUG: Imported core modules successfully", flush=True)
except ImportError as e:
    print(f"Error importing core.pnl: {e}")
    # Fallback for dev environment path issues
    try: 
        from backend.core.pnl import login_and_fetch_pnl, verify_simulation_account
        from backend.core import job_store
        print(f"DEBUG: Imported from backend.core.pnl (fallback)", flush=True)
    except:
        print(f"Critical Import Error: {e}")
        raise

app = Flask(__name__)
# Explicitly allow all origins for debugging, or specify frontend URL
CORS(app, resources={r"/*": {"origins": "*"}})

# 伺服器重啟後，把上一輪還卡在 pending/running 的任務標為 error，
# 讓前端輪詢時能拿到明確訊息而不是 404。
try:
    _orphan_count = job_store.recover_orphaned_jobs()
    if _orphan_count:
        print(
            f"♻️  [STARTUP] 偵測到 {_orphan_count} 個上一輪未完成的同步任務，"
            f"已標記為 error（請用戶重新執行）",
            flush=True,
        )
except Exception as _e:
    print(f"[STARTUP] recover_orphaned_jobs failed: {_e}", flush=True)


@app.route("/", methods=["GET"])
def index():
    import shioaji

    return (
        jsonify(
            {
                "status": "online",
                "message": "TradeTrack-Pro Backend is active.",
                "version": "v1.5.4",
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
        print(f"Person ID: {_mask_id(data.get('personId'))}", flush=True)
        print(f"CA Path: {data.get('caPath')}", flush=True)

        required_fields = ["apiKey", "apiSecret", "personId", "caPassword"]
        missing_fields = [field for field in required_fields if not data.get(field)]
        # caPath OR caContent is required (caContent takes priority for cloud deployment)
        if not data.get("caPath") and not data.get("caContent"):
            missing_fields.append("caPath (or caContent)")

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
            branch_filter=data.get("branchCode"),
            profile_only=True,  # M4: 只需登入列帳號，跳過 PnL 抓取
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
            "signedAccounts": result.get("signed_accounts", []),
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

        required_fields = ["apiKey", "apiSecret", "personId", "caPassword", "startDate", "endDate"]
        missing_fields = [field for field in required_fields if not data.get(field)]
        if not data.get("caPath") and not data.get("caContent"):
            missing_fields.append("caPath (or caContent)")

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
            "ca_status": result.get("ca_status"),           # 透傳 CA 狀態
            "empty_reason": result.get("empty_reason"),     # 透傳空結果原因
            "account_summaries": result.get("account_summaries", []),
            "empty_diagnostic": result.get("empty_diagnostic"),
            "date_range_used": result.get("date_range_used"),
            "summary": result.get("summary", {})  # Pass through the new summary
        }
        return jsonify(response)

    except Exception as e:
        print(f"\n[EXCEPTION] P&L Error: {str(e)}", flush=True)
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 500


# ==========================================
# 🚀 異步 Job 系統端點 (V3.0.4 導入)
# ==========================================

from threading import Thread


def _mask_id(pid: str) -> str:
    """遮罩 personId / 身分證字號等 PII，僅露尾 3 碼做問題追蹤用"""
    if not pid:
        return "<empty>"
    s = str(pid)
    return "***" + s[-3:] if len(s) > 3 else "***"

def _run_pnl_job(job_id, data):
    """背景執行 PnL 同步的工作執行緒"""
    env_pref = data.get("environment", "production")
    is_simulation = env_pref == "simulation"
    
    # 建立一個拋轉進度的小型回呼函數
    def prog_cb(pct, msg):
        job_store.update_job_progress(job_id, pct, msg)

    try:
        job_store.update_job_progress(job_id, 1, "啟動背景同步...")
        
        result = login_and_fetch_pnl(
            api_key=data["apiKey"],
            secret_key=data["apiSecret"],
            person_id=data["personId"],
            ca_path=data["caPath"],
            ca_password=data["caPassword"],
            ca_content=data.get("caContent"),
            start_date=data.get("startDate"),
            end_date=data.get("endDate"),
            simulation=is_simulation,
            branch_filter=data.get("branchCode"),
            type_filter=data.get("accountType"),
            progress_callback=prog_cb
        )
        
        if result.get("status") == "error":
            job_store.fail_job(job_id, result.get("message", "未知錯誤"))
        else:
            # 轉換為前端預期的格式
            final_result = {
                "status": "success",
                "total_pnl": result.get("total_pnl", 0),
                "daily_results": result.get("daily_results", []),
                "details": result.get("details", []),
                "username": result.get("username"),
                "branchCode": result.get("branch_code"),
                "ca_status": result.get("ca_status"),
                "empty_reason": result.get("empty_reason"),
                "account_summaries": result.get("account_summaries", []),
                "empty_diagnostic": result.get("empty_diagnostic"),
                "date_range_used": result.get("date_range_used"),
                "summary": result.get("summary", {})
            }
            job_store.complete_job(job_id, final_result)
            
    except Exception as e:
        print(f"❌ [Job Failed] {job_id}: {str(e)}", flush=True)
        traceback.print_exc()
        job_store.fail_job(job_id, str(e))
        
    finally:
        # 定期清理老舊任務 (順便執行)
        job_store.cleanup_old_jobs()

@app.route("/api/jobs/pnl", methods=["POST"])
def create_pnl_job():
    """建立非同步券商損益查詢 Job"""
    try:
        data = request.json
        print(f"\n{'='*20} CREATING ASYNC PNL JOB {'='*20}", flush=True)

        required_fields = ["apiKey", "apiSecret", "personId", "caPassword", "startDate", "endDate"]
        missing_fields = [field for field in required_fields if not data.get(field)]
        if not data.get("caPath") and not data.get("caContent"):
            missing_fields.append("caPath (or caContent)")

        if missing_fields:
            error_msg = f"缺少必要欄位: {', '.join(missing_fields)}"
            return jsonify({"status": "error", "message": error_msg}), 400

        # 分配 Job ID
        job_id = job_store.create_job()
        
        # 啟動背景執行緒
        thread = Thread(target=_run_pnl_job, args=(job_id, data))
        thread.daemon = True
        thread.start()
        
        return jsonify({"status": "success", "job_id": job_id})
        
    except Exception as e:
        print(f"\n[EXCEPTION] Create Job Error: {str(e)}", flush=True)
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/jobs/<job_id>/status", methods=["GET"])
def get_job_status(job_id):
    """輪詢 Job 的執行進度與狀態"""
    status = job_store.get_job_status(job_id)
    if not status:
        return jsonify({
            "status": "error",
            "reason": "job_not_found",
            "message": "找不到此同步任務 (任務可能已逾期被清理，或從未建立)。請重新執行同步。"
        }), 404

    return jsonify({"status": "success", "job": status})

@app.route("/api/jobs/<job_id>/result", methods=["GET"])
def get_job_result(job_id):
    """拿取 Job 最終完成的結果"""
    job = job_store.get_job_result(job_id)
    if not job:
        return jsonify({
            "status": "error",
            "reason": "job_not_found",
            "message": "找不到此同步任務結果 (任務可能已逾期被清理)。請重新執行同步。"
        }), 404
        
    if job["status"] != "done":
        return jsonify({
            "status": "error", 
            "message": f"任務尚未完成，目前狀態: {job['status']}"
        }), 400
        
    return jsonify(job["result"])

# ==========================================


@app.route("/api/broker/verify", methods=["POST"])
def verify_broker_account():
    """
    執行模擬下單以開通 API 權限
    """
    try:
        data = request.json
        print(f"\n{'='*20} VERIFICATION REQUEST {'='*20}", flush=True)
        print(f"Account: {_mask_id(data.get('accountId'))}", flush=True)

        required_fields = ["apiKey", "apiSecret", "personId", "caPassword", "accountId"]
        missing_fields = [field for field in required_fields if not data.get(field)]
        if not data.get("caPath") and not data.get("caContent"):
            missing_fields.append("caPath (or caContent)")

        if missing_fields:
            return jsonify({"status": "error", "message": f"缺少必要欄位: {', '.join(missing_fields)}"}), 400

        # B10: verify_simulation_account is now imported at top-level
        
        result = verify_simulation_account(
            api_key=data["apiKey"],
            secret_key=data["apiSecret"],
            person_id=data["personId"],
            ca_path=data["caPath"],
            ca_password=data["caPassword"],
            ca_content=data.get("caContent"),
            account_id=data["accountId"]
        )

        return jsonify(result)

    except Exception as e:
        print(f"\n[EXCEPTION] Verification Error: {str(e)}", flush=True)
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/stock/info/<code_input>", methods=["GET"])
def get_stock_info_route(code_input):
    """
    獲取股票資訊 (目前僅名稱)
    """
    try:
        from core.stock_info import fetch_stock_name
        
        # Security check: Ensure code is alphanumeric only
        if not code_input.isalnum():
             return jsonify({"status": "error", "message": "Invalid code format"}), 400
             
        name = fetch_stock_name(code_input)
        
        if name:
            return jsonify({
                "status": "success",
                "code": code_input,
                "name": name
            })
        else:
             # Try fallback to mocked database or common list if fetch fails?
             # For now, just return not found
             return jsonify({"status": "error", "message": "Stock not found"}), 404
             
    except Exception as e:
        print(f"[StockInfo Error] {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


if __name__ == "__main__":
    print("=" * 60)
    print("TradeTrack Pro - Backend Service (Cloud Ready)")
    print("=" * 60)

    # Cloud platforms set PORT environment variable
    port = int(os.environ.get("PORT", 5000))

    print(f"Server starting on http://0.0.0.0:{port}", flush=True)

    # B11: debug mode via env var, defaults to False for production safety
    is_debug = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'
    app.run(host="0.0.0.0", port=port, debug=is_debug)
