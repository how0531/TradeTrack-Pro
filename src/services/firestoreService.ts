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
  limit as fsLimit,
  startAfter,
  Query,
  QueryConstraint,
  QueryDocumentSnapshot,
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
 *
 * 採用游標分頁 (limit + startAfter) 以避免一次撈光整個 collection；
 * 對於老帳號 (數千筆 trade) 可大幅降低 Firestore read quota 與
 * 客戶端記憶體峰值。每頁預設 500 筆，與 push 的 batch 大小對齊。
 */
const DEFAULT_PAGE_SIZE = 500;

export const pullTrades = async (
  db: Firestore,
  uid: string,
  since: Date | null,
  pageSize: number = DEFAULT_PAGE_SIZE,
): Promise<Trade[]> => {
  const col = tradesCol(db, uid);
  const baseConstraints: QueryConstraint[] = since
    ? [where('updatedAt', '>', Timestamp.fromDate(since)), orderBy('updatedAt', 'asc')]
    : [orderBy('updatedAt', 'asc')];

  const out: Trade[] = [];
  let cursor: QueryDocumentSnapshot<DocumentData> | null = null;
  // Hard ceiling so a runaway loop can't burn the read quota.
  const MAX_PAGES = 200;

  for (let page = 0; page < MAX_PAGES; page++) {
    const q: Query<DocumentData> = cursor
      ? query(col, ...baseConstraints, startAfter(cursor), fsLimit(pageSize))
      : query(col, ...baseConstraints, fsLimit(pageSize));

    const snap = await getDocs(q);
    if (snap.empty) break;

    for (const d of snap.docs) {
      out.push(firestoreDocToTrade(d.id, d.data()));
    }
    if (snap.docs.length < pageSize) break;
    cursor = snap.docs[snap.docs.length - 1];
  }

  return out;
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

/**
 * B1d (v3.9.2): 完整清除某使用者的雲端資料 — v2 sub-collection 版。
 *
 * resetAllData 以前只覆寫 v1 legacy blob（users/{uid}），但 v2 同步管線
 * 讀寫的是 users/{uid}/trades 子集合與 users/{uid}/metadata/main —
 * 重置後下次登入 since=null 全量 pull 又把「已重置」的資料整批拉回來。
 *
 * Firestore client SDK 沒有 deleteCollection：逐頁撈 id + writeBatch 刪，
 * 每批 400（低於 500 上限留餘裕）。
 */
export const wipeCloudData = async (db: Firestore, uid: string): Promise<void> => {
  // 1. 刪 trades 子集合（分頁批刪直到空）
  const col = tradesCol(db, uid);
  // 迴圈上限防禦：100 頁 × 400 = 4 萬筆，超過即中止（避免規則異常時無限迴圈）
  for (let page = 0; page < 100; page++) {
    const snap = await getDocs(query(col, fsLimit(400)));
    if (snap.empty) break;
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    if (snap.size < 400) break;
  }

  // 2. 重置 metadata/main（清空 + 蓋新的 lastUpdated，讓他機 onSnapshot 拉到空狀態）
  await setDoc(metadataDoc(db, uid), {
    portfolios: [],
    strategies: [],
    emotions: [],
    settings: {},
    lastUpdated: serverTimestamp(),
  });

  // 3. 清 v1 legacy blob（維持原行為）
  await setDoc(legacyDoc(db, uid), {
    trades: [],
    strategies: [],
    emotions: [],
    portfolios: [],
    settings: {},
    lastUpdated: serverTimestamp(),
  });
};
