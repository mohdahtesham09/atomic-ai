import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    firebaseUid: {
        type: String,
        sparse: true,
        index: true
    },
    name: String,
    email: {
        type: String,
        lowercase: true,
        trim: true,
        index: true
    },
    avatar: String,
    provider: String
}, {
    timestamps: true
});

const User = mongoose.model("User", userSchema);
export default User;