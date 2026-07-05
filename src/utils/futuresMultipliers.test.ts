/**
 * v3.9.1 迴歸測試 — H4: 期貨每點價值查表。
 * 舊 includes() 鏈的兩類錯誤都要鎖住：Shioaji API 代碼 miss、前綴誤配。
 */
import { describe, expect, it } from 'vitest';
import { getFuturesMultiplier } from './futuresMultipliers';

describe('getFuturesMultiplier', () => {
    it('resolves Shioaji API codes (previously all missed → 200)', () => {
        expect(getFuturesMultiplier('MXF05')).toBe(50);    // 小台 — 舊 bug: 200（點數錯 4 倍）
        expect(getFuturesMultiplier('MXFF6')).toBe(50);
        expect(getFuturesMultiplier('TMFF6')).toBe(10);    // 微台 — 舊 bug: 200（錯 20 倍）
        expect(getFuturesMultiplier('EXFF6')).toBe(4000);  // 電子
        expect(getFuturesMultiplier('ZEFF6')).toBe(500);   // 小電子
        expect(getFuturesMultiplier('FXFF6')).toBe(1000);  // 金融
        expect(getFuturesMultiplier('ZFFF6')).toBe(250);   // 小金融
        expect(getFuturesMultiplier('TXFF6')).toBe(200);   // 大台
    });

    it('does not mis-match prefixes (previously GTF→TF, MTE→TE)', () => {
        expect(getFuturesMultiplier('GTFF6')).toBe(100);   // 黃金 — 舊 bug: includes('TF') → 1000
        expect(getFuturesMultiplier('MTE06')).toBe(500);   // 小電子 — 舊 bug: includes('TE') → 4000
    });

    it('resolves Chinese display names with longest-keyword priority', () => {
        expect(getFuturesMultiplier('小台05')).toBe(50);
        expect(getFuturesMultiplier('微台06')).toBe(10);
        expect(getFuturesMultiplier('小電子期')).toBe(500);   // 不被「電子」搶先
        expect(getFuturesMultiplier('電子期06')).toBe(4000);
        expect(getFuturesMultiplier('小金融期')).toBe(250);
        expect(getFuturesMultiplier('金融期06')).toBe(1000);
        expect(getFuturesMultiplier('大台03')).toBe(200);
    });

    it('falls back to 200 for unknown / empty codes', () => {
        expect(getFuturesMultiplier('')).toBe(200);
        expect(getFuturesMultiplier(null)).toBe(200);
        expect(getFuturesMultiplier(undefined)).toBe(200);
        expect(getFuturesMultiplier('UNKNOWN99')).toBe(200);
    });

    it('legacy TAIFEX website codes still work (backward compat)', () => {
        expect(getFuturesMultiplier('MTX06')).toBe(50);
        expect(getFuturesMultiplier('TXO06')).toBe(50);
    });
});
