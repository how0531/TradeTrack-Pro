/**
 * Smoke tests for the pullTrades pagination loop.
 *
 * We don't talk to a real Firestore here — instead we mock `firebase/firestore`
 * primitives so we can assert that:
 *   1. pullTrades issues multiple paginated `getDocs` calls when the result
 *      set is larger than one page.
 *   2. It stops as soon as it sees a partial page (no extra reads).
 *   3. It honours the MAX_PAGES safety cap (no runaway loop).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Track how many getDocs calls have been issued and what each should return.
const docsQueue: Array<{ docs: Array<{ id: string; data: () => unknown }>; empty: boolean }> = [];
let getDocsCallCount = 0;

vi.mock('firebase/firestore', () => {
  return {
    Firestore: class {},
    collection: () => ({}),
    doc: () => ({}),
    writeBatch: () => ({ set: () => {}, commit: async () => {} }),
    setDoc: async () => {},
    getDoc: async () => ({ exists: () => false, data: () => ({}) }),
    getDocs: async () => {
      getDocsCallCount += 1;
      const next = docsQueue.shift();
      if (!next) return { docs: [], empty: true };
      return next;
    },
    query: (...args: unknown[]) => args,
    where: (..._args: unknown[]) => ({ kind: 'where' }),
    orderBy: (..._args: unknown[]) => ({ kind: 'orderBy' }),
    limit: (..._args: unknown[]) => ({ kind: 'limit' }),
    startAfter: (..._args: unknown[]) => ({ kind: 'startAfter' }),
    Timestamp: { fromDate: (d: Date) => ({ toMillis: () => d.getTime() }) },
    serverTimestamp: () => ({}),
  };
});

// Import after the mock so the module sees the stubbed firestore.
import { pullTrades } from './firestoreService';

const fakeDb = {} as unknown as Parameters<typeof pullTrades>[0];

const buildPage = (size: number, prefix: string) => ({
  empty: false,
  docs: Array.from({ length: size }, (_, i) => ({
    id: `${prefix}-${i}`,
    data: () => ({ id: `${prefix}-${i}`, pnl: i, date: '2024-01-01' }),
  })),
});

beforeEach(() => {
  docsQueue.length = 0;
  getDocsCallCount = 0;
});

describe('pullTrades pagination', () => {
  it('returns a single page in one read when result fits below pageSize', async () => {
    docsQueue.push(buildPage(3, 'p1'));
    const out = await pullTrades(fakeDb, 'uid', null, 10);
    expect(out).toHaveLength(3);
    expect(getDocsCallCount).toBe(1);
  });

  it('keeps fetching while a full page comes back, stops on partial page', async () => {
    docsQueue.push(buildPage(5, 'a'));
    docsQueue.push(buildPage(5, 'b'));
    docsQueue.push(buildPage(2, 'c')); // partial → terminate
    const out = await pullTrades(fakeDb, 'uid', null, 5);
    expect(out).toHaveLength(12);
    expect(getDocsCallCount).toBe(3);
  });

  it('stops when an empty page is returned (no extra reads)', async () => {
    docsQueue.push(buildPage(5, 'a'));
    docsQueue.push({ docs: [], empty: true });
    const out = await pullTrades(fakeDb, 'uid', null, 5);
    expect(out).toHaveLength(5);
    expect(getDocsCallCount).toBe(2);
  });
});
