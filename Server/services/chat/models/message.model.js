import mongoose from 'mongoose'

// Artifact schema matches the shape returned by the coding agent:
// { type, title, language, content }
const artifactSchema = new mongoose.Schema({
    type:     { type: String, default: "code" },
    title:    { type: String },
    language: { type: String },
    content:  { type: String },
},{ _id: false })

const messageSchema = new mongoose.Schema({
    conversationId: {
       type: mongoose.Schema.Types.ObjectId,
        ref: "conversation"
    },
    userId: {
        type: String,
        required: false
    },
    role:{
        type: String,
        enum: ["user", "assistant", "system"],
        required: true
    },
    content: {
        type: String,
        required: true,
    },
    images: [String],
    artifacts: {
        type: Array,
        default: []
    }
}, {
    timestamps: true
})

const Message = mongoose.model("Message", messageSchema)
export default Message