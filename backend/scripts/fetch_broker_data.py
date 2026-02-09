"""
券商資料更新腳本（簡化版）
手動從證交所網站複製資料後使用此腳本處理
"""

import json

# 從瀏覽器子代理得知，證交所 API 端點為：
# 主列表: https://www.twse.com.tw/rwd/zh/brokerService/brokerList?response=json
# 分公司: https://www.twse.com.tw/rwd/zh/brokerService/brokerServiceAudit?showType=list&stkNo={code}&response=json

# 使用說明：
# 1. 直接在瀏覽器打開 https://www.twse.com.tw/zh/products/broker/infomation/list.html
# 2. 打開 開發者工具 (F12)
# 3. 在 Console 執行以下 JavaScript 腳本：
"""
你可以在瀏覽器 Console 執行以下腳本來抓取所有券商資料：

```javascript
(async () => {
    // 1. 抓取主列表
    const mainResp = await fetch('/rwd/zh/brokerService/brokerList?response=json');
    const mainData = await mainResp.json();
    const brokers = mainData.data;
    
    console.log(`找到 ${brokers.length} 家券商`);
    
    const branchMap = {};
    
    // 加入總公司
    for (const b of brokers) {
        branchMap[b.stkNo] = b.stkNm;
    }
    
    // 2. 抓取各券商分公司
    for (const broker of brokers) {
        try {
            const branchResp = await fetch(`/rwd/zh/brokerService/brokerServiceAudit?showType=list&stkNo=${broker.stkNo}&response=json`);
            const branchData = await branchResp.json();
            
            if (branchData.data && branchData.data.length > 0) {
                console.log(`${broker.stkNm}: ${branchData.data.length} 家分公司`);
                for (const branch of branchData.data) {
                    branchMap[branch.stkNo] = branch.stkNm;
                }
            }
            
            // 避免請求過快
            await new Promise(r => setTimeout(r, 200));
        } catch (e) {
            console.error(`${broker.stkNm} 失敗:`, e);
        }
    }
    
    console.log(`\n完成！共 ${Object.keys(branchMap).length} 筆資料`);
    
    // 複製到剪貼簿
    copy(JSON.stringify(branchMap, null, 2));
    console.log('\n✅ JSON 已複製到剪貼簿！貼上到 broker_data.json 檔案即可');
    
    return branchMap;
})();
```

執行後，資料會自動複製到剪貼簿，直接貼上到 backend/core/broker_data.json 即可。
"""

print(__doc__)
print("\n=" * 80)
print("或者直接使用已準備好的資料（來自永豐金）：")
print("=" * 80)

# 永豐金的分公司代碼（範例）
SINOPAC_BRANCHES = {
    "9100": "永豐金-總公司",
    "9186": "永豐金-忠孝",  
    "9187": "永豐金-南京",
    # ... 可以繼續補充
}

def generate_constants_from_json(json_file: str, output_file: str):
    """從 JSON 檔案生成 Python constants"""
    try:
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        lines = [
            '"""',
            '券商分公司代碼對照表',
            '資料來源: 臺灣證券交易所',
            f'總計: {len(data)} 筆',
            '"""',
            '',
            'BRANCH_MAP = {'
        ]
        
        for code, name in sorted(data.items()):
            safe_name = name.replace('"', '\\"')
            lines.append(f'    "{code}": "{safe_name}",')
        
        lines.append('}')
        
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))
        
        print(f"✅ 已生成: {output_file}")
        print(f"   總計: {len(data)} 筆資料")
        
    except FileNotFoundError:
        print(f"❌ 找不到檔案: {json_file}")
        print("   請先在瀏覽器執行上述 JavaScript 腳本")
        print("   並將結果儲存為 broker_data.json")

if __name__ == "__main__":
    # 如果有 broker_data.json，就轉換它
    import os
    if os.path.exists("backend/core/broker_data.json"):
        generate_constants_from_json(
            "backend/core/broker_data.json",
            "backend/core/broker_constants_generated.py"
        )
    else:
        print("\n💡 請先執行上述的瀏覽器 Console 腳本來抓取資料")
