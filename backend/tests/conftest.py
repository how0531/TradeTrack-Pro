"""
Shared pytest fixtures for backend tests.

Right now the only thing we need to be careful about is that
core/job_store.py opens its persistent SQLite connection at import
time (module-level `_db = _open_db()`), reading `JOB_STORE_DB` from
the environment. To keep tests deterministic and disk-clean, every
test that imports job_store goes through `job_store_module` which
sets up a fresh tmp_path DB and reloads the module.

This is the pragmatic alternative to refactoring job_store.py into a
class. Pytest's `monkeypatch` + `importlib.reload` is enough.
"""
import importlib
import os
import sys

import pytest


@pytest.fixture()
def job_store_module(tmp_path, monkeypatch):
    """
    Reload backend.core.job_store with JOB_STORE_DB pointing at a fresh
    SQLite file under tmp_path. Returns the module so the test can
    call its functions directly.
    """
    # Make sure `backend.core` is importable. Tests are invoked from the
    # repo root via `pytest backend/tests`, so we need backend's parent
    # (= repo root) on sys.path.
    repo_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    if repo_root not in sys.path:
        sys.path.insert(0, repo_root)

    db_file = tmp_path / "jobs.db"
    monkeypatch.setenv("JOB_STORE_DB", str(db_file))

    # Fresh import (or reload) under the new env var.
    if "backend.core.job_store" in sys.modules:
        del sys.modules["backend.core.job_store"]
    module = importlib.import_module("backend.core.job_store")
    return module
