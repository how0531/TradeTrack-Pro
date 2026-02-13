import sys
import os
import json
import unittest
from unittest.mock import MagicMock, patch

# Mock shioaji module BEFORE importing core.pnl
sys.modules["shioaji"] = MagicMock()

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from core.pnl import login_and_fetch_pnl

class MockAccount:
    def __init__(self, account_id, account_type, broker_id="SinoPac"):
        self.account_id = account_id
        self.account_type = account_type
        self.broker_id = broker_id
        self.username = "TestUser"
        
class TestPnLRefactor(unittest.TestCase):
    def setUp(self):
        # Load Raw Data
        raw_path = r"c:\Users\012701\debug_pnl_raw_9162673_att1.json"
        with open(raw_path, "r", encoding="utf-8") as f:
            self.raw_data = json.load(f)

    @patch("core.pnl.get_session_manager")
    def test_login_and_fetch_pnl(self, mock_get_manager):
        # Setup Mock API Chain
        mock_manager = MagicMock()
        mock_api = MagicMock()
        
        mock_get_manager.return_value = mock_manager
        mock_manager.get_api.return_value = mock_api

        # Mock login to return our test account
        mock_api.login.return_value = None
        
        target_acc = MockAccount("9162673", "F")
        mock_api.list_accounts.return_value = [target_acc]
        
        # Mock PnL Data
        mock_api.list_profit_loss.return_value = [MockItem(d) for d in self.raw_data]
        
        # Mock Margin
        mock_margin = MagicMock()
        mock_margin.equity = 150000
        mock_api.margin.return_value = mock_margin
        
        # Mock Positions
        mock_pos = MagicMock()
        mock_pos.pnl = 5000
        mock_api.list_positions.return_value = [mock_pos, mock_pos] # 2 positions, total 10000

        # Run Main Function
        print(f"DEBUG: Loaded {len(self.raw_data)} items from raw JSON")
        
        result = login_and_fetch_pnl(
            api_key="test", secret_key="test", person_id="A123",
            ca_path="test", ca_password="test"
        )

        # Assertions
        print(f"\n[Result] Total PnL: {result['total_pnl']}")
        print(f"[Summary] {result.get('summary')}")
        print(f"[Details Count] {len(result['details'])}")
        if len(result['details']) > 0:
            print(f"[First Item] {result['details'][0]}")
        
        self.assertEqual(result['status'], "success")
        self.assertEqual(result['details_count'], len(self.raw_data))
        self.assertEqual(result['summary']['equity'], 150000)

        sample = next((d for d in result['details'] if "TXFB6" in d["code"]), None)
        if sample:
            print(f"Sample Code Resolved: {sample['code']}")
            self.assertTrue("台指期" in sample['code'])

class MockItem:
    def __init__(self, dictionary):
        for k, v in dictionary.items():
            setattr(self, k, v)
    def __repr__(self):
        return str(self.__dict__)

    def _dict_to_obj(self, d):
        return MockItem(d)

if __name__ == "__main__":
    unittest.main()
