// middleware/auth.middleware.ts
import type { NextFunction, Request, Response } from "express";

export function requireApiKey(req: Request, res: Response, next: NextFunction) {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.API_SECRET_KEY) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    next();
}