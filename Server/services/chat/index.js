import express from 'express';
import dotenv from 'dotenv';
dotenv.config();

function sanitizeLog(data) {
  if (!data) return data;
  let str = typeof data === "object" ? JSON.stringify(data) : String(data);
  return str
    .replace(/gsk_[a-zA-Z0-9_-]+/g, "[REDACTED_GROQ_KEY]")
    .replace(/AIzaSy[a-zA-Z0-9_-]+/g, "[REDACTED_GOOGLE_KEY]")
    .replace(/key=[a-zA-Z0-9._-]+/g, "key=[REDACTED_KEY]");
}

process.on("unhandledRejection", (reason, promise) => {
  console.error("[ChatService] Unhandled Rejection detected:", sanitizeLog(reason?.stack || reason?.message || reason));
});

process.on("uncaughtException", (error) => {
  console.error("[ChatService] Uncaught Exception detected:", sanitizeLog(error?.stack || error?.message || error));
});

console.log("Chat service env check:", {
  GROQ_API_KEY: Boolean(process.env.GROQ_API_KEY),
  MONGODB_URI: Boolean(process.env.MONGODB_URI),
  AGENT_SERVICE: process.env.AGENT_SERVICE,
});

import ConnectDb from './Config/db.js';
import globalErrorHandler from './middleware/error.middleware.js';
import router from './routes/chat.routes.js';

const app = express();
app.disable("etag");

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ limit: "2mb", extended: true }));

app.use((req, res, next) => {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, private",
    "Pragma": "no-cache",
    "Expires": "0",
  });
  next();
});

const PORT = process.env.PORT || 8002;

app.use("/", router);

app.get('/health', (req, res) => {
  return res.json({ status: 'ok', service: 'chat' });
});

app.get('/', (req, res) => {
  return res.send('chat server is started');
});

// Global error handler must be registered AFTER routes
app.use(globalErrorHandler);

app.listen(PORT, () => {
  console.log(`chat Service is running on port ${PORT}`);
  ConnectDb();
});