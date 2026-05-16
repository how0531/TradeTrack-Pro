/**
 * Tests for friendlyMessage() — the central error-to-human mapper added in
 * the UX batch (#3). It is the single source of truth for what users see
 * when a broker sync / cloud sync / import fails, so its mappings need to
 * stay pinned: a regression here silently degrades every error surface.
 */

import { describe, it, expect } from 'vitest';
import {
    friendlyMessage,
    BrokerConnectionError,
    BrokerAuthError,
    BrokerAPIError,
    ValidationError,
} from './errors';

describe('friendlyMessage — typed errors delegate to detailed handler', () => {
    it('maps BrokerConnectionError codes', () => {
        expect(friendlyMessage(new BrokerConnectionError('x', 'TIMEOUT'), 'zh'))
            .toContain('請求超時');
        expect(friendlyMessage(new BrokerConnectionError('x', 'BACKEND_OFFLINE'), 'en'))
            .toMatch(/offline/i);
    });

    it('maps BrokerAuthError codes', () => {
        expect(friendlyMessage(new BrokerAuthError('x', 'CA_ERROR'), 'zh'))
            .toContain('憑證');
    });

    it('keeps BrokerAPIError status code visible', () => {
        expect(friendlyMessage(new BrokerAPIError('boom', 503), 'en'))
            .toContain('503');
    });

    it('formats ValidationError with field', () => {
        expect(friendlyMessage(new ValidationError('too long', 'note'), 'zh'))
            .toContain('note');
    });
});

describe('friendlyMessage — raw string / Error heuristics', () => {
    const cases: Array<[string, RegExp, RegExp]> = [
        // input, zh expectation, en expectation
        ['Failed to fetch', /網路/, /network/i],
        ['AbortError: aborted', /取消/, /cancel/i],
        ['Backend suspected hibernation', /喚醒/, /waking/i],
        ['Request failed 503', /50[234]/, /50[234]/],
        ['HTTP 401 Unauthorized', /驗證/, /[Aa]uthentication/],
        ['403 Forbidden', /權限/, /permission/i],
        ['Job status polling failed', /重試/, /[Rr]etry/],
        ["Argument 'begin_date' has incorrect type", /90 天|範圍/, /90 days|range/i],
        ['permission-denied', /權限/, /permission/i],
    ];

    for (const [input, zhRe, enRe] of cases) {
        it(`maps "${input}" (zh + en)`, () => {
            const zh = friendlyMessage(input, 'zh');
            const en = friendlyMessage(input, 'en');
            expect(zh).toMatch(zhRe);
            expect(en).toMatch(enRe);
            // Never leak the raw engineering string verbatim for known cases.
            expect(zh).not.toBe(input);
        });
    }

    it('accepts an Error instance, not just a string', () => {
        expect(friendlyMessage(new Error('Failed to fetch'), 'zh')).toMatch(/網路/);
    });

    it('falls back to the raw message when nothing matches', () => {
        expect(friendlyMessage('some very specific unmapped detail', 'en'))
            .toBe('some very specific unmapped detail');
    });

    it('supplies a generic message when there is no message at all', () => {
        expect(friendlyMessage(undefined, 'zh')).toMatch(/未知錯誤/);
        expect(friendlyMessage(null, 'en')).toMatch(/unknown error/i);
    });

    it('defaults to Chinese when lang is omitted', () => {
        expect(friendlyMessage('Failed to fetch')).toMatch(/網路/);
    });
});
