// ============================================
// 📁 tests/helpers/express-mock.ts
// Requête / réponse Express minimales pour tester les contrôleurs
// ============================================

import { mock } from "bun:test";
import type { Request, Response } from "express";

export interface MockResponse extends Response {
    /** Dernier code passé à `res.status()` (200 par défaut). */
    statusCode: number;
    /** Dernier corps passé à `res.json()`. */
    body: any;
}

/**
 * Réponse Express factice : `status()` et `json()` sont chaînables et
 * enregistrent ce que le contrôleur a produit.
 */
export function createMockResponse(): MockResponse {
    const res: any = { statusCode: 200, body: undefined };

    res.status = mock((code: number) => {
        res.statusCode = code;
        return res;
    });
    res.json = mock((payload: unknown) => {
        res.body = payload;
        return res;
    });

    return res as MockResponse;
}

/** Requête Express factice, limitée à ce que lisent les contrôleurs. */
export function createMockRequest(init: {
    query?: Record<string, unknown>;
    body?: unknown;
    params?: Record<string, string>;
    headers?: Record<string, string>;
} = {}): Request {
    return {
        query: init.query ?? {},
        body: init.body ?? {},
        params: init.params ?? {},
        headers: init.headers ?? {},
    } as unknown as Request;
}
