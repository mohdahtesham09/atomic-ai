import express from 'express';
import dotenv from 'dotenv';
dotenv.config();

import { sanitizeLog } from './utils/sanitizer.js';

process.on("unhandledRejection", (reason, promise) => {
  console.error("[AgentService] Unhandled Rejection detected:", sanitizeLog(reason?.stack || reason?.message || reason));
});

process.on("uncaughtException", (error) => {
  console.error("[AgentService] Uncaught Exception detected:", sanitizeLog(error?.stack || error?.message || error));
});

console.log("Agent service env check:", {
  GROQ_API_KEY: Boolean(process.env.GROQ_API_KEY),
  GOOGLE_API_KEY: Boolean(process.env.GOOGLE_API_KEY),
  OPENROUTER_API_KEY: Boolean(process.env.OPENROUTER_API_KEY),
  CHAT_SERVICE: process.env.CHAT_SERVICE,
});

import ConnectDb from './Config/db.js';
import globalErrorHandler from './middleware/error.middleware.js';
import router from './routes/agent.route.js';

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ limit: "2mb", extended: true }));

const PORT = process.env.PORT || 8003;

app.use("/", router);

app.get('/health', (req, res) => {
  return res.json({ status: 'ok', service: 'agent' });
});

app.get('/', (req, res) => {
  return res.send('agent server is started');
});

// Global error handler must be registered AFTER routes
app.use(globalErrorHandler);

app.listen(PORT, () => {
  console.log(`agent Service is running on port ${PORT}`);
  ConnectDb();
});