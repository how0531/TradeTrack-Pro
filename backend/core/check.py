from .session import get_session_manager
from .constants import BRANCH_MAP

def check_connection(api_key, secret_key):
    """
    Simple check to verify credentials without CA
    """
    try:
        manager = get_session_manager()
        # Use simulation=True by default for check
        api = manager.get_api(
            api_key, 
            secret_key, 
            "CHECK_ONLY", 
            "", 
            "", 
            simulation=True
        )
        
        # List accounts to verify token
        accounts = api.list_accounts()
        
        # Enrich with branch names
        acc_list = []
        for acc in accounts:
            branch_code = getattr(acc, "broker_id", "")
            branch_name = BRANCH_MAP.get(branch_code, branch_code)
            acc_list.append({
                "account_id": acc.account_id,
                "branch_code": branch_code,
                "branch_name": branch_name,
                "type": str(getattr(acc, "account_type", "S")) 
            })
            
        return {"status": "success", "accounts": acc_list}
        
    except Exception as e:
        return {"status": "error", "message": str(e)}
