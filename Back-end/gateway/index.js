import express from'express';
import dotenv from 'dotenv';
dotenv.config();
import proxy from 'express-http-proxy'
import cors from 'cors'
import cookieParser from 'cookie-parser'

const app = express();

app.use(cors({
    origin:process.env.FRONTEND_URL,
    credentials: true

}))
app.use(cookieParser())

const PORT = process.env.PORT || 8000;

app.use("/auth", proxy(process.env.AUTH_SERCICE))

app.get('/', (req, res) =>{
    return res.send('Hello from the gateway server!');
})

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
})