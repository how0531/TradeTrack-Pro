import uuid
import time
import json
import threading
import sqlite3
import os

_DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'jobs.db')
_db_lock = threading.Lock()


def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(_DB_PATH, check_same_thread=False, timeout=10)
    conn.row_factory = sqlite3.Row
    return conn


def _init_db():
    with _db_lock:
        with _get_conn() as conn:
            conn.execute('''
                CREATE TABLE IF NOT EXISTS jobs (
                    id TEXT PRIMARY KEY,
                    status TEXT NOT NULL DEFAULT 'pending',
                    progress INTEGER NOT NULL DEFAULT 0,
                    progress_msg TEXT NOT NULL DEFAULT '準備開始...',
                    result TEXT,
                    error TEXT,
                    created_at REAL NOT NULL,
                    updated_at REAL NOT NULL
                )
            ''')
            # Mark jobs that were still running when the previous process died
            conn.execute(
                "UPDATE jobs SET status='error', "
                "error='伺服器已重新啟動，任務中斷，請重新執行同步。' "
                "WHERE status IN ('pending', 'running')"
            )
            conn.commit()


_init_db()


def create_job() -> str:
    """建立一個新的 Job，回傳 Job ID"""
    job_id = str(uuid.uuid4())
    now = time.time()
    with _db_lock:
        with _get_conn() as conn:
            conn.execute(
                'INSERT INTO jobs (id, status, progress, progress_msg, created_at, updated_at) '
                'VALUES (?, ?, ?, ?, ?, ?)',
                (job_id, 'pending', 0, '準備開始...', now, now)
            )
            conn.commit()
    return job_id


def update_job_progress(job_id: str, progress: int, msg: str):
    """更新 Job 進度"""
    now = time.time()
    with _db_lock:
        with _get_conn() as conn:
            conn.execute(
                'UPDATE jobs SET status=?, progress=?, progress_msg=?, updated_at=? WHERE id=?',
                ('running', progress, msg, now, job_id)
            )
            conn.commit()


def complete_job(job_id: str, result: dict):
    """Job 完成，寫入結果"""
    now = time.time()
    with _db_lock:
        with _get_conn() as conn:
            conn.execute(
                'UPDATE jobs SET status=?, progress=?, progress_msg=?, result=?, updated_at=? WHERE id=?',
                ('done', 100, '同步完成', json.dumps(result, ensure_ascii=False), now, job_id)
            )
            conn.commit()


def fail_job(job_id: str, error_msg: str):
    """Job 發生錯誤"""
    now = time.time()
    with _db_lock:
        with _get_conn() as conn:
            conn.execute(
                'UPDATE jobs SET status=?, error=?, updated_at=? WHERE id=?',
                ('error', error_msg, now, job_id)
            )
            conn.commit()


def get_job_status(job_id: str) -> dict:
    """取得 Job 狀態 (不含大量 result 內容)"""
    with _db_lock:
        with _get_conn() as conn:
            row = conn.execute(
                'SELECT id, status, progress, progress_msg, error, updated_at '
                'FROM jobs WHERE id=?',
                (job_id,)
            ).fetchone()
    if not row:
        return None
    return {
        "id": row["id"],
        "status": row["status"],
        "progress": row["progress"],
        "progress_msg": row["progress_msg"],
        "error": row["error"],
        "timestamp": row["updated_at"]
    }


def get_job_result(job_id: str):
    """取得完整 Job 紀錄包含 result"""
    with _db_lock:
        with _get_conn() as conn:
            row = conn.execute('SELECT * FROM jobs WHERE id=?', (job_id,)).fetchone()
    if not row:
        return None
    result_data = None
    if row["result"]:
        try:
            result_data = json.loads(row["result"])
        except Exception:
            result_data = None
    return {
        "id": row["id"],
        "status": row["status"],
        "progress": row["progress"],
        "progress_msg": row["progress_msg"],
        "result": result_data,
        "error": row["error"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"]
    }


def cleanup_old_jobs(older_than_seconds: int = 3600):
    """定期清理超過 N 秒的過期任務，避免資料庫膨脹"""
    cutoff = time.time() - older_than_seconds
    with _db_lock:
        with _get_conn() as conn:
            conn.execute('DELETE FROM jobs WHERE updated_at < ?', (cutoff,))
            conn.commit()
