import dotenv from "dotenv";
dotenv.config();
function required(name) {
    const value = process.env[name];
    if (!value)
        throw new Error(`Missing required env var: ${name}`);
    return value;
}
function optional(name) {
    const value = process.env[name];
    if (!value)
        return undefined;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
}
export const config = {
    port: parseInt(process.env.PORT || "4242", 10),
    clientUrl: required("CLIENT_URL"),
    jwtSecret: required("JWT_SECRET"),
    jwtRefreshSecret: required("JWT_REFRESH_SECRET"),
    stripeSecretKey: required("STRIPE_SECRET_KEY"),
    stripeWebhookSecret: required("STRIPE_WEBHOOK_SECRET"),
    sessionSecret: optional("SESSION_SECRET"),
    ...(optional("R2_BUCKET")
        ? {
            r2: {
                accountId: required("R2_ACCOUNT_ID"),
                accessKeyId: required("R2_ACCESS_KEY_ID"),
                secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
                bucket: required("R2_BUCKET"),
                publicBaseUrl: optional("R2_PUBLIC_BASE_URL"),
                endpoint: optional("R2_ENDPOINT"),
            },
        }
        : {}),
};
