import asyncHandler from '../utils/asyncHandler.js'
import apiErros from '../utils/apiError.js'
import User from '../model/user.model.js'
import {getAuth} from 'firebase-admin/auth'
import {app} from '../Config/firebase.js'
import apiError from '../utils/apiError.js'

export const login = asyncHandler(async (req, res, ) => {
    const {token} = req.body
    if (!token) {
        throw new apiError(400, "Firebase token is required")
    }

    const decoded = await getAuth(app).verifyIdToken(token)
    const user = await User.findOne({
        firebaseUid:decoded.uid
    })

    if(!user){
        const user = await User.create({
            firebaseUid:decoded.uid,
            name:decoded.name,
            email:decoded.email,
            avatar:decoded.picture
        })
    }

    const sessionId = crypto.randomUUID()

    res.cookie("session", sessionId, {
        httpOnly: true,
        secure:false,
        sameSite:"strict",
        maxAge: 7*24*60*60*1000
    })

    return res.status(200).json({
        sucess: true,
        message: "login successful",
        data: user
    })



})