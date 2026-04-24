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


def _connect():
    conn = sqlite3.connect(_db_path, timeout=10, isolation_level=None)
    conn.execute("PRAGMA journal_mode=WAL;")
    return conn


def _init_db():
    with _lock, _connect() as conn:
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


_init_db()


def recover_orphaned_jobs() -> int:
    """
    伺服器啟動時呼叫：把上一輪仍在 pending / running 的任務
    標記為 error，並附上明確原因，讓前端可以呈現「伺服器重啟」的狀態，
    而不是卡在永遠不會完成的 running 狀態。
    """
    now = time.time()
    orphan_msg = (
        "伺服器在同步過程中重啟（常見於免費雲端閒置休眠），"
        "背景任務已中斷，請重新執行同步。"
    )
    with _lock, _connect() as conn:
        cur = conn.execute(
            "SELECT COUNT(*) FROM jobs WHERE status IN ('pending', 'running')"
        )
        (count,) = cur.fetchone()
        if count:
            conn.execute(
                """
                UPDATE jobs
                SET status = 'error',
                    error = ?,
                    updated_at = ?
                WHERE status IN ('pending', 'running')
                """,
                (orphan_msg, now),
            )
        return count


def create_job() -> str:
    """建立一個新的 Job，回傳 Job ID"""
    job_id = str(uuid.uuid4())
    now = time.time()
    with _lock, _connect() as conn:
        conn.execute(
            """
            INSERT INTO jobs (id, status, progress, progress_msg, result, error, created_at, updated_at)
            VALUES (?, 'pending', 0, '準備開始...', NULL, NULL, ?, ?)
            """,
            (job_id, now, now),
        )
    return job_id


def update_job_progress(job_id: str, progress: int, msg: str):
    """更新 Job 進度"""
    with _lock, _connect() as conn:
        conn.execute(
            """
            UPDATE jobs
            SET status = 'running',
                progress = ?,
                progress_msg = ?,
                updated_at = ?
            WHERE id = ?
            """,
            (progress, msg, time.time(), job_id),
        )


def complete_job(job_id: str, result: dict):
    """Job 完成，寫入結果"""
    with _lock, _connect() as conn:
        conn.execute(
            """
            UPDATE jobs
            SET status = 'done',
                progress = 100,
                progress_msg = '同步完成',
                result = ?,
                updated_at = ?
            WHERE id = ?
            """,
            (json.dumps(result, ensure_ascii=False), time.time(), job_id),
        )


def fail_job(job_id: str, error_msg: str):
    """Job 發生錯誤"""
    with _lock, _connect() as conn:
        conn.execute(
            """
            UPDATE jobs
            SET status = 'error',
                error = ?,
                updated_at = ?
            WHERE id = ?
            """,
            (error_msg, time.time(), job_id),
        )


def _row_to_dict(row):
    if not row:
        return None
    keys = [
        "id",
        "status",
        "progress",
        "progress_msg",
        "result",
        "error",
        "created_at",
        "updated_at",
    ]
    return dict(zip(keys, row))


def get_job_status(job_id: str) -> dict:
    """取得 Job 狀態 (不含大量 result 內容)"""
    with _lock, _connect() as conn:
        cur = conn.execute(
            """
            SELECT id, status, progress, progress_msg, result, error, created_at, updated_at
            FROM jobs WHERE id = ?
            """,
            (job_id,),
        )
        row = cur.fetchone()
    job = _row_to_dict(row)
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
    with _lock, _connect() as conn:
        cur = conn.execute(
            """
            SELECT id, status, progress, progress_msg, result, error, created_at, updated_at
            FROM jobs WHERE id = ?
            """,
            (job_id,),
        )
        row = cur.fetchone()
    job = _row_to_dict(row)
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
    with _lock, _connect() as conn:
        conn.execute("DELETE FROM jobs WHERE updated_at < ?", (cutoff,))
