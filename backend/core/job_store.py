import uuid
import time
import threading
import sqlite3
import json
import os

# ==========================================
# 持久化 Job 儲存 (SQLite)
# ------------------------------------------
# 原本使用記憶體 dict 儲存背景同步任務，但免費雲端平台
# (Render / Zeabur free tier) 會因閒置休眠或 OOM 重啟，
# 造成 _jobs 被清空 -> 前端輪詢 404 -> 顯示「伺服器已重新啟動」。
#
# 解法：把 job metadata 寫到 SQLite，伺服器重啟後狀態仍在。
# 注意：不儲存憑證/payload，只存 job 進度與結果。
# ==========================================

_DEFAULT_DB_PATH = os.environ.get(
    "JOB_STORE_DB",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "jobs.db"),
)
_db_path = os.path.abspath(_DEFAULT_DB_PATH)
_lock = threading.Lock()


def _open_db() -> sqlite3.Connection:
    # 單一常駐連線：WAL + autocommit (isolation_level=None)。
    # Flask polling 會每 ~1-5 秒打一次 /status，原本每次都 open/close
    # 連線在免費雲端小機器上是明顯的額外開銷；常駐連線直接省掉。
    # check_same_thread=False 允許多執行緒共用，配合 _lock 序列化即可。
    conn = sqlite3.connect(
        _db_path,
        timeout=10,
        isolation_level=None,
        check_same_thread=False,
    )
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS jobs (
            id TEXT PRIMARY KEY,
            status TEXT NOT NULL,
            progress INTEGER NOT NULL DEFAULT 0,
            progress_msg TEXT,
            result TEXT,
            error TEXT,
            created_at REAL NOT NULL,
            updated_at REAL NOT NULL
        )
        """
    )
    return conn


_db = _open_db()


def recover_orphaned_jobs() -> int:
    """
    伺服器啟動時呼叫：把上一輪仍在 pending / running 的任務
    標記為 error，並附上明確原因，讓前端可以呈現「伺服器重啟」的狀態，
    而不是卡在永遠不會完成的 running 狀態。
    """
    orphan_msg = (
        "伺服器在同步過程中重啟（常見於免費雲端閒置休眠），"
        "背景任務已中斷，請重新執行同步。"
    )
    with _lock:
        cur = _db.execute(
            "SELECT COUNT(*) FROM jobs WHERE status IN ('pending', 'running')"
        )
        (count,) = cur.fetchone()
        if count:
            _db.execute(
                """
                UPDATE jobs
                SET status = 'error', error = ?, updated_at = ?
                WHERE status IN ('pending', 'running')
                """,
                (orphan_msg, time.time()),
            )
        return count


def create_job() -> str:
    """建立一個新的 Job，回傳 Job ID"""
    job_id = str(uuid.uuid4())
    now = time.time()
    with _lock:
        _db.execute(
            """
            INSERT INTO jobs (id, status, progress, progress_msg, created_at, updated_at)
            VALUES (?, 'pending', 0, '準備開始...', ?, ?)
            """,
            (job_id, now, now),
        )
    return job_id


def update_job_progress(job_id: str, progress: int, msg: str):
    """更新 Job 進度"""
    with _lock:
        _db.execute(
            """
            UPDATE jobs
            SET status = 'running', progress = ?, progress_msg = ?, updated_at = ?
            WHERE id = ?
            """,
            (progress, msg, time.time(), job_id),
        )


def complete_job(job_id: str, result: dict):
    """Job 完成，寫入結果"""
    with _lock:
        _db.execute(
            """
            UPDATE jobs
            SET status = 'done', progress = 100, progress_msg = '同步完成',
                result = ?, updated_at = ?
            WHERE id = ?
            """,
            (json.dumps(result, ensure_ascii=False), time.time(), job_id),
        )


def fail_job(job_id: str, error_msg: str):
    """Job 發生錯誤"""
    with _lock:
        _db.execute(
            """
            UPDATE jobs
            SET status = 'error', error = ?, updated_at = ?
            WHERE id = ?
            """,
            (error_msg, time.time(), job_id),
        )


_SELECT_COLS = "id, status, progress, progress_msg, result, error, created_at, updated_at"
_ROW_KEYS = tuple(c.strip() for c in _SELECT_COLS.split(","))


def _fetch_job_row(job_id: str):
    with _lock:
        cur = _db.execute(
            f"SELECT {_SELECT_COLS} FROM jobs WHERE id = ?", (job_id,)
        )
        row = cur.fetchone()
    return dict(zip(_ROW_KEYS, row)) if row else None


def get_job_status(job_id: str) -> dict:
    """取得 Job 狀態 (不含大量 result 內容)"""
    job = _fetch_job_row(job_id)
    if not job:
        return None
    return {
        "id": job["id"],
        "status": job["status"],
        "progress": job["progress"],
        "progress_msg": job["progress_msg"],
        "error": job["error"],
        "timestamp": job["updated_at"],
    }


def get_job_result(job_id: str):
    """取得完整 Job 紀錄包含 result"""
    job = _fetch_job_row(job_id)
    if not job:
        return None
    if job["result"]:
        try:
            job["result"] = json.loads(job["result"])
        except json.JSONDecodeError:
            job["result"] = None
    return job


def cleanup_old_jobs(older_than_seconds: int = 86400):
    """
    定期清理超過 N 秒的任務，避免 DB 膨脹。
    預設 24 小時 (86400 秒)，舊版是 1 小時，常因此誤砍仍有意義的結果。
    """
    cutoff = time.time() - older_than_seconds
    with _lock:
        _db.execute("DELETE FROM jobs WHERE updated_at < ?", (cutoff,))
