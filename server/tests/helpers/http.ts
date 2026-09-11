// ============================================
// 📁 tests/helpers/http.ts
// Requête et réponse Express réduites à ce que les contrôleurs utilisent
// ============================================

import { mock } from "bun:test";
import type { Request, Response } from "express";

export interface FakeResponse {
    res: Response;
    status: ReturnType<typeof mock<(code: number) => Response>>;
    json: ReturnType<typeof mock<(body: unknown) => void>>;
    /** Code HTTP posé, ou 200 quand le contrôleur n'en pose aucun. */
    code(): number;
    /** Dernier corps rendu. */
    body(): unknown;
}

export function fakeResponse(): FakeResponse {
    const json = mock((_body: unknown): void => undefined);
    const status = mock((_code: number): Response => res);

    const res = { status, json } as unknown as Response;

    return {
        res,
        status,
        json,
        code: () => status.mock.calls[0]?.[0] ?? 200,
        body: () => json.mock.calls[0]?.[0],
    };
}

export function fakeRequest(parts: Partial<Request> = {}): Request {
    return { query: {}, params: {}, body: {}, ...parts } as Request;
}
