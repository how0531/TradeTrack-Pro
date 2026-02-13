import json
import sys
import os

# Mock Objects to simulate Shioaji responses
class MockItem:
    def __init__(self, data):
        for k, v in data.items():
            setattr(self, k, v)
            
class MockAccount:
    def __init__(self, account_id, account_type):
        self.account_id = account_id
        self.account_type = account_type

def simulate_pnl_processing(raw_data_path):
    print(f"Loading raw data from: {raw_data_path}")
    try:
        with open(raw_data_path, "r", encoding="utf-8") as f:
            raw_list = json.load(f)
    except Exception as e:
        print(f"Error loading file: {e}")
        return

    # Convert raw dicts to MockItems (mimicking Shioaji objects)
    pnl_data = [MockItem(d) for d in raw_list]
    
    acc_details = []
    acc_pnl = 0
    target_account = MockAccount("9162673", "F") # Futures Account
    
    is_futures = True
    is_sub = False
    category = "期貨"

    print(f"Processing {len(pnl_data)} items...")

    for item in pnl_data:
        try:
            code = getattr(item, "code", "Unknown")
            # In raw data, pnl is string "130000.0", needs float conversion
            realized = round(float(getattr(item, "pnl", 0)), 4)
            
            item_date = str(getattr(item, "date", ""))
            if len(item_date) == 8:
                item_date = f"{item_date[:4]}-{item_date[4:6]}-{item_date[6:]}"
            
            # Check Quantity Handling
            raw_qty = int(getattr(item, "quantity", 0))
            price = round(float(getattr(item, "price", 0)), 4) # Price might be missing in raw data!
            buy_amt = round(float(getattr(item, "buy_amt", 0)), 4) # Might be missing
            sell_amt = round(float(getattr(item, "sell_amt", 0)), 4) # Might be missing
            
            # Simplified Name Resolution Logic (from pnl.py)
            name = getattr(item, "name", "")
            if name is None: name = ""
            name = str(name).strip()
            
            FUTURES_NAMES = {
                'TXF': '台指期', 'MTX': '小台指', 'TE': '電子期', 'MTE': '小電子期',
                'TF': '金融期', 'T5F': '櫃買期', 'UNF': '非金電期', 'GTF': '黃金期',
                'XIF': '東證期', 'SP': 'S&P期', 'ND': '那斯達克期',
            }
            
            if is_futures and len(code) >= 2:
                    prefix3 = code[:3].upper()
                    prefix2 = code[:2].upper()
                    if prefix3 in FUTURES_NAMES: name = FUTURES_NAMES[prefix3]
                    elif prefix2 in FUTURES_NAMES: name = FUTURES_NAMES[prefix2]
            
            if "臺股期" in name: name = "台指期"
            elif "小型臺指" in name: name = "小台指"

            if name and name != code:
                display_code = name if code in name else f"{code} {name}"
            else:
                display_code = code
            
            # Build Result Dict
            result_item = {
                "date": item_date, 
                "code": display_code, 
                "price": price, 
                "quantity": raw_qty, 
                "pnl": realized, 
                "orderNo": getattr(item, "dseq", ""), # Might be missing
                "category": category,
                "buyAmt": buy_amt,
                "sellAmt": sell_amt,
                "entryPrice": float(getattr(item, "entry_price", 0)),
                "exitPrice": float(getattr(item, "cover_price", 0)),
                "yield": float(getattr(item, "pr_ratio", 0)), # Extract PnL Ratio
                "accountId": target_account.account_id 
            }
            acc_details.append(result_item)
            acc_pnl += realized
            
            print(f"Processed: {display_code} | PnL: {realized} | Date: {item_date}")

        except Exception as item_e:
                print(f"❌ [Item Error] {getattr(item, 'code', '?')}: {item_e}")
                continue
    
    print(f"Total PnL: {acc_pnl}")
    print(f"Total Items: {len(acc_details)}")
    if len(acc_details) > 0:
        print("Sample Item:", json.dumps(acc_details[0], indent=2, ensure_ascii=False))

if __name__ == "__main__":
    # Use the discovered raw file
    raw_file = r"c:\Users\012701\debug_pnl_raw_9162673_att1.json"
    simulate_pnl_processing(raw_file)
