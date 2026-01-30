import sys
import os
import json

# Add project root to sys.path to allow importing backend.core
# Assuming script is in TradeTrack-Pro/scripts/ and we need TradeTrack-Pro/
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)
sys.path.insert(0, project_root)

try:
    from backend.core.pnl import login_and_fetch_pnl
except ImportError:
    # Fallback if package structure is different
    sys.path.append(os.path.join(project_root, "backend"))
    from core.pnl import login_and_fetch_pnl

if __name__ == "__main__":
    if len(sys.argv) < 6:
        print(json.dumps({"status": "error", "message": "Missing arguments"}))
        sys.exit(1)

    # Simple CLI wrapper
    p_api_key = sys.argv[1]
    p_secret = sys.argv[2]
    p_id = sys.argv[3]
    p_ca_path = sys.argv[4]
    p_ca_pass = sys.argv[5]
    p_start = sys.argv[6] if len(sys.argv) > 6 else None
    p_end = sys.argv[7] if len(sys.argv) > 7 else p_start

    res = login_and_fetch_pnl(
        api_key=p_api_key,
        secret_key=p_secret,
        person_id=p_id,
        ca_path=p_ca_path,
        ca_password=p_ca_pass,
        start_date=p_start,
        end_date=p_end,
        simulation=False, # CLI defaults to Production
    )
    print(json.dumps(res, indent=2))
