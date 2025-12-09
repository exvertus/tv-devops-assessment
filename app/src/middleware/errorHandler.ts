import { Request, Response, NextFunction } from "express";

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  let message: string;

  if (err instanceof Error) {
    message = err.message;
  } else if (typeof err === "string") {
    message = err;
  } else {
    message = "Unhandled error";
  }

  if (err instanceof Error) {
    console.error("Unhandled error:", {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method
    });
  } else {
    console.error("Unhandled error:", err);
  }

  return res.status(500).json({
    error: message
  });
}