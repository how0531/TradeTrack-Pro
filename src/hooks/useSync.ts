/**
 * useSync.ts
 *
 * 增量同步 Hook (Incremental Sync Architecture v2)
 *
 * 核心設計：
 *  - 推送 (Push): 只推送 updatedAt >= lastSyncTime 的交易
 *  - 拉取 (Pull): 只拉取 updatedAt > lastSyncTime 的異動記錄
 *  - 刪除 (Delete): 透過 softDeleteTrade() 標記 isDeleted: true 而非真正刪除
 *  - 感知 (Listen): onSnapshot 監聽輕量的 metadata document，有更新才觸發增量 pull
 *  - 遷移 (Migrate): 首次登入自動將舊版 blob 格式搬遷至 sub-collection
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, onSnapshot, Timestamp, Firestore } from 'firebase/firestore';
import { useLocalStorage } from './useLocalStorage';
import { SyncStatus, User, Trade, Portfolio } from '../types';
import { friendlyMessage } from '../utils/errors';
import {
  pushTrades,
  pullTrades,
  pushMetadata,
  pullMetadata,
  migrateFromLegacy,
} from '../services/firestoreService';

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
  /** 當從雲端拉取到異動時的回呼，含需套用的 trade patches 與 metadata */
  onPull: (patches: {
    trades?: Trade[];
    strategies?: string[];
    emotions?: string[];
    portfolios?: Portfolio[];
    settings?: { lossColor: string };
    lastUpdated?: any;
  }) => void;
}

// ─────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────

