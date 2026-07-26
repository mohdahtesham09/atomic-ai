import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import ConnectDb from './Config/db.js';
import globalErrorHandler from './middleware/error.middleware.js';
import router from './routes/auth.routes.js';
dotenv.config();

process.on("unhandledRejection", (reason) => {
  console.error("[AuthService] Unhandled Rejection:", reason?.message || reason);
});

process.on("uncaughtException", (error) => {
  console.error("[AuthService] Uncaught Exception:", error?.message || error);
});

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use("/", router);

const PORT = process.env.PORT || 8001;

app.get('/health', (req, res) => {
  return res.json({ status: 'ok', service: 'auth' });
});

app.get('/', (req, res) => {
  return res.send('Auth Service is running on port 8001');
});

app.use(globalErrorHandler);

app.listen(PORT, () => {
  console.log(`Auth Service is running on port ${PORT}`);
  ConnectDb();
});