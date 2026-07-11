/**
 * useSync.ts
 *
 * 增量同步 Hook (Incremental Sync Architecture v3 — dirty-flag)
 *
 * 核心設計：
 *  - 推送 (Push): 直接讀 Dexie，推送所有 dirty 的交易
 *      dirty = !syncedAt || updatedAt > syncedAt（皆為本機時鐘域）。
 *      v2 用全域水位 app_last_sync_time 當推送過濾器，但 pull 也會推進
 *      同一個水位 → 尚未推送的本機交易被永久排除在 push 之外（靜默遺失）。
 *      v3 的 push 資格完全由每筆交易自己的 dirty 狀態決定，與 pull 無關。
 *      直接讀 Dexie 也修掉兩個 v2 缺陷：dataRef 快照趕不上 350ms debounce
 *      的競態，以及 useLiveQuery 預先濾掉 isDeleted → 軟刪除永遠不同步、
 *      他機資料復活。
 *  - 拉取 (Pull): 水位只當 pull cursor（updatedAt > since，雲端伺服器時鐘域）
 *  - 刪除 (Delete): 軟刪除 isDeleted: true → 變 dirty → 隨 push 傳播
 *  - 感知 (Listen): onSnapshot 監聽輕量 metadata document，有更新才增量 pull
 *  - 遷移 (Migrate): 首次登入自動將舊版 blob 格式搬遷至 sub-collection
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, onSnapshot, Timestamp, Firestore } from 'firebase/firestore';
import { SyncStatus, User, Trade, Portfolio } from '../types';
import { friendlyMessage } from '../utils/errors';
import { db as localDb } from '../db';
import {
  pushTrades,
  pullTrades,
  pushMetadata,
  pullMetadata,
  migrateFromLegacy,
} from '../services/firestoreService';

// ─────────────────────────────────────────────────────────────
// Dirty 判定與 pull cursor（皆為模組層 helper，無 React 依賴）
// ─────────────────────────────────────────────────────────────

/** 這筆交易是否有尚未推送的本機變更。updatedAt/syncedAt 同為本機 ISO 字串，可字典序比較。 */
export const isTradeDirty = (t: Trade): boolean => {
  if (!t.syncedAt) return true;
  return !!t.updatedAt && t.updatedAt > t.syncedAt;
};

/**
 * Pull cursor 存放：綁定 uid，換帳號登入不會沿用前帳號的水位。
 * 值為 JSON {uid, time}。舊的裸字串 key（app_last_sync_time）無法辨識
 * 所屬帳號 → 一律視為無效並清除（代價只是一次全量 pull）。
 */
const SYNC_CURSOR_KEY = 'app_last_sync_time_v2';
const LEGACY_SYNC_KEY = 'app_last_sync_time';

const readSyncCursor = (uid: string): string => {
  try {
    localStorage.removeItem(LEGACY_SYNC_KEY);
    const raw = localStorage.getItem(SYNC_CURSOR_KEY);
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    return parsed?.uid === uid && typeof parsed.time === 'string' ? parsed.time : '';
  } catch {
    return '';
  }
};

const writeSyncCursor = (uid: string, iso: string) => {
  try {
    localStorage.setItem(SYNC_CURSOR_KEY, JSON.stringify({ uid, time: iso }));
  } catch { /* quota/private mode — cursor 失效只導致下次全量 pull */ }
};