export const useSync = ({ user, authStatus, db, data, onPull }: UseSyncProps) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('offline');
  const [lastBackupTime, setLastBackupTime] = useState<Date | null>(null);
  const [lastSyncTimeStr, setLastSyncTimeStr] = useLocalStorage<string>('app_last_sync_time', '');
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [conflictStats] = useState<{
    localCount: number; cloudCount: number; duplicateCount: number;
  } | null>(null);

  // Refs to prevent stale closures
  const dataRef = useRef(data);
  const syncStatusRef = useRef(syncStatus);
  const lastSyncTimeStrRef = useRef(lastSyncTimeStr);
  const lastPullTimeRef = useRef<number>(0);
  const migrationDoneRef = useRef(false);

  // Serialisation: only one push may be in flight at a time. Concurrent
  // callers set rescheduleAfterSyncRef so the in-flight push fires a
  // follow-up once it lands, capturing any mutations that arrived during it.
  // (Previously `isSyncing` was a pure React state flag that got cleared in
  // the finally block, allowing a second push to start before React had
  // re-rendered, leading to two near-simultaneous Firestore writes.)
  const inFlightPushRef = useRef(false);
  const rescheduleAfterSyncRef = useRef(false);

  useEffect(() => { dataRef.current = data; }, [data]);
  useEffect(() => { syncStatusRef.current = syncStatus; }, [syncStatus]);
  useEffect(() => { lastSyncTimeStrRef.current = lastSyncTimeStr; }, [lastSyncTimeStr]);

  // ─── Helper: parse stored sync time → Date ───
  const getLastSyncDate = useCallback((): Date | null => {
    const str = lastSyncTimeStrRef.current;
    if (!str) return null;
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }, []);

  // ─── Helper: save new sync time ───
  const saveSyncTime = useCallback((date: Date) => {
    const iso = date.toISOString();
    setLastSyncTimeStr(iso);
    lastSyncTimeStrRef.current = iso;
    setLastBackupTime(date);
  }, [setLastSyncTimeStr]);

  // ─── Migration: 首次使用自動搬遷舊版 blob 格式 ───
  const runMigrationIfNeeded = useCallback(async (uid: string) => {
    if (migrationDoneRef.current) return;
    migrationDoneRef.current = true;

    try {
      const result = await migrateFromLegacy(db, uid);
      if (result.migrated && result.tradeCount > 0) {
        console.log(`✅ [Sync] Legacy migration completed: ${result.tradeCount} trades moved.`);
        // 遷移後，把舊資料同步到本地
        const patches = await doPull(uid, null);
        if (patches) onPull(patches);
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
  const triggerCloudBackup = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!user || authStatus !== 'online') {
      setSyncStatus('offline');
      return { success: false, error: 'User is offline' };
    }

    // Serialisation: if a push is already in flight, just mark that another
    // round needs to run once it finishes. The in-flight push will read
    // dataRef.current at start time and may miss mutations that arrived
    // after that snapshot, hence the follow-up.
    if (inFlightPushRef.current) {
      rescheduleAfterSyncRef.current = true;
      return { success: true };
    }

    inFlightPushRef.current = true;
    setSyncStatus('saving');
    setIsSyncing(true);
    try {
      const now = new Date();
      const since = getLastSyncDate();
      const currentData = dataRef.current;

      // 只推送 updatedAt >= lastSyncTime 或從未同步 (since === null) 的 trades
      const tradesToPush = since
        ? currentData.trades.filter((t) => {
            if (!t.updatedAt) return true; // 沒有 updatedAt 的舊資料全部推送
            return new Date(t.updatedAt) >= since;
          })
        : currentData.trades;

      await pushTrades(db, user.uid, tradesToPush.map(t => ({
        ...t,
        updatedAt: t.updatedAt || now.toISOString(),
        isDeleted: t.isDeleted ?? false,
      })));

      // 推送 metadata (portfolios, settings 每次都推送，資料量小)
      await pushMetadata(db, user.uid, {
        portfolios: currentData.portfolios,
        strategies: currentData.strategies,
        emotions: currentData.emotions,
        settings: { lossColor: currentData.lossColor },
      });

      saveSyncTime(now);
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
      inFlightPushRef.current = false;

      if (rescheduleAfterSyncRef.current) {
        rescheduleAfterSyncRef.current = false;
        // Tiny delay so React state from the previous push settles before
        // the follow-up reads dataRef.current.
        setTimeout(() => { triggerCloudBackup(); }, 50);
      }
    }
  }, [user, authStatus, db, getLastSyncDate, saveSyncTime]);

  // ─── Manual Pull (使用者手動點「從雲端還原」) ───
  const manualPull = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!user || authStatus !== 'online') return { success: false, error: 'User is offline' };
    setSyncStatus('saving');
    try {
      // 手動拉取一律做全量 (since: null) 確保資料完整
      const patches = await doPull(user.uid, null);
      if (patches) onPull(patches);

      const pullTime = new Date();
      saveSyncTime(pullTime);
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
  }, [user, authStatus, doPull, onPull, saveSyncTime]);

  // ─── Listener: metadata 異動 → 觸發增量拉取 ───
  useEffect(() => {
    if (!user || authStatus !== 'online') return;

    // 登入後先做遷移確認
    runMigrationIfNeeded(user.uid);

    // 監聽輕量的 metadata document (不再監聽含所有 trades 的大 blob)
    const metaRef = doc(db, 'users', user.uid, 'metadata', 'main');
    const unsubscribe = onSnapshot(metaRef, async (snap) => {
      if (!snap.exists()) return;
      if (snap.metadata.hasPendingWrites) return;

      const now = Date.now();
      // 60 秒內剛推送過，不重複拉
      if (now - lastPullTimeRef.current < 5000) return;
      if (syncStatusRef.current === 'saving') return;

      const cloudMeta = snap.data();
      const cloudUpdated: Date | null = (() => {
        const v = cloudMeta?.lastUpdated;
        if (!v) return null;
        if (typeof v.toDate === 'function') return v.toDate();
        if (v instanceof Date) return v;
        if (typeof v.seconds === 'number') return new Timestamp(v.seconds, v.nanoseconds || 0).toDate();
        return null;
      })();

      const since = getLastSyncDate();
      const localTime = since?.getTime() ?? 0;
      const cloudTime = cloudUpdated?.getTime() ?? 0;

      // 雲端比本地新 (>10 秒緩衝) → 增量拉取
      if (cloudTime > localTime + 10000) {
        console.log(`[Sync] Detected remote update (cloud: ${cloudUpdated?.toISOString()}), pulling delta since ${since?.toISOString()}...`);
        try {
          const patches = await doPull(user.uid, since);
          if (patches && (patches.trades?.length || patches.portfolios?.length)) {
            onPull(patches);
            if (cloudUpdated) saveSyncTime(cloudUpdated);
            lastPullTimeRef.current = Date.now();
            setSyncStatus('synced');
          }
        } catch (e) {
          console.error('[Sync] Auto-pull failed:', e);
          setSyncStatus('error');
          setSyncError(friendlyMessage(e));
        }
      } else {
        setSyncStatus('synced');
        if (cloudUpdated) setLastBackupTime(cloudUpdated);
      }
    }, (err) => {
      console.error('[Sync] onSnapshot error:', err);
      setSyncStatus('error');
      setSyncError(friendlyMessage(err));
    });

    return () => unsubscribe();
  }, [user, authStatus, db, runMigrationIfNeeded, getLastSyncDate, doPull, onPull, saveSyncTime]);

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
    setLastSyncTimeStr,
    conflictStats,
  };
};
