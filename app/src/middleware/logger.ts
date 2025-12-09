import { Request, Response, NextFunction } from "express";

export function logger(req: Request, res: Response, next: NextFunction) {
    res.on("finish", () => {
        const start = res.locals.startTime;
        const end = process.hrtime.bigint();
        const ms = Number(end - start) / 1_000_000;
        console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(2)}ms`);
    });
    next();
}