/** Firestore Timestamp / Date / {seconds} / ISO string → Date（無法解析回傳 null） */
const toDateSafe = (v: any): Date | null => {
  if (!v) return null;
  if (typeof v.toDate === 'function') return v.toDate();
  if (v instanceof Date) return v;
  if (typeof v.seconds === 'number') return new Timestamp(v.seconds, v.nanoseconds || 0).toDate();
  if (typeof v === 'string') {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};

interface SyncData {
  trades: Trade[];
  strategies: string[];
  emotions: string[];
  portfolios: Portfolio[];
  lossColor: string;
  settings?: { lossColor: string };
}

interface UseSyncProps {
  user: User | null;
  authStatus: string;
  db: Firestore;
  data: SyncData;
  /**
   * 當從雲端拉取到異動時的回呼，含需套用的 trade patches 與 metadata。
   * opts.force = 使用者明確要求「以雲端為準」（手動還原）— 套用時
   * 連本機 dirty 的交易也覆蓋；背景增量 pull 不帶 force，dirty 本機優先。
   */
  onPull: (patches: {
    trades?: Trade[];
    strategies?: string[];
    emotions?: string[];
    portfolios?: Portfolio[];
    settings?: { lossColor: string };
    lastUpdated?: any;
  }, opts?: { force?: boolean }) => void | Promise<void>;
}

// ─────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────

export const useSync = ({ user, authStatus, db, data, onPull }: UseSyncProps) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('offline');
  const [lastBackupTime, setLastBackupTime] = useState<Date | null>(null);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [conflictStats] = useState<{
    localCount: number; cloudCount: number; duplicateCount: number;
  } | null>(null);

  // Refs to prevent stale closures
  const dataRef = useRef(data);
  const userRef = useRef(user);
  // onPull 通常是 caller 每次 render 重建的 inline arrow — 走 ref 讓
  // onSnapshot effect 不必把它列入 deps（否則每次 render 都 resubscribe）。
  const onPullRef = useRef(onPull);
  const lastPullTimeRef = useRef<number>(0);
  const migrationDoneRef = useRef(false);

  // ─── Sync mutex ───
  // push、pull（抓取＋套用＋cursor 推進）、smart-merge 共用同一把鎖，
  // promise chain 依呼叫順序排隊。沒有這把鎖時 push 與 pull 可自由交錯：
  // pull 抓回舊雲端資料 → push 把剛編輯的交易標 clean → pull 套用時
  // dirty-skip 失效 → 舊資料蓋回本機且被標 clean，編輯靜默回滾且永不重推。
  // （舊 inFlightPushRef 只擋 push-vs-push，且撞上時早退回傳假 success，
  //  騙過 smart-merge / 登出的 await 語意 — 一併由這把鎖取代。）
  const syncMutexRef = useRef<Promise<unknown>>(Promise.resolve());
  const runExclusive = useCallback(<T,>(fn: () => Promise<T>): Promise<T> => {
    const run = syncMutexRef.current.then(fn, fn);
    // 失敗不阻斷後續排隊者
    syncMutexRef.current = run.catch(() => undefined);
    return run;
  }, []);

  useEffect(() => { dataRef.current = data; }, [data]);
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { onPullRef.current = onPull; }, [onPull]);

  // ─── Helper: pull cursor（uid 綁定）→ Date ───
  const getLastSyncDate = useCallback((): Date | null => {
    const uid = userRef.current?.uid;
    if (!uid) return null;
    const str = readSyncCursor(uid);
    if (!str) return null;
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }, []);

  // ─── Helper: save pull cursor ───
  const saveSyncTime = useCallback((date: Date) => {
    const uid = userRef.current?.uid;
    if (uid) writeSyncCursor(uid, date.toISOString());
    setLastBackupTime(date);
  }, []);

  // ─── Migration: 首次使用自動搬遷舊版 blob 格式 ───
  const runMigrationIfNeeded = useCallback(async (uid: string) => {
    if (migrationDoneRef.current) return;
    migrationDoneRef.current = true;

    try {
      const result = await migrateFromLegacy(db, uid);
      if (result.migrated && result.tradeCount > 0) {
        console.log(`✅ [Sync] Legacy migration completed: ${result.tradeCount} trades moved.`);
        // 遷移後，把舊資料同步到本地（持鎖，避免與 push 交錯）
        await runExclusive(async () => {
          const patches = await doPull(uid, null);
          if (patches) await onPullRef.current(patches);
        });
      }
    } catch (e) {
      console.warn('[Sync] Migration error (non-fatal):', e);
    }
  }, [db]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Core: Incremental Pull ───
  const doPull = useCallback(async (uid: string, since: Date | null) => {
    try {
      const [changedTrades, meta] = await Promise.all([
        pullTrades(db, uid, since),
        pullMetadata(db, uid),
      ]);

      const patches: Parameters<typeof onPull>[0] = {};

      if (changedTrades.length > 0) {
        patches.trades = changedTrades; // onPull 負責合併 / 軟刪除處理
      }
      if (meta) {
        if (meta.portfolios?.length) patches.portfolios = meta.portfolios;
        if (meta.strategies?.length) patches.strategies = meta.strategies;
        if (meta.emotions?.length) patches.emotions = meta.emotions;
        if (meta.settings) patches.settings = meta.settings;
        if (meta.lastUpdated) patches.lastUpdated = meta.lastUpdated;
      }

      return patches;
    } catch (e) {
      console.error('[Sync] doPull failed:', e);
      throw e;
    }
  }, [db]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Cloud Backup (Push) ───
  // runExclusive 序列化：並發呼叫依序完整執行（後到者通常找不到 dirty，
  // 只重推一次輕量 metadata）。callers await 到的是「真正落地」的結果 —
  // 舊版 in-flight 早退回傳假 success，會騙過登出守門與 smart-merge。
  const triggerCloudBackup = useCallback((): Promise<{ success: boolean; error?: string }> => {
    if (!user || authStatus !== 'online') {
      setSyncStatus('offline');
      return Promise.resolve({ success: false, error: 'User is offline' });
    }
    const uid = user.uid;

    return runExclusive(async () => {
      setSyncStatus('saving');
      setIsSyncing(true);
      try {
        const now = new Date();
        const nowIso = now.toISOString();
        const currentData = dataRef.current;

        // 直接讀 Dexie（含軟刪除），推送所有 dirty 的交易。
        // 不經 dataRef：React 快照可能落後 Dexie 寫入（350ms debounce 競態），
        // 且 useLiveQuery 預先濾掉 isDeleted → 軟刪除永遠推不出去。
        const allTrades = await localDb.trades.toArray();
        const tradesToPush = allTrades.filter(isTradeDirty);

        if (tradesToPush.length > 0) {
          await pushTrades(db, uid, tradesToPush.map(t => ({
            ...t,
            updatedAt: t.updatedAt || nowIso,
            isDeleted: t.isDeleted ?? false,
          })));

          // 標記已同步 — 只在 updatedAt 沒被 push 期間的新編輯改動時才標，
          // 否則會把「推送中又被使用者改過」的交易誤標成 clean。
          // 標記值用該筆自己的 updatedAt（＝被推送的版本），不用 push 時刻
          // 的 nowIso — 本機時鐘回撥時 nowIso < updatedAt 會讓交易永遠
          // dirty（每次備份重推、雲端更新永遠被 dirty-skip 擋掉）。
          const pushedUpdatedAt = new Map(tradesToPush.map(t => [t.id, t.updatedAt]));
          await localDb.trades
            .where('id').anyOf(tradesToPush.map(t => t.id))
            .modify(t => {
              if (t.updatedAt === pushedUpdatedAt.get(t.id)) {
                t.syncedAt = t.updatedAt || nowIso;
              }
            });
        }

        // 推送 metadata (portfolios, settings 每次都推送，資料量小)
        await pushMetadata(db, uid, {
          portfolios: currentData.portfolios,
          strategies: currentData.strategies,
          emotions: currentData.emotions,
          settings: { lossColor: currentData.lossColor },
        });

        // 注意：push 不再推進 pull cursor —— cursor 是雲端伺服器時鐘域，
        // 由 pull 路徑用雲端 lastUpdated 推進（v2 用本機 now 蓋 cursor 混時鐘域）。
        setLastBackupTime(now);
        lastPullTimeRef.current = Date.now();
        setSyncStatus('synced');
        setSyncError(null);
        return { success: true };
      } catch (e: any) {
        console.error('[Sync] Backup failed:', e);
        setSyncStatus('error');
        const msg = friendlyMessage(e);
        setSyncError(msg);
        return { success: false, error: msg };
      } finally {
        setIsSyncing(false);
      }
    });
  }, [user, authStatus, db, runExclusive]);

  // ─── Manual Pull (使用者手動點「從雲端還原」) ───
  const manualPull = useCallback((): Promise<{ success: boolean; error?: string }> => {
    if (!user || authStatus !== 'online') {
      return Promise.resolve({ success: false, error: 'User is offline' });
    }
    const uid = user.uid;
    return runExclusive(async () => {
      setSyncStatus('saving');
      try {
        // 手動拉取一律做全量 (since: null) 確保資料完整。
        // force：使用者明確要「以雲端為準」，dirty 本機交易也覆蓋 —
        // 否則誤刪後點「雲端還原」救不回被軟刪除（dirty）的交易。
        const patches = await doPull(uid, null);
        if (patches) await onPullRef.current(patches, { force: true });

        // Cursor 用雲端 metadata 的 lastUpdated（伺服器時鐘域）推進；
        // 沒有 meta 時退回本機時間（僅影響下次增量 pull 的起點）。
        const cursorDate = toDateSafe(patches?.lastUpdated) || new Date();
        saveSyncTime(cursorDate);
        lastPullTimeRef.current = Date.now();
        setSyncStatus('synced');
        setSyncError(null);
        return { success: true };
      } catch (e: any) {
        console.error('[Sync] Manual pull failed:', e);
        setSyncStatus('error');
        const msg = friendlyMessage(e);
        setSyncError(msg);
        return { success: false, error: msg };
      }
    });
  }, [user, authStatus, doPull, saveSyncTime, runExclusive]);

  // ─── Listener: metadata 異動 → 觸發增量拉取 ───
  useEffect(() => {
    if (!user || authStatus !== 'online') return;

    // 登入後先做遷移確認
    runMigrationIfNeeded(user.uid);

    // 監聽輕量的 metadata document (不再監聽含所有 trades 的大 blob)
    const metaRef = doc(db, 'users', user.uid, 'metadata', 'main');
    const unsubscribe = onSnapshot(metaRef, (snap) => {
      if (!snap.exists()) return;
      if (snap.metadata.hasPendingWrites) return;

      const cloudUpdated = toDateSafe(snap.data()?.lastUpdated);

      // 整段（防護判斷 → 抓取 → 套用 → cursor 推進）持鎖執行。
      // 防護必須在鎖內重查：排隊等鎖期間可能剛有 push/pull 完成，
      // 鎖外先查會拿到過期判斷（舊版正是 pull 抓取與 push 交錯造成
      // 「舊雲端資料蓋掉剛編輯內容」的回滾缺陷）。
      runExclusive(async () => {
        // 5 秒內剛推送/拉取過，不重複拉
        if (Date.now() - lastPullTimeRef.current < 5000) return;

        const since = getLastSyncDate();
        const localTime = since?.getTime() ?? 0;
        const cloudTime = cloudUpdated?.getTime() ?? 0;

        // 雲端比本地新 (>10 秒緩衝) → 增量拉取
        if (cloudTime > localTime + 10000) {
          console.log(`[Sync] Detected remote update (cloud: ${cloudUpdated?.toISOString()}), pulling delta since ${since?.toISOString()}...`);
          const patches = await doPull(user.uid, since);
          if (patches && (patches.trades?.length || patches.portfolios?.length)) {
            await onPullRef.current(patches);
            if (cloudUpdated) saveSyncTime(cloudUpdated);
            lastPullTimeRef.current = Date.now();
            setSyncStatus('synced');
          } else if (cloudUpdated) {
            // 拉不到 trade/portfolio 異動（可能只是 metadata 更新）也要推進
            // cursor — 否則每次 metadata 心跳都重複掃同一段 delta。
            saveSyncTime(cloudUpdated);
            setSyncStatus('synced');
          }
        } else {
          setSyncStatus('synced');
          if (cloudUpdated) setLastBackupTime(cloudUpdated);
        }
      }).catch((e) => {
        console.error('[Sync] Auto-pull failed:', e);
        setSyncStatus('error');
        setSyncError(friendlyMessage(e));
      });
    }, (err) => {
      console.error('[Sync] onSnapshot error:', err);
      setSyncStatus('error');
      setSyncError(friendlyMessage(err));
    });

    return () => unsubscribe();
    // onPull 走 onPullRef；其餘 callback 依賴皆為穩定 identity（deps 只含 db/[]）。
    // 把它們列進 deps 曾造成每次 render 都 unsubscribe/resubscribe 的監聽風暴。
  }, [user, authStatus, db, runMigrationIfNeeded, getLastSyncDate, doPull, saveSyncTime, runExclusive]);

  return {
    isSyncing,
    syncStatus,
    syncError,
    lastBackupTime,
    isSyncModalOpen,
    setIsSyncModalOpen,
    triggerCloudBackup,
    manualPull,
    setSyncStatus,
    /** smart-merge 等長流程用：與 push/pull 共用同一把 sync mutex */
    runExclusive,
    conflictStats,
  };
};
