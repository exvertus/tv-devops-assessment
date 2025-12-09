import { Request, Response, NextFunction } from "express";

export function requestTimer(req: Request, res: Response, next: NextFunction) {
    const start = process.hrtime.bigint();
    res.locals.startTime = start;
    next();
}