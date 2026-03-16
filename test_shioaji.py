import os
import sys

# Append backend path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

def test_pnl():
    try:
        import traceback
        from backend.core.pnl import safe_list_profit_loss
        print("Success importing safe_list_profit_loss")
    except Exception as e:
        print("Error!", e)

if __name__ == "__main__":
    test_pnl()
