"""
Tests for backend/core/job_store.py.

The persistence layer was added in v3.2.0 to stop sync tasks from
disappearing when the free-tier backend restarted. Locking in the
expected behaviour here so future cleanup or query tweaks don't
silently regress the "user actually keeps their data" contract.
"""
import time


def test_create_and_get_status_roundtrip(job_store_module):
    js = job_store_module
    job_id = js.create_job()

    assert isinstance(job_id, str) and len(job_id) > 0

    status = js.get_job_status(job_id)
    assert status is not None
    assert status["id"] == job_id
    assert status["status"] == "pending"
    assert status["progress"] == 0


def test_progress_update_marks_running(job_store_module):
    js = job_store_module
    job_id = js.create_job()

    js.update_job_progress(job_id, 42, "Fetching account 1/3")

    status = js.get_job_status(job_id)
    assert status["status"] == "running"
    assert status["progress"] == 42
    assert status["progress_msg"] == "Fetching account 1/3"


def test_complete_job_stores_result(job_store_module):
    js = job_store_module
    job_id = js.create_job()

    result = {"total_pnl": 12345, "details": [{"date": "2026-04-15", "pnl": 100}]}
    js.complete_job(job_id, result)

    full = js.get_job_result(job_id)
    assert full is not None
    assert full["status"] == "done"
    assert full["progress"] == 100
    assert full["result"] == result


def test_fail_job_records_error_string(job_store_module):
    js = job_store_module
    job_id = js.create_job()

    js.fail_job(job_id, "CA expired")

    status = js.get_job_status(job_id)
    assert status["status"] == "error"
    assert status["error"] == "CA expired"


def test_missing_job_returns_none(job_store_module):
    js = job_store_module
    assert js.get_job_status("does-not-exist") is None
    assert js.get_job_result("does-not-exist") is None


def test_recover_orphaned_jobs_marks_pending_and_running_as_error(job_store_module):
    js = job_store_module

    pending_id = js.create_job()  # stays pending
    running_id = js.create_job()
    js.update_job_progress(running_id, 30, "halfway")
    done_id = js.create_job()
    js.complete_job(done_id, {"ok": True})
    failed_id = js.create_job()
    js.fail_job(failed_id, "old error")

    count = js.recover_orphaned_jobs()
    # Only pending + running should be touched.
    assert count == 2

    # Newly-orphaned: status flipped to error with the orphan reason.
    for jid in (pending_id, running_id):
        st = js.get_job_status(jid)
        assert st["status"] == "error"
        assert st["error"]  # non-empty reason

    # Already-terminal jobs should NOT be touched.
    assert js.get_job_status(done_id)["status"] == "done"
    assert js.get_job_status(failed_id)["status"] == "error"
    assert js.get_job_status(failed_id)["error"] == "old error"


def test_recover_orphaned_jobs_is_idempotent(job_store_module):
    js = job_store_module
    js.create_job()
    first = js.recover_orphaned_jobs()
    second = js.recover_orphaned_jobs()
    assert first == 1
    assert second == 0  # nothing left to recover


def test_cleanup_old_jobs_removes_only_stale(job_store_module):
    js = job_store_module
    keep_id = js.create_job()
    purge_id = js.create_job()

    # Backdate the purge target by hand. cleanup_old_jobs decides
    # staleness by updated_at, so this is the cleanest way to simulate
    # "from yesterday".
    import sqlite3
    conn = sqlite3.connect(js._db_path)
    conn.execute(
        "UPDATE jobs SET updated_at = ? WHERE id = ?",
        (time.time() - 90_000, purge_id),  # 90,000s ago > default 86,400s
    )
    conn.commit()
    conn.close()

    js.cleanup_old_jobs()  # default 24h

    assert js.get_job_status(keep_id) is not None
    assert js.get_job_status(purge_id) is None
