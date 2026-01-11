import type { Request, Response, NextFunction } from "express";

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const userId = req.session?.userId;
  const email = req.session?.email;

  if (!userId || !email) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  req.user = { userId, email };

  next();
}
