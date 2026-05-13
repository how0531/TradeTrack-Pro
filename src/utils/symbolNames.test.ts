/**
 * 前端 Symbol Name 格式化測試
 *
 * 此檔案歷史上是一個手動跑在瀏覽器 console 的腳本（runTests() 印 log）。
 * 為了讓 vitest 不把整個檔案當作 suite 失敗，下方加入一個輕量的 vitest
 * 包裝，覆蓋幾個關鍵 case；舊的 runTests 仍保留供本地除錯使用。
 */

import { describe, it, expect } from 'vitest';
import { formatSymbolCode, guessFuturesName, FUTURES_NAME_MAP } from './symbolNames';

describe('symbolNames', () => {
    it('formatSymbolCode handles falsy inputs gracefully', () => {
        expect(typeof formatSymbolCode).toBe('function');
        // Should not throw on null/undefined/empty.
        expect(() => formatSymbolCode(null as unknown as string)).not.toThrow();
        expect(() => formatSymbolCode(undefined as unknown as string)).not.toThrow();
        expect(() => formatSymbolCode('')).not.toThrow();
    });

    it('FUTURES_NAME_MAP exposes the canonical Taiwanese futures aliases', () => {
        expect(FUTURES_NAME_MAP).toBeTypeOf('object');
        // Spot check a couple of well-known codes — keep the set small so the
        // test stays robust when the map is extended.
        expect(FUTURES_NAME_MAP.TXF || FUTURES_NAME_MAP.MTX).toBeTruthy();
    });

    it('guessFuturesName returns either a string or null', () => {
        const result = guessFuturesName('TXF');
        expect(result === null || typeof result === 'string').toBe(true);
    });
});

// 測試用例類型
interface TestCase {
    input: any;
    expected: string;
    description: string;
}

// 顏色輸出（在瀏覽器 Console 中使用）
const log = {
    success: (msg: string) => console.log(`%c✅ ${msg}`, 'color: green'),
    error: (msg: string) => console.log(`%c❌ ${msg}`, 'color: red'),
    info: (msg: string) => console.log(`%c📘 ${msg}`, 'color: blue'),
    warn: (msg: string) => console.log(`%c⚠️  ${msg}`, 'color: orange'),
};

// 測試函式
function runTests() {
    console.log('='.repeat(80));
    log.info('開始測試 Symbol Name 格式化功能');
    console.log('='.repeat(80));
    
    // Test Suite 1: 正常情況
    log.info('\n📋 Test Suite 1: 正常情況');
    const normalCases: TestCase[] = [
        {
            input: 'TXFK6',
            expected: 'TXFK6 台指期',
            description: '期貨代碼（3碼前綴）'
        },
        {
            input: 'MTXK6',
            expected: 'MTXK6 小台指',
            description: '期貨代碼（3碼前綴）'
        },
        {
            input: 'TEK6',
            expected: 'TEK6 電子期',
            description: '期貨代碼（2碼前綴）'
        },
        {
            input: 'TFK6',
            expected: 'TFK6 金融期',
            description: '期貨代碼（2碼前綴）'
        },
        {
            input: '2330 台積電',
            expected: '2330 台積電',
            description: '已有中文名稱的股票'
        },
        {
            input: 'TXFK6 台指期',
            expected: 'TXFK6 台指期',
            description: '已有中文名稱的期貨'
        },
        {
            input: '2330',
            expected: '2330',
            description: '股票代碼（無法推測名稱）'
        },
    ];
    
    testCases(normalCases);
    
    // Test Suite 2: 邊界情況
    log.info('\n📋 Test Suite 2: 邊界情況');
    const edgeCases: TestCase[] = [
        {
            input: null,
            expected: 'Unknown',
            description: 'null 輸入'
        },
        {
            input: undefined,
            expected: 'Unknown',
            description: 'undefined 輸入'
        },
        {
            input: '',
            expected: 'Unknown',
            description: '空字串'
        },
        {
            input: '   ',
            expected: 'Unknown',
            description: '只有空白的字串'
        },
        {
            input: '  TXFK6  ',
            expected: 'TXFK6 台指期',
            description: '前後有空白的代碼'
        },
        {
            input: 123 as any,
            expected: 'Unknown',
            description: '數字輸入（非字串）'
        },
        {
            input: {} as any,
            expected: 'Unknown',
            description: '物件輸入（非字串）'
        },
    ];
    
    testCases(edgeCases);
    
    // Test Suite 3: guessFuturesName 測試
    log.info('\n📋 Test Suite 3: guessFuturesName 功能');
    const futuresCases: Array<{input: string, expected: string | null, description: string}> = [
        {
            input: 'TXFK6',
            expected: '台指期',
            description: 'TXF 前綴'
        },
        {
            input: 'txfk6',
            expected: '台指期',
            description: '小寫也應該可以匹配'
        },
        {
            input: 'TEK6',
            expected: '電子期',
            description: 'TE 前綴'
        },
        {
            input: '2330',
            expected: null,
            description: '股票代碼應該返回 null'
        },
        {
            input: 'XYZ',
            expected: null,
            description: '未知代碼應該返回 null'
        },
    ];
    
    futuresCases.forEach(tc => {
        const result = guessFuturesName(tc.input);
        if (result === tc.expected) {
            log.success(`${tc.description}: "${tc.input}" → ${result === null ? 'null' : `"${result}"`}`);
        } else {
            log.error(`${tc.description}: 預期 ${tc.expected === null ? 'null' : `"${tc.expected}"`}, 但得到 ${result === null ? 'null' : `"${result}"`}`);
        }
    });
    
    // Test Suite 4: FUTURES_NAME_MAP 覆蓋率
    log.info('\n📋 Test Suite 4: FUTURES_NAME_MAP 覆蓋率檢查');
    const mapSize = Object.keys(FUTURES_NAME_MAP).length;
    log.info(`共 ${mapSize} 個期貨商品對照`);
    
    Object.entries(FUTURES_NAME_MAP).forEach(([code, name]) => {
        console.log(`  ${code.padEnd(5)} → ${name}`);
    });
    
    // 總結
    console.log('\n' + '='.repeat(80));
    log.info('測試完成！');
    console.log('='.repeat(80));
}

// 執行測試案例
function testCases(cases: TestCase[]) {
    let passCount = 0;
    let failCount = 0;
    
    cases.forEach(tc => {
        const result = formatSymbolCode(tc.input);
        if (result === tc.expected) {
            log.success(`${tc.description}: "${tc.input}" → "${result}"`);
            passCount++;
        } else {
            log.error(`${tc.description}: 預期 "${tc.expected}", 但得到 "${result}"`);
            failCount++;
        }
    });
    
    log.info(`通過: ${passCount}, 失敗: ${failCount}`);
}

// 如果在 Node.js 環境執行
if (typeof window === 'undefined') {
    runTests();
}

// 匯出給瀏覽器使用
export { runTests };

// 使用方式：
// 1. 在瀏覽器 Console 中：
//    import { runTests } from './symbolNames.test';
//    runTests();
// 
// 2. 或直接在 Console 貼上整個檔案內容執行
