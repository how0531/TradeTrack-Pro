"""
Shioaji Login & Futures Import Test
Credentials sourced from environment variables or interactive input.
Output written to log file to avoid encoding issues.
"""
import shioaji as sj
import os
import sys
from datetime import datetime, timedelta

# ===== LOG FILE =====
LOG_PATH = os.path.join(os.path.dirname(__file__), "test_login_futures_result.log")

def log(msg):
    print(msg, flush=True)
    with open(LOG_PATH, "a", encoding="utf-8") as f:
        f.write(msg + "\n")

# Clear old log
with open(LOG_PATH, "w", encoding="utf-8") as f:
    f.write("")

# ===== Credentials (env vars or interactive input) =====
API_KEY = os.getenv("SHIOAJI_API_KEY") or input("Enter API_KEY: ").strip()
SECRET_KEY = os.getenv("SHIOAJI_SECRET_KEY") or input("Enter SECRET_KEY: ").strip()
PERSON_ID = os.getenv("SHIOAJI_PERSON_ID") or input("Enter PERSON_ID: ").strip()
CA_PASSWORD = os.getenv("SHIOAJI_CA_PASS") or input("Enter CA_PASSWORD: ").strip()
CA_PATH = os.getenv("SHIOAJI_CA_PATH") or input("Enter CA_PATH (e.g. C:\\ekey\\551\\...\\Sinopac.pfx): ").strip()

log("=" * 60)
log("Shioaji Login & Futures Import Test")
log("=" * 60)
log(f"  Shioaji Version: {sj.__version__}")
log(f"  Person ID: {PERSON_ID}")
log(f"  API Key: {API_KEY[:6]}...{API_KEY[-4:]}")
log(f"  CA Path: {CA_PATH}")
log(f"  CA File Exists: {os.path.exists(CA_PATH)}")
log("")

# ===== Step 1: Login =====
log("[Step 1] Logging in to Shioaji (Production)...")
try:
    api = sj.Shioaji(simulation=False)
    accounts = api.login(
        api_key=API_KEY,
        secret_key=SECRET_KEY,
        fetch_contract=True,
    )
    log(f"  OK! Login successful. Found {len(accounts)} account(s)")
    for i, acc in enumerate(accounts):
        log(f"     Account {i+1}: {acc}")
except Exception as e:
    log(f"  FAIL! Login failed: {e}")
    sys.exit(1)

# ===== Step 2: Activate CA =====
log("\n[Step 2] Activating CA certificate...")
try:
    if os.path.exists(CA_PATH):
        result = api.activate_ca(
            ca_path=CA_PATH,
            ca_passwd=CA_PASSWORD,
            person_id=PERSON_ID,
        )
        log(f"  OK! CA activated. Result: {result}")
    else:
        log(f"  WARN: CA file does not exist: {CA_PATH}")
except Exception as e:
    log(f"  FAIL! CA activation failed: {e}")

# ===== Step 3: Account Info =====
log("\n[Step 3] Account Info:")
try:
    if hasattr(api, 'stock_account') and api.stock_account:
        sa = api.stock_account
        log(f"  Stock Account: {sa}")
    else:
        log("  WARN: No stock account")
    
    if hasattr(api, 'futopt_account') and api.futopt_account:
        fa = api.futopt_account
        log(f"  Futures Account: {fa}")
    else:
        log("  WARN: No futures account")
except Exception as e:
    log(f"  FAIL: {e}")

# ===== Step 4: Futures Profit/Loss =====
log("\n[Step 4] Futures Profit/Loss (list_profit_loss)...")
try:
    if hasattr(api, 'futopt_account') and api.futopt_account:
        pl = api.list_profit_loss(api.futopt_account)
        log(f"  OK! Got {len(pl) if pl else 0} P/L records")
        if pl:
            for i, item in enumerate(pl[:10]):
                log(f"     [{i+1}] {item}")
        else:
            log("  INFO: No recent futures P/L records")
    else:
        log("  SKIP: No futures account")
except Exception as e:
    log(f"  FAIL: {e}")

# ===== Step 5: Futures Positions =====
log("\n[Step 5] Futures Positions (list_positions)...")
try:
    if hasattr(api, 'futopt_account') and api.futopt_account:
        api.update_status(api.futopt_account)
        positions = api.list_positions(api.futopt_account)
        log(f"  OK! Got {len(positions) if positions else 0} open positions")
        if positions:
            for i, pos in enumerate(positions):
                log(f"     [{i+1}] {pos}")
        else:
            log("  INFO: No open futures positions")
    else:
        log("  SKIP: No futures account")
except Exception as e:
    log(f"  FAIL: {e}")

# ===== Step 6: Today's Trades =====
log("\n[Step 6] Futures Trades (list_trades)...")
try:
    if hasattr(api, 'futopt_account') and api.futopt_account:
        api.update_status(api.futopt_account)
        trades = api.list_trades()
        log(f"  OK! Got {len(trades) if trades else 0} trade records today")
        if trades:
            for i, t in enumerate(trades[:10]):
                log(f"     [{i+1}] {t}")
        else:
            log("  INFO: No futures trades today")
    else:
        log("  SKIP: No futures account")
except Exception as e:
    log(f"  FAIL: {e}")

# ===== Step 7: Settlements =====
log("\n[Step 7] Futures Settlements (list_settlements)...")
try:
    if hasattr(api, 'futopt_account') and api.futopt_account:
        settlements = api.list_settlements(api.futopt_account)
        log(f"  OK! Got {len(settlements) if settlements else 0} settlement records")
        if settlements:
            for i, s in enumerate(settlements[:10]):
                log(f"     [{i+1}] {s}")
        else:
            log("  INFO: No settlement records")
    else:
        log("  SKIP: No futures account")
except Exception as e:
    log(f"  FAIL: {e}")

# ===== Step 8: Available Futures Contracts =====
log("\n[Step 8] Available Futures Contracts (sample)...")
try:
    futures = api.Contracts.Futures
    categories = ['TXF', 'MXF', 'EXF', 'FXF']
    for cat in categories:
        if hasattr(futures, cat):
            contracts = getattr(futures, cat)
            contract_list = [c for c in contracts]
            log(f"  {cat}: {len(contract_list)} contracts")
            if contract_list:
                c = contract_list[0]
                log(f"     Front month: code={c.code}, symbol={c.symbol}, name={c.name}")
except Exception as e:
    log(f"  FAIL: {e}")

# ===== Done =====
log("\n" + "=" * 60)
log("TEST COMPLETE!")
log("=" * 60)

# Logout
try:
    api.logout()
    log("Logged out.")
except:
    pass

log(f"\nTimestamp: {datetime.now().isoformat()}")
