"""
ShioajiSessionManager.get_api login path.

shioaji 1.7 removed login(fetch_contract=...) — passing it raises TypeError,
which no other test caught (Render went live with a login that could never
succeed). These tests pin the call shape against a fake whose signature
mirrors 1.7.x, plus one guard against the real installed package.
"""
import inspect

import pytest
import shioaji as sj

from backend.core import session as session_mod


class FakeShioaji:
    instances = []

    def __init__(self, simulation=True):
        self.simulation = simulation
        self.calls = []
        FakeShioaji.instances.append(self)

    # 與 shioaji 1.7.x 相同：沒有 fetch_contract
    def login(self, api_key, secret_key, subscribe_trade=True, receive_window=30000, force_refresh=False):
        self.calls.append("login")
        return ["acc"]

    def fetch_contracts(self, contract_download=False, contracts_timeout=30000, contracts_cb=None):
        self.calls.append("fetch_contracts")

    def list_accounts(self):
        return ["acc"]

    def logout(self):
        self.calls.append("logout")


@pytest.fixture
def manager(monkeypatch):
    FakeShioaji.instances.clear()
    monkeypatch.setattr(session_mod.sj, "Shioaji", FakeShioaji)
    monkeypatch.setattr(session_mod, "_POST_LOGIN_WARMUP_SECONDS", 0)
    m = session_mod.ShioajiSessionManager()
    monkeypatch.setattr(m, "_try_activate_ca", lambda *a, **k: None)
    return m


def test_login_without_contracts_by_default(manager):
    api = manager.get_api("key-123456", "secret", "A123456789", None, None)
    assert api.calls == ["login"]


def test_fetches_contracts_only_when_requested(manager):
    api = manager.get_api("key-123456", "secret", "A123456789", None, None, fetch_contract=True)
    assert api.calls == ["login", "fetch_contracts"]


def test_installed_shioaji_accepts_backend_login_kwargs():
    params = inspect.signature(sj.Shioaji.login).parameters
    assert {"api_key", "secret_key"} <= set(params)
    assert hasattr(sj.Shioaji, "fetch_contracts")
