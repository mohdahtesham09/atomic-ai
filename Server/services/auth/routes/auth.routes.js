import express from 'express'
import { deductCredits, login, logout } from '../controllers/auth.controller.js'

const router = express.Router()


router.post("/login", login)
router.post("/logout", logout)
router.post("/deduct-credits", deductCredits)

export default router