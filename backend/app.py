from flask import Flask, request, jsonify
from flask_cors import CORS
import logging
import os
import re

# ─── Logging ──────────────────────────────────────────────────────────────
# Single source of truth for all backend output. Render / Docker tail stdout,
# so a single line format keeps container logs readable. Set LOG_LEVEL env to
# override (DEBUG / INFO / WARNING / ERROR).
logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("tradetrack.backend")

# ─── Imports ──────────────────────────────────────────────────────────────
# Two valid invocation paths:
#   1. `python app.py` from inside backend/   → `from core.pnl` works
#   2. `python -m backend.app` from repo root → `from backend.core.pnl` works
# We try the package-relative form first (more explicit), then fall back to
# the in-directory form. Anything else is a real configuration error.
try:
    from backend.core.pnl import login_and_fetch_pnl, verify_simulation_account
    from backend.core import job_store
except ImportError:
    from core.pnl import login_and_fetch_pnl, verify_simulation_account  # type: ignore[no-redef]
    from core import job_store  # type: ignore[no-redef]

app = Flask(__name__)

# CORS.
# Auth model note: every /api/broker/* request carries the user's own broker
# credentials (apiKey/secret/personId/caPassword/.pfx) in the request body —
# there is no server-side cookie/session. So the Origin allowlist provides
# little real security (an attacker still needs the user's own credentials),
# but a too-strict allowlist silently breaks every deployed frontend with a
# CORS error that surfaces as "backend won't wake".
#
# Therefore:
#   - If ALLOWED_ORIGINS is set, honour it exactly (operator full control).
#   - Otherwise default to a generous set covering THIS app's own hosting
#     targets — localhost (dev) plus regexes for Netlify (incl. dynamic
#     deploy-preview-* URLs), Zeabur and Render — instead of localhost-only,
#     which was blocking production/preview frontends.
_allowed_origins_env = os.environ.get("ALLOWED_ORIGINS", "").strip()
if _allowed_origins_env:
    _allowed_origins = [o.strip() for o in _allowed_origins_env.split(",") if o.strip()]
else:
    _allowed_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        # Any *.netlify.app subdomain — covers all the app's Netlify sites
        # (tradetrack1 / tradetrack888 / tttttt8888) and dynamic
        # deploy-preview-N--<site>.netlify.app URLs in one pattern.
        re.compile(r"^https://[a-z0-9-]+\.netlify\.app$"),
        re.compile(r"^https://[a-z0-9-]+\.zeabur\.app$"),
        re.compile(r"^https://[a-z0-9-]+\.onrender\.com$"),
    ]
CORS(app, resources={r"/*": {"origins": _allowed_origins}}, supports_credentials=True)
logger.info("CORS allowed origins: %s", _allowed_origins)

# 伺服器重啟後，把上一輪還卡在 pending/running 的任務標為 error，
# 讓前端輪詢時能拿到明確訊息而不是 404。
try:
    _orphan_count = job_store.recover_orphaned_jobs()
    if _orphan_count:
        logger.info(
            "Recovered %d orphaned sync jobs (marked as error)",
            _orphan_count,
        )
except Exception:
    logger.exception("recover_orphaned_jobs failed")


@app.route("/", methods=["GET"])
def index():
    import shioaji

    return (
        jsonify(
            {
                "status": "online",
                "message": "TradeTrack-Pro Backend is active.",
                "version": "v1.5.5",
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
        logger.info(
            "Profile request — personId=%s caPath=%s keys=%s",
            _mask_id(data.get("personId")),
            data.get("caPath"),
            list(data.keys()),
        )

        required_fields = ["apiKey", "apiSecret", "personId", "caPassword"]
        missing_fields = [field for field in required_fields if not data.get(field)]
        # caPath OR caContent is required (caContent takes priority for cloud deployment)
        if not data.get("caPath") and not data.get("caContent"):
            missing_fields.append("caPath (or caContent)")

        if missing_fields:
            error_msg = f"缺少必要欄位 (Missing fields): {', '.join(missing_fields)}"
            logger.warning("Profile request rejected: %s", error_msg)
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

        logger.info("Profile result status=%s", result.get("status"))

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
        logger.exception("Profile request failed")
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/broker/pnl", methods=["POST"])
def get_broker_pnl():
    """
    獲取券商損益資料
    """
    try:
        data = request.json
        logger.info(
            "PnL request — startDate=%s endDate=%s",
            data.get("startDate"),
            data.get("endDate"),
        )

        required_fields = ["apiKey", "apiSecret", "personId", "caPassword", "startDate", "endDate"]
        missing_fields = [field for field in required_fields if not data.get(field)]
        if not data.get("caPath") and not data.get("caContent"):
            missing_fields.append("caPath (or caContent)")

        if missing_fields:
            error_msg = f"缺少必要欄位 (Missing fields): {', '.join(missing_fields)}"
            logger.warning("PnL request rejected: %s", error_msg)
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

        logger.info(
            "PnL result status=%s details_count=%s",
            result.get("status"),
            result.get("details_count", 0),
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
        logger.exception("PnL request failed")
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
        logger.exception("PnL job %s failed", job_id)
        job_store.fail_job(job_id, str(e))

    finally:
        # 定期清理老舊任務 (順便執行)
        job_store.cleanup_old_jobs()

@app.route("/api/jobs/pnl", methods=["POST"])
def create_pnl_job():
    """建立非同步券商損益查詢 Job"""
    try:
        data = request.json
        logger.info("Creating async PnL job")

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
        logger.exception("Create job failed")
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
        logger.info("Verification request for account=%s", _mask_id(data.get("accountId")))

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
        logger.exception("Verification request failed")
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
        logger.exception("Stock info lookup failed for %s", code_input)
        return jsonify({"status": "error", "message": str(e)}), 500


if __name__ == "__main__":
    # Cloud platforms set PORT environment variable
    port = int(os.environ.get("PORT", 5000))
    # B11: debug mode via env var, defaults to False for production safety
    is_debug = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'

    logger.info("TradeTrack Pro backend starting on 0.0.0.0:%s (debug=%s)", port, is_debug)
    app.run(host="0.0.0.0", port=port, debug=is_debug)
