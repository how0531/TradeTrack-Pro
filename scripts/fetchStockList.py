#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
台灣股票清單爬蟲工具
從 TWSE (證交所) 網站抓取上市、上櫃、興櫃股票資訊
輸出格式：JSON 和 TypeScript
"""

import requests
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple

# 目標 URL
URLS = {
    '上市': 'https://isin.twse.com.tw/isin/C_public.jsp?strMode=2',
    '上櫃': 'https://isin.twse.com.tw/isin/C_public.jsp?strMode=4',
    '興櫃': 'https://isin.twse.com.tw/isin/C_public.jsp?strMode=5',
}

# 輸出路徑
SCRIPT_DIR = Path(__file__).parent
ROOT_DIR = SCRIPT_DIR.parent
OUTPUT_JSON = SCRIPT_DIR / 'stockList.json'
OUTPUT_TS = ROOT_DIR / 'src' / 'utils' / 'stockMap.ts'


def fetch_stock_data(url: str, market_type: str) -> List[Tuple[str, str]]:
    """
    抓取並解析股票資料
    
    Args:
        url: TWSE 的 URL
        market_type: 市場類型 (上市/上櫃/興櫃)
    
    Returns:
        List of (股票代碼, 股票名稱) tuples
    """
    print(f'正在抓取 {market_type} 股票資料...')
    
    try:
        # 設定 headers 模擬瀏覽器
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        response = requests.get(url, headers=headers, timeout=30)
        response.encoding = 'big5'  # TWSE 使用 Big5 編碼
        
        if response.status_code != 200:
            print(f'❌ 抓取失敗: HTTP {response.status_code}')
            return []
        
        html = response.text
        
        # 解析 HTML 表格
        # 格式: <td>代碼\t名稱</td>
        # 範例: <td>1101　台泥</td>
        pattern = r'<td[^>]*>(\d{4,6})[　\s]+([^<\t]+)</td>'
        matches = re.findall(pattern, html)
        
        # 過濾條件：排除特殊股票
        # - 排除認購權證 (代碼通常是 5-6 位數字，且 > 10000)
        # - 排除特別股 (名稱包含「特」)
        # - 只保留普通股和 ETF (4 位數字或 00 開頭的 5-6 位數字)
        stocks = []
        for code, name in matches:
            name = name.strip()
            
            # 只保留 4 位數字的股票代碼 (如 2330, 1101)
            # 或 00 開頭的 5-6 位數字 ETF (如 0050, 00878)
            if len(code) == 4:
                # 普通股：4 位數字
                pass
            elif len(code) in [5, 6] and code.startswith('00'):
                # ETF：00 開頭的 5-6 位數字
                pass
            else:
                # 跳過其他代碼（認購權證等）
                continue
            
            # 跳過特別股
            if '特' in name or 'DR' in name:
                continue
            
            # 跳過空名稱
            if not name:
                continue
            
            stocks.append((code, name))
        
        print(f'✅ {market_type} 抓取完成: {len(stocks)} 檔')
        return stocks
        
    except Exception as e:
        print(f'❌ 抓取 {market_type} 時發生錯誤: {e}')
        return []


def merge_stock_data(all_stocks: Dict[str, List[Tuple[str, str]]]) -> Dict[str, str]:
    """
    合併所有市場的股票資料
    
    Args:
        all_stocks: 各市場的股票資料 dict
    
    Returns:
        合併後的股票清單 {代碼: 名稱}
    """
    merged = {}
    
    for market_type, stocks in all_stocks.items():
        for code, name in stocks:
            if code in merged:
                # 如果已存在，保留較短的名稱（通常更準確）
                if len(name) < len(merged[code]):
                    merged[code] = name
            else:
                merged[code] = name
    
    return merged


def save_json(stock_map: Dict[str, str], output_path: Path):
    """儲存為 JSON 格式"""
    data = {
        'metadata': {
            'generated_at': datetime.now().isoformat(),
            'total_count': len(stock_map),
            'source': 'TWSE ISIN',
        },
        'stocks': stock_map
    }
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f'✅ JSON 檔案已儲存: {output_path}')


def save_typescript(stock_map: Dict[str, str], output_path: Path):
    """儲存為 TypeScript 格式"""
    
    # 生成 TypeScript 內容
    lines = [
        '/**',
        ' * 台灣股票代碼對照表 (自動生成)',
        f' * 生成時間: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}',
        f' * 資料來源: TWSE ISIN',
        f' * 總計: {len(stock_map)} 檔股票',
        ' * ',
        ' * 包含：上市、上櫃、興櫃',
        ' * 警告：此檔案由 scripts/fetchStockList.py 自動生成，請勿手動編輯',
        ' */',
        '',
        'export const STOCK_NAME_MAP: Record<string, string> = {',
    ]
    
    # 排序股票代碼
    sorted_codes = sorted(stock_map.keys())
    
    # 生成每一行
    for code in sorted_codes:
        name = stock_map[code]
        # 轉義單引號
        name_escaped = name.replace("'", "\\'")
        lines.append(f"  '{code}': '{name_escaped}',")
    
    lines.append('};')
    lines.append('')
    
    # 寫入檔案
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    
    print(f'✅ TypeScript 檔案已儲存: {output_path}')


def main():
    """主程序"""
    print('=' * 60)
    print('台灣股票清單爬蟲工具')
    print('=' * 60)
    print()
    
    # 1. 抓取所有市場的股票資料
    all_stocks = {}
    for market_type, url in URLS.items():
        stocks = fetch_stock_data(url, market_type)
        all_stocks[market_type] = stocks
        print()
    
    # 2. 合併資料
    print('正在合併資料...')
    stock_map = merge_stock_data(all_stocks)
    print(f'✅ 合併完成: 總計 {len(stock_map)} 檔股票')
    print()
    
    # 3. 統計資訊
    print('=' * 60)
    print('統計資訊:')
    print('=' * 60)
    for market_type, stocks in all_stocks.items():
        print(f'{market_type}: {len(stocks)} 檔')
    print(f'總計: {len(stock_map)} 檔')
    print()
    
    # 4. 儲存檔案
    print('正在儲存檔案...')
    save_json(stock_map, OUTPUT_JSON)
    save_typescript(stock_map, OUTPUT_TS)
    print()
    
    print('=' * 60)
    print('✅ 完成！')
    print('=' * 60)
    print(f'JSON 檔案: {OUTPUT_JSON}')
    print(f'TypeScript 檔案: {OUTPUT_TS}')
    print()
    
    # 顯示一些範例
    print('範例股票:')
    for i, (code, name) in enumerate(sorted(stock_map.items())[:10]):
        print(f'  {code}: {name}')
    print('  ...')
    print()


if __name__ == '__main__':
    main()
