import express from 'express'
import mongoose from 'mongoose'

const ConnectDb = async () =>{
    try {
        await mongoose.connect(process.env.MONGODB_URI)
        console.log("DB Connected")
    } catch (error) {
        console.log(`db error ${error}`)
    }
}
export default ConnectDb