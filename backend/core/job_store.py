import uuid
import time
import threading

# 簡單的記憶體 Job 儲存 (使用 dict)
_jobs = {}
_jobs_lock = threading.Lock()

def create_job() -> str:
    """建立一個新的 Job，回傳 Job ID"""
    job_id = str(uuid.uuid4())
    with _jobs_lock:
        _jobs[job_id] = {
            "id": job_id,
            "status": "pending",  # pending, running, done, error
            "progress": 0,
            "progress_msg": "準備開始...",
            "result": None,
            "error": None,
            "created_at": time.time(),
            "updated_at": time.time()
        }
    return job_id

def update_job_progress(job_id: str, progress: int, msg: str):
    """更新 Job 進度"""
    with _jobs_lock:
        if job_id in _jobs:
            _jobs[job_id]["status"] = "running"
            _jobs[job_id]["progress"] = progress
            _jobs[job_id]["progress_msg"] = msg
            _jobs[job_id]["updated_at"] = time.time()

def complete_job(job_id: str, result: dict):
    """Job 完成，寫入結果"""
    with _jobs_lock:
        if job_id in _jobs:
            _jobs[job_id]["status"] = "done"
            _jobs[job_id]["progress"] = 100
            _jobs[job_id]["progress_msg"] = "同步完成"
            _jobs[job_id]["result"] = result
            _jobs[job_id]["updated_at"] = time.time()

def fail_job(job_id: str, error_msg: str):
    """Job 發生錯誤"""
    with _jobs_lock:
        if job_id in _jobs:
            _jobs[job_id]["status"] = "error"
            _jobs[job_id]["error"] = error_msg
            _jobs[job_id]["updated_at"] = time.time()

def get_job_status(job_id: str) -> dict:
    """取得 Job 狀態 (不含大量 result 內容)"""
    with _jobs_lock:
        job = _jobs.get(job_id)
        if not job:
            return None
        return {
            "id": job["id"],
            "status": job["status"],
            "progress": job["progress"],
            "progress_msg": job["progress_msg"],
            "error": job["error"],
            "timestamp": job["updated_at"]
        }

def get_job_result(job_id: str):
    """取得完整 Job 紀錄包含 result"""
    with _jobs_lock:
        return _jobs.get(job_id)

def cleanup_old_jobs(older_than_seconds: int = 3600):
    """定期清理超過 N 秒的過期任務，避免記憶體洩漏"""
    now = time.time()
    with _jobs_lock:
        to_delete = [
            jid for jid, info in _jobs.items() 
            if (now - info["updated_at"]) > older_than_seconds
        ]
        for jid in to_delete:
            del _jobs[jid]
