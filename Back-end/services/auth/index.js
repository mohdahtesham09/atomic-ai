import express from 'express';
import dotenv from 'dotenv';
import ConnectDb from './Config/db.js';
import globalErrorHandler from './middleware/error.middleware.js';
import router from './routes/auth.routes.js';
dotenv.config();

const app = express();
app.use(express.json());
app.use("/", router)



const PORT = process.env.PORT || 8001;

app.get('/', (req, res) => {
  res.send('Auth Service is running 8001');
});

app.listen(PORT, () => {
  console.log(`Auth Service is running on port ${PORT}`);
  ConnectDb();
});