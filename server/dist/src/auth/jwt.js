import jwt from "jsonwebtoken";
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "your-refresh-secret-key";
const ACCESS_TOKEN_EXPIRY = "15m"; // 15 minutes
const REFRESH_TOKEN_EXPIRY = "7d"; // 7 days
export function generateAccessToken(userId, email) {
    return jwt.sign({ userId, email, type: "access" }, JWT_SECRET, {
        expiresIn: ACCESS_TOKEN_EXPIRY,
    });
}
export function generateRefreshToken(userId, email) {
    return jwt.sign({ userId, email, type: "refresh" }, JWT_REFRESH_SECRET, {
        expiresIn: REFRESH_TOKEN_EXPIRY,
    });
}
export function verifyAccessToken(token) {
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.type !== "access") {
            throw new Error("Invalid token type");
        }
        return decoded;
    }
    catch (err) {
        return null;
    }
}
export function verifyRefreshToken(token) {
    try {
        const decoded = jwt.verify(token, JWT_REFRESH_SECRET);
        if (decoded.type !== "refresh") {
            throw new Error("Invalid token type");
        }
        return decoded;
    }
    catch (err) {
        return null;
    }
}
