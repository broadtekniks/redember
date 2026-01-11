export function requireAuth(req, res, next) {
    const userId = req.session?.userId;
    const email = req.session?.email;
    if (!userId || !email) {
        res.status(401).json({ error: "Authentication required" });
        return;
    }
    req.user = { userId, email };
    next();
}
