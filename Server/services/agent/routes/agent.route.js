import express from "express"
import { agent, generateResponse } from "../controllers/agent.controller.js"
import multer from "../Config/multer.js"
import { providerRateLimiter } from "../middleware/rateLimiter.middleware.js"

const router = express.Router()

router.post("/chat", multer.single("file"), agent)
router.post("/generate", providerRateLimiter, generateResponse)

export default router