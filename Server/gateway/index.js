import express from 'express';
import dotenv from 'dotenv';
dotenv.config();
import proxy from 'express-http-proxy';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { getCurrentUser } from './controller/user.controller.js';
import protect from './middleware/auth.middleware.js';
import { proxyWithHeader } from './utils/proxyWIthHeader.js';
import redis from '../shared/redis/redis.js';
import { checkRateLimit, getUserOrIpKey } from '../shared/redis/rateLimiter.js';

process.on("unhandledRejection", (reason) => {
  console.error("[Gateway] Unhandled Rejection:", reason?.message || reason);
});

process.on("uncaughtException", (error) => {
  console.error("[Gateway] Uncaught Exception:", error?.message || error);
});

const app = express();
app.disable("etag");

app.use(cors({
    origin: (origin, callback) => callback(null, true),
    credentials: true
}));
app.use(cookieParser());

// Disable caching for all API endpoints to prevent 304 responses on dynamic user data
app.use((req, res, next) => {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, private",
    "Pragma": "no-cache",
    "Expires": "0",
  });
  next();
});

// Gateway Global Rate Limiting Middleware
const gatewayGlobalLimiter = async (req, res, next) => {
  if (req.path === "/health" || req.path === "/") {
    return next();
  }

  const max = parseInt(process.env.RATE_LIMIT_GLOBAL_MAX || "100", 10);
  const windowSeconds = parseInt(process.env.RATE_LIMIT_GLOBAL_WINDOW_SECONDS || "60", 10);
  const keyId = getUserOrIpKey(req);

  const result = await checkRateLimit({
    redis,
    scope: "gateway",
    keyId,
    max,
    windowSeconds,
  });

  res.setHeader("X-RateLimit-Limit", result.limit);
  res.setHeader("X-RateLimit-Remaining", result.remaining);
  res.setHeader("X-RateLimit-Reset", result.resetSeconds);

  if (!result.allowed) {
    res.setHeader("Retry-After", result.resetSeconds);
    return res.status(429).json({
      success: false,
      code: "RATE_LIMITED",
      message: "Too many requests. Please try again shortly.",
      retryAfter: result.resetSeconds,
      limit: result.limit,
      remaining: 0,
    });
  }

  next();
};

app.use(gatewayGlobalLimiter);

const PORT = process.env.PORT || 8000;

app.get('/health', (req, res) => {
    return res.json({ status: 'ok', service: 'gateway' });
});

app.use("/api/v1/chat", (req, res, next) => {
  if (req.path.includes("message") || req.url.includes("message")) {
    console.log("[PDF Gateway]", {
      contentType: req.headers["content-type"],
      contentLength: req.headers["content-length"],
      bodyKeys: Object.keys(req.body || {}),
      hasFile: Boolean(req.file),
      fileName: req.file?.originalname,
      fileSize: req.file?.size,
    });
  }
  next();
});

app.use("/api/v1/auth", proxy(process.env.AUTH_SERVICE || "http://localhost:8001"));
app.use("/api/v1/chat", protect, proxyWithHeader(process.env.CHAT_SERVICE || "http://localhost:8002"));
app.use("/api/v1/agent", protect, proxyWithHeader(process.env.AGENT_SERVICE || "http://localhost:8003"));
app.get("/api/v1/me", protect, getCurrentUser);

app.get('/', (req, res) => {
    return res.send('Hello from the gateway server!');
});

app.use((err, req, res, next) => {
    console.error("[Gateway Error]:", err.message);
    if (res.headersSent) return next(err);
    return res.status(err.status || 500).json({
        success: false,
        message: err.message || "Gateway Internal Error"
    });
});

app.listen(PORT, () => {
    console.log(`Gateway Server is running on port ${PORT}`);
    console.log("CHAT_SERVICE:", process.env.CHAT_SERVICE || "http://localhost:8002");
    console.log("AUTH_SERVICE:", process.env.AUTH_SERVICE || "http://localhost:8001");
    console.log("FRONTEND_URL:", process.env.FRONTEND_URL || "http://localhost:5173");
});