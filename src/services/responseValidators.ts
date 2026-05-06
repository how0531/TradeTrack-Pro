/**
 * responseValidators.ts
 *
 * 後端回應的 runtime shape validators（不引入 zod，避免 +200KB bundle）。
 *
 * 用法：
 *   const result = await backendFetch<unknown>('/api/broker/pnl', ...);
 *   if (!isPnlSuccessResponse(result.data)) {
 *       throw new Error('後端回應格式錯誤，可能是版本不相容');
 *   }
 *   // 此後 TS 會把 result.data 視為 PnlSuccessResponse
 *
 * 加 validator 的時機：
 *   - 後端 schema 改了，前端讀到 undefined 卻沒拋錯（silent corruption）
 *   - 想在 console 看到「哪裡的回應形狀錯了」而非神秘的 NaN/undefined
 */

import type { TransactionDetail, AccountSummary } from '../types/broker';

// ────────────────────────────────────────────────────────────────────
// Common shape predicates
// ────────────────────────────────────────────────────────────────────

const isObject = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v);

const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && !Number.isNaN(v);
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';

// ────────────────────────────────────────────────────────────────────
// /api/broker/profile responses
// ────────────────────────────────────────────────────────────────────

export interface BrokerProfileSuccessResponse {
    status: 'success';
    username: string;
    branchCode: string;
    environment: string;
    signedAccounts?: string[];
    apiKeyHint?: string;
    accountId?: string;
}

export interface BrokerProfileMultipleAccountsResponse {
    status: 'multiple_accounts';
    accounts: Array<{
        branch_code: string;
        branch_name: string;
        account_id: string;
        account_type?: string;
        username?: string;
        signed?: boolean;
    }>;
}

export interface BackendErrorResponse {
    status: 'error';
    message?: string;
    error?: string;
    [key: string]: unknown;  // ca_error, reason 等
}

export const isBrokerProfileSuccess = (v: unknown): v is BrokerProfileSuccessResponse =>
    isObject(v) && v.status === 'success' && isStr(v.username) && isStr(v.branchCode);

export const isBrokerProfileMultiAccount = (v: unknown): v is BrokerProfileMultipleAccountsResponse =>
    isObject(v) && v.status === 'multiple_accounts' && Array.isArray(v.accounts);

export const isBackendError = (v: unknown): v is BackendErrorResponse =>
    isObject(v) && v.status === 'error';

// ────────────────────────────────────────────────────────────────────
// /api/broker/pnl response
// ────────────────────────────────────────────────────────────────────

export interface PnlSuccessResponse {
    status: 'success';
    total_pnl: number;
    daily_results: Array<{ date: string; pnl: number }>;
    details: TransactionDetail[];
    username?: string;
    branchCode?: string;
    ca_status?: 'activated' | 'not_activated';
    empty_reason?: string | null;
    account_summaries?: AccountSummary[];
    empty_diagnostic?: string | null;
    date_range_used?: { start: string; end: string };
    summary?: { equity: number; open_pnl: number; realized_pnl: number };
}

export const isPnlSuccessResponse = (v: unknown): v is PnlSuccessResponse => {
    if (!isObject(v) || v.status !== 'success') return false;
    if (!isNum(v.total_pnl)) return false;
    if (!Array.isArray(v.daily_results)) return false;
    if (!Array.isArray(v.details)) return false;
    return true;
};

// ────────────────────────────────────────────────────────────────────
// /api/jobs/pnl 建立 response
// ────────────────────────────────────────────────────────────────────

export interface JobCreateResponse {
    status: 'success';
    job_id: string;
}

export const isJobCreateResponse = (v: unknown): v is JobCreateResponse =>
    isObject(v) && v.status === 'success' && isStr(v.job_id) && v.job_id.length > 0;

// ────────────────────────────────────────────────────────────────────
// /api/jobs/:id/status response
// ────────────────────────────────────────────────────────────────────

export interface JobStatus {
    id: string;
    status: 'pending' | 'running' | 'done' | 'error';
    progress: number;
    progress_msg: string | null;
    error: string | null;
    timestamp: number;
}

export interface JobStatusResponse {
    status: 'success';
    job: JobStatus;
}

export const isJobStatusResponse = (v: unknown): v is JobStatusResponse => {
    if (!isObject(v) || v.status !== 'success') return false;
    const job = v.job;
    if (!isObject(job)) return false;
    if (!isStr(job.id)) return false;
    if (!isStr(job.status)) return false;
    if (!isNum(job.progress)) return false;
    return true;
};

// ────────────────────────────────────────────────────────────────────
// Helper: 包一層 throw with helpful debug info
// ────────────────────────────────────────────────────────────────────

/**
 * 若 data 不符合預期 shape，throw 含「拿到了什麼」的錯誤。
 * 比 silent undefined / NaN 容易 debug。
 */
export const assertShape = <T>(
    data: unknown,
    predicate: (v: unknown) => v is T,
    label: string
): T => {
    if (!predicate(data)) {
        // 截斷以避免 dump 巨大 response
        const peek = JSON.stringify(data).slice(0, 200);
        throw new Error(`後端 ${label} 回應格式不符預期: ${peek}`);
    }
    return data;
};
