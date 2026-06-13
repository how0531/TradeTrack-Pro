/**
 * Tests for src/services/responseValidators.ts.
 *
 * These type guards live at every broker-API boundary in brokerService.ts.
 * If they silently accept malformed shapes the user gets NaN P&L or
 * frozen progress bars. If they reject valid shapes the entire sync
 * page errors out. So lock both directions: positive case for each
 * shape, plus a representative set of negative cases that we know have
 * appeared in production (missing job_id, status as wrong literal,
 * details as object instead of array).
 */
import { describe, expect, it } from 'vitest';
import {
    isPnlSuccessResponse,
    isJobCreateResponse,
    isJobStatusResponse,
    isBrokerProfileSuccess,
    isBrokerProfileMultiAccount,
    isBackendError,
    assertShape,
} from './responseValidators';

describe('isPnlSuccessResponse', () => {
    it('accepts a complete success payload', () => {
        const payload = {
            status: 'success',
            total_pnl: 12345,
            daily_results: [{ date: '2026-04-15', pnl: 100 }],
            details: [],
            account_summaries: [],
        };
        expect(isPnlSuccessResponse(payload)).toBe(true);
    });

    it('rejects non-success status', () => {
        expect(isPnlSuccessResponse({ status: 'error', message: 'CA expired' })).toBe(false);
    });

    it('rejects missing total_pnl', () => {
        expect(isPnlSuccessResponse({ status: 'success', daily_results: [], details: [] })).toBe(false);
    });

    it('rejects total_pnl as string (real bug we caught)', () => {
        expect(isPnlSuccessResponse({ status: 'success', total_pnl: '0', daily_results: [], details: [] })).toBe(false);
    });

    it('rejects details as object instead of array', () => {
        expect(isPnlSuccessResponse({ status: 'success', total_pnl: 0, daily_results: [], details: {} })).toBe(false);
    });

    it('rejects null and primitive payloads', () => {
        expect(isPnlSuccessResponse(null)).toBe(false);
        expect(isPnlSuccessResponse(undefined)).toBe(false);
        expect(isPnlSuccessResponse('success')).toBe(false);
        expect(isPnlSuccessResponse([])).toBe(false);
    });
});

describe('isJobCreateResponse', () => {
    it('accepts a non-empty job_id', () => {
        expect(isJobCreateResponse({ status: 'success', job_id: 'abc-123' })).toBe(true);
    });

    it('rejects empty job_id (would otherwise be a confusing crash later)', () => {
        expect(isJobCreateResponse({ status: 'success', job_id: '' })).toBe(false);
    });

    it('rejects missing job_id', () => {
        expect(isJobCreateResponse({ status: 'success' })).toBe(false);
    });

    it('rejects non-success status', () => {
        expect(isJobCreateResponse({ status: 'error', job_id: 'abc' })).toBe(false);
    });
});

describe('isJobStatusResponse', () => {
    it('accepts a typical pending poll', () => {
        const payload = {
            status: 'success',
            job: {
                id: 'abc',
                status: 'running',
                progress: 45,
                progress_msg: 'Fetching account 1/3',
                error: null,
                timestamp: 1700000000,
            },
        };
        expect(isJobStatusResponse(payload)).toBe(true);
    });

    it('rejects missing job', () => {
        expect(isJobStatusResponse({ status: 'success' })).toBe(false);
    });

    it('rejects job.progress as string (root cause of the v3.3.3 polling regression)', () => {
        expect(isJobStatusResponse({
            status: 'success',
            job: { id: 'abc', status: 'running', progress: '45' },
        })).toBe(false);
    });

    it('rejects job.id as missing', () => {
        expect(isJobStatusResponse({
            status: 'success',
            job: { status: 'running', progress: 0 },
        })).toBe(false);
    });
});

describe('isBrokerProfileSuccess', () => {
    it('accepts a normal profile', () => {
        expect(isBrokerProfileSuccess({
            status: 'success',
            username: 'test',
            branchCode: '9A95',
            environment: 'production',
        })).toBe(true);
    });

    it('rejects missing username', () => {
        expect(isBrokerProfileSuccess({
            status: 'success',
            branchCode: '9A95',
            environment: 'production',
        })).toBe(false);
    });

    it('rejects multi-account variant (must use isBrokerProfileMultiAccount)', () => {
        expect(isBrokerProfileSuccess({
            status: 'multiple_accounts',
            accounts: [],
        })).toBe(false);
    });
});

describe('isBrokerProfileMultiAccount', () => {
    it('accepts an empty accounts array', () => {
        // empty is unusual but structurally valid — distinguishing between
        // "no accounts yet" and "wrong shape" is the validator's job, not
        // the predicate's.
        expect(isBrokerProfileMultiAccount({
            status: 'multiple_accounts',
            accounts: [],
        })).toBe(true);
    });

    it('rejects accounts as object', () => {
        expect(isBrokerProfileMultiAccount({
            status: 'multiple_accounts',
            accounts: {},
        })).toBe(false);
    });
});

describe('isBackendError', () => {
    it('accepts a generic error payload', () => {
        expect(isBackendError({ status: 'error', message: 'CA expired' })).toBe(true);
    });

    it('accepts error with reason but no message (v3.2.0 shape)', () => {
        expect(isBackendError({ status: 'error', reason: 'job_not_found' })).toBe(true);
    });

    it('rejects non-error status', () => {
        expect(isBackendError({ status: 'success' })).toBe(false);
    });
});

describe('assertShape', () => {
    it('returns the data when the predicate passes', () => {
        const payload = { status: 'success' as const, job_id: 'x' };
        expect(assertShape(payload, isJobCreateResponse, 'job/create')).toBe(payload);
    });

    it('throws with a peek of the data when the predicate fails', () => {
        const bad = { status: 'success', job_id: 42 };  // wrong type
        expect(() => assertShape(bad, isJobCreateResponse, 'job/create')).toThrow(/job\/create/);
    });

    it('truncates very large payloads in the error message', () => {
        const huge = { junk: 'x'.repeat(5000) };
        let caught: Error | null = null;
        try {
            assertShape(huge, isJobCreateResponse, 'job/create');
        } catch (e) {
            caught = e as Error;
        }
        expect(caught).not.toBeNull();
        // first-200-char peek means message is bounded
        expect(caught!.message.length).toBeLessThan(400);
    });
});
