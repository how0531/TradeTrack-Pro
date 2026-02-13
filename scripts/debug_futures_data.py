import shioaji as sj
import getpass
from datetime import datetime, timedelta
import json

def debug_futures():
    print("=== TradeTrack-Pro Futures Data Debugger ===")
    print("此工具將測試多種 API 指令以尋找遺失的期貨交易紀錄。")
    
    person_id = input("請輸入身分證字號 (Person ID): ").strip().upper()
    password = getpass.getpass("請輸入密碼 (Password): ").strip()
    
    api = sj.Shioaji()
    
    try:
        print("\n[1/5] 登入中 (Logging in)...")
        accounts = api.login(person_id, password)
        print("✅ 登入成功!")
        
        target_acc = None
        for acc in accounts:
            if "9162673" in str(acc.account_id):
                target_acc = acc
                break
        
        if not target_acc:
            print("❌ 找不到帳號 9162673 (期貨)。請確認該帳號是否存在於您的歸戶下。")
            # List all for verification
            print("目前偵測到的帳號:")
            for acc in accounts:
                print(f"- {acc.account_id} ({acc.account_type})")
            return

        print(f"\n[2/5] 鎖定目標帳號: {target_acc.account_id} ({target_acc.account_type})")
        
        # Date Range (30 days)
        start_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        end_date = datetime.now().strftime("%Y-%m-%d")
        print(f"查詢區間: {start_date} ~ {end_date}")

        # Test 1: list_profit_loss (Current Method)
        print("\n[3/5] 測試方法 A: list_profit_loss (目前系統使用)")
        try:
            pnl = api.list_profit_loss(target_acc, start_date, end_date)
            print(f"👉 結果: {len(pnl)} 筆資料")
            if pnl:
                print(f"   範例: {pnl[0]}")
        except Exception as e:
            print(f"❌ 失敗: {e}")

        # Test 2: settlements (Realized Futures PnL)
        print("\n[4/5] 測試方法 B: settlements (期貨已平倉損益)")
        try:
            # Check if method exists
            if hasattr(api, "settlements"):
                sets = api.settlements(target_acc, start_date, end_date)
                print(f"👉 結果: {len(sets)} 筆資料")
                if sets:
                    print(f"   範例: {sets[0]}")
            else:
                 print("⚠️ SDK 版本不支援 settlements 指令")
        except Exception as e:
            print(f"❌ 失敗: {e}")

        # Test 3: list_trades (Raw execution history)
        print("\n[5/5] 測試方法 C: list_trades (成交明細)")
        try:
            trades = api.list_trades(target_acc)
            # Filter by date manually just to see
            recent_trades = [t for t in trades if t.ts >= start_date.replace("-", "")]
            print(f"👉 結果: {len(recent_trades)} 筆資料 (總數: {len(trades)})")
            if recent_trades:
                print(f"   範例: {recent_trades[0]}")
        except Exception as e:
             print(f"❌ 失敗: {e}")

    except Exception as e:
        print(f"\n❌ 重大錯誤: {e}")
    finally:
        api.logout()
        print("\n=== 測試結束 (Debug Complete) ===")

if __name__ == "__main__":
    debug_futures()
