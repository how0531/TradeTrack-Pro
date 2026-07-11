/**
 * isTradeDirty — dirty-flag 同步 (v3.9.3) 的核心判定。
 * dirty = !syncedAt || updatedAt > syncedAt
 */
import { describe, it, expect } from 'vitest';
import { isTradeDirty } from './useSync';
import { Trade } from '../types';

const base = { id: 't1', date: '2026-07-01', pnl: 100 } as unknown as Trade;

describe('isTradeDirty', () => {
  it('無 syncedAt → dirty（新建立 / 本機 mutation 清空後 / v2 升級既有資料）', () => {
    expect(isTradeDirty({ ...base })).toBe(true);
    expect(isTradeDirty({ ...base, updatedAt: '2026-07-01T00:00:00.000Z' })).toBe(true);
  });

  it('updatedAt > syncedAt → dirty（推送後又被編輯）', () => {
    expect(isTradeDirty({
      ...base,
      updatedAt: '2026-07-02T00:00:00.000Z',
      syncedAt: '2026-07-01T00:00:00.000Z',
    })).toBe(true);
  });

  it('updatedAt === syncedAt → clean（pull 套用的雲端副本）', () => {
    expect(isTradeDirty({
      ...base,
      updatedAt: '2026-07-01T00:00:00.000Z',
      syncedAt: '2026-07-01T00:00:00.000Z',
    })).toBe(false);
  });

  it('updatedAt < syncedAt → clean（push 標記時間晚於最後編輯）', () => {
    expect(isTradeDirty({
      ...base,
      updatedAt: '2026-07-01T00:00:00.000Z',
      syncedAt: '2026-07-01T00:00:05.000Z',
    })).toBe(false);
  });

  it('有 syncedAt 但無 updatedAt → clean（不會因缺欄位重複推送）', () => {
    expect(isTradeDirty({ ...base, syncedAt: '2026-07-01T00:00:00.000Z' })).toBe(false);
  });

  it('軟刪除後（updatedAt 更新、syncedAt 清空）→ dirty，刪除會隨 push 傳播', () => {
    expect(isTradeDirty({
      ...base,
      isDeleted: true,
      updatedAt: '2026-07-03T00:00:00.000Z',
      syncedAt: undefined,
    })).toBe(true);
  });
});
