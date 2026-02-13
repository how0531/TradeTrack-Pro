import shioaji as sj
import os
from datetime import datetime

# Global Session Manager Instance
_SESSION_MANAGER = None

class ShioajiSessionManager:
    def __init__(self):
        self.api = None
        self.current_person_id = None
        self.current_api_key_suffix = None  # Store last 6 chars for validation
        self.last_used_time = None
        self.is_simulation = True
        self.ca_activated = False  # 🔑 Track CA activation status

    def get_api(
        self, api_key, secret_key, person_id, ca_path, ca_password, simulation=True
    ):
        """
        Get an active API instance. Reused if possible, otherwise create new.
        Always ensures CA is activated when a valid path is provided.
        """
        # Comparison key (suffix)
        key_suffix = api_key[-6:] if api_key and len(api_key) > 6 else api_key

        # 1. Check if we can reuse the existing session
        if (
            self.api
            and self.current_person_id == person_id
            and self.current_api_key_suffix == key_suffix
            and self.is_simulation == simulation
        ):
            print(
                f"DEBUG: [SessionReuse] Reusing existing connection for {person_id}",
                flush=True,
            )
            
            # 🔑 CRITICAL FIX: If CA was not activated, try to activate now
            if not self.ca_activated and ca_path:
                self._try_activate_ca(self.api, ca_path, ca_password, person_id)
            
            self.last_used_time = datetime.now()
            return self.api

        # 2. If valid session exists but credentials changed, logout first
        if self.api:
            print(
                f"DEBUG: [SessionReuse] Credentials changed. Logging out...",
                flush=True,
            )
            try:
                self.api.logout()
            except Exception as e:
                print(f"WARNING: Logout failed during switch: {e}", flush=True)
            self.api = None
            self.ca_activated = False  # Reset CA status

        # 3. Create new connection
        print(
            f"DEBUG: [SessionReuse] Creating NEW connection for {person_id} (Sim={simulation})",
            flush=True,
        )
        new_api = sj.Shioaji(simulation=simulation)

        accounts = new_api.login(
            api_key=api_key,
            secret_key=secret_key,
            fetch_contract=True,  # Mandatory to resolve stock/contract names
        )
        print(f"DEBUG: Login successful. Found {len(accounts)} account(s).", flush=True)

        # Activate CA immediately
        self._try_activate_ca(new_api, ca_path, ca_password, person_id)

        # Update State
        self.api = new_api
        self.current_person_id = person_id
        self.current_api_key_suffix = key_suffix
        self.is_simulation = simulation
        self.last_used_time = datetime.now()

        return self.api

    def _try_activate_ca(self, api, ca_path, ca_password, person_id):
        """
        Attempt CA activation. Updates self.ca_activated on success.
        """
        if not ca_path:
            print("DEBUG: [CA] No CA path provided, skipping activation.", flush=True)
            return
            
        if not os.path.exists(ca_path):
            print(
                f"WARNING: [CA] Path '{ca_path}' does not exist. "
                f"If using cloud deployment, ensure caContent (Base64) is uploaded via the frontend.",
                flush=True,
            )
            return
            
        try:
            result = api.activate_ca(
                ca_path=ca_path,
                ca_passwd=ca_password,
                person_id=person_id,
            )
            self.ca_activated = True
            print(f"DEBUG: [CA] ✅ CA Activated successfully! Result: {result}", flush=True)
        except Exception as e:
            self.ca_activated = False
            print(f"WARNING: [CA] ❌ CA Activation failed: {e}", flush=True)


def get_session_manager():
    global _SESSION_MANAGER
    if _SESSION_MANAGER is None:
        _SESSION_MANAGER = ShioajiSessionManager()
    return _SESSION_MANAGER
