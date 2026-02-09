"""
測試券商代碼對照功能
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from core.constants import BRANCH_MAP

def test_branch_map():
    """測試券商代碼對照表"""
    
    print("=" * 80)
    print("券商代碼對照表測試")
    print("=" * 80)
    
    # 測試永豐金系列
    print("\n📊 永豐金證券系列:")
    test_codes = ["9A00", "9A91", "9A9D", "9A9g", "9A97", "9A9L", "9A9h", "9A9e"]
    for code in test_codes:
        name = BRANCH_MAP.get(code, "❌ 未找到")
        print(f"  {code} -> {name}")
    
    # 測試其他主要券商
    print("\n📊 其他主要券商:")
    test_codes = [
        "1020",  # 合庫
        "9800",  # 元大
        "9200",  # 凱基
        "9100",  # 群益金鼎
        "9600",  # 富邦
        "8150",  # 台新
    ]
    for code in test_codes:
        name = BRANCH_MAP.get(code, "❌ 未找到")
        print(f"  {code} -> {name}")
    
    # 測試一些分公司
    print("\n📊 分公司範例:")
    test_codes = [
        "9A9D",  # 永豐金-忠孝
        "9812",  # 元大-台中
        "9204",  # 凱基-台中
        "9184",  # 群益金鼎-台中
        "965K",  # 富邦-台中
        "815B",  # 台新-台中
    ]
    for code in test_codes:
        name = BRANCH_MAP.get(code, "❌ 未找到")
        print(f"  {code} -> {name}")
    
    # 統計
    print(f"\n📊 統計資訊:")
    print(f"  總計: {len(BRANCH_MAP)} 筆券商/分公司資料")
    
    # 檢查是否所有永豐金代碼都存在
    sinopac_codes = [k for k in BRANCH_MAP.keys() if k.startswith("9A")]
    print(f"  永豐金相關: {len(sinopac_codes)} 筆")
    
    # 檢查各大券商
    major_brokers = {
        "元大": "98",
        "凱基": "92",
        "群益金鼎": "91",
        "富邦": "96",
        "國泰": "88",
        "台新": "81",
        "兆豐": "70",
    }
    
    print(f"\n📊 主要券商分公司數量:")
    for broker_name, prefix in major_brokers.items():
        count = len([k for k in BRANCH_MAP.keys() if k.startswith(prefix)])
        print(f"  {broker_name}: {count} 筆")
    
    print("\n" + "=" * 80)
    print("✅ 測試完成！")
    print("=" * 80)

if __name__ == "__main__":
    test_branch_map()
