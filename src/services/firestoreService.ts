/**
 * firestoreService.ts
 * 
 * Firestore 讀寫服務層 (Incremental Sync Architecture)
 * 
 * 架構：
 *   users/{uid}/metadata        — 設定、Portfolio、最後同步時間
 *   users/{uid}/trades/{tradeId} — 每筆交易各自一個 Document
 * 
 * 增量同步原則：
 *   - 每筆 trade 都帶有 updatedAt (Firestore Timestamp)
 *   - 拉取時只取 updatedAt > lastSyncTime 的異動紀錄
 *   - 刪除改為軟刪除 (isDeleted: true + updatedAt)
 */

import {
  Firestore,
  collection,
  doc,
  writeBatch,
  getDocs,
  getDoc,
  setDoc,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp,
  DocumentData,
} from 'firebase/firestore';
import { Trade, Portfolio } from '../types';

// ─────────────── Types ───────────────

export interface FirestoreMetadata {
  portfolios: Portfolio[];
  strategies: string[];
  emotions: string[];
  settings: { lossColor: string };
  lastUpdated: Timestamp | null;
  /** 標記此帳號已完成舊版 blob 遷移 */
  migrated?: boolean;
  /** Schema version for future migrations */
  schemaVersion?: number;
}

// ─────────────── Paths ───────────────

const tradesCol = (db: Firestore, uid: string) =>
  collection(db, 'users', uid, 'trades');

const metadataDoc = (db: Firestore, uid: string) =>
  doc(db, 'users', uid, 'metadata', 'main');

const legacyDoc = (db: Firestore, uid: string) =>
  doc(db, 'users', uid);

// ─────────────── Push: Trades ───────────────

/**
 * 批次推送 trades 至 Firestore sub-collection。
 * 每筆 trade 以其 id 作為 document key，serverTimestamp() 作為 updatedAt。
 * 最大批次大小 500 筆 (Firestore 限制)。
 */
export const pushTrades = async (
  db: Firestore,
  uid: string,
  trades: Trade[]
): Promise<void> => {
  if (trades.length === 0) return;

  const col = tradesCol(db, uid);
  const now = serverTimestamp();
  const CHUNK = 450; // 保留緩衝低於 Firestore 500 limit

  for (let i = 0; i < trades.length; i += CHUNK) {
    const batch = writeBatch(db);
    const slice = trades.slice(i, i + CHUNK);
    slice.forEach((trade) => {
      const ref = doc(col, trade.id);
      batch.set(ref, {
        ...sanitizeForFirestore(trade),
        updatedAt: now,
      }, { merge: true });
    });
    await batch.commit();
  }
};

/**
 * 軟刪除：將 trade 標記為 isDeleted:true 並更新 updatedAt
 */
export const softDeleteTrade = async (
  db: Firestore,
  uid: string,
  tradeId: string
): Promise<void> => {
  const ref = doc(tradesCol(db, uid), tradeId);
  await setDoc(ref, {
    id: tradeId,
    isDeleted: true,
    updatedAt: serverTimestamp(),
  }, { merge: true });
};

// ─────────────── Pull: Trades ───────────────

/**
 * 增量拉取：取得 updatedAt > since 的所有 trade (含軟刪除)
 * since 為 null 代表全量拉取 (首次同步或遷移後初始化)
 */
export const pullTrades = async (
  db: Firestore,
  uid: string,
  since: Date | null
): Promise<Trade[]> => {
  const col = tradesCol(db, uid);

  let q;
  if (since) {
    const sinceTs = Timestamp.fromDate(since);
    q = query(col, where('updatedAt', '>', sinceTs), orderBy('updatedAt', 'asc'));
  } else {
    q = query(col, orderBy('updatedAt', 'asc'));
  }

  const snap = await getDocs(q);
  return snap.docs.map((d) => firestoreDocToTrade(d.id, d.data()));
};

// ─────────────── Metadata ───────────────

export const pushMetadata = async (
  db: Firestore,
  uid: string,
  meta: Partial<FirestoreMetadata>
): Promise<void> => {
  const ref = metadataDoc(db, uid);
  await setDoc(ref, {
    ...sanitizeForFirestore(meta),
    lastUpdated: serverTimestamp(),
    schemaVersion: 2,
  }, { merge: true });
};

export const pullMetadata = async (
  db: Firestore,
  uid: string
): Promise<FirestoreMetadata | null> => {
  const snap = await getDoc(metadataDoc(db, uid));
  if (!snap.exists()) return null;
  return snap.data() as FirestoreMetadata;
};

// ─────────────── Legacy Migration ───────────────

/**
 * 從舊版 blob 格式遷移至新版 sub-collection 格式。
 * 本函式為 idempotent，重複執行無副作用。
 */
export const migrateFromLegacy = async (
  db: Firestore,
  uid: string
): Promise<{ migrated: boolean; tradeCount: number }> => {
  // 1. 確認 metadata 是否已標記為已遷移
  const meta = await pullMetadata(db, uid);
  if (meta?.migrated) {
    console.log('[Migration] Already migrated, skipping.');
    return { migrated: false, tradeCount: 0 };
  }

  // 2. 讀取舊版 blob document
  const legacySnap = await getDoc(legacyDoc(db, uid));
  if (!legacySnap.exists()) {
    // 新使用者，無舊資料，直接標記完成
    await pushMetadata(db, uid, { migrated: true, schemaVersion: 2 });
    return { migrated: true, tradeCount: 0 };
  }

  const legacyData = legacySnap.data();
  const trades: Trade[] = legacyData.trades || [];

  console.log(`[Migration] Migrating ${trades.length} trades from legacy blob format...`);

  // 3. 推送至新 sub-collection
  const now = new Date().toISOString();
  const tradesWithTimestamp = trades.map((t) => ({
    ...t,
    updatedAt: t.updatedAt || now,
    isDeleted: false,
  }));
  await pushTrades(db, uid, tradesWithTimestamp);

  // 4. 推送 metadata (portfolios, settings, etc.)
  await pushMetadata(db, uid, {
    portfolios: legacyData.portfolios || [],
    strategies: legacyData.strategies || [],
    emotions: legacyData.emotions || [],
    settings: legacyData.settings || { lossColor: '#ef4444' },
    migrated: true,
    schemaVersion: 2,
  });

  console.log(`[Migration] ✅ Migrated ${trades.length} trades. Legacy blob preserved.`);
  return { migrated: true, tradeCount: trades.length };
};

// ─────────────── Helpers ───────────────

/**
 * Firestore document data → Trade object
 * 將 Firestore Timestamp 轉為 ISO string 以符合 Trade 型別
 */
const firestoreDocToTrade = (id: string, data: DocumentData): Trade => {
  const updatedAt = data.updatedAt;
  let updatedAtStr: string | undefined;

  if (updatedAt && typeof updatedAt.toDate === 'function') {
    updatedAtStr = updatedAt.toDate().toISOString();
  } else if (typeof updatedAt === 'string') {
    updatedAtStr = updatedAt;
  }

  return {
    ...data,
    id: data.id || id,
    updatedAt: updatedAtStr,
  } as Trade;
};

/**
 * 移除 undefined 值，確保 Firestore setDoc 不因 undefined 而失敗
 */
const sanitizeForFirestore = (obj: any): any => {
  return JSON.parse(JSON.stringify(obj, (_key, value) =>
    value === undefined ? null : value
  ));
};
