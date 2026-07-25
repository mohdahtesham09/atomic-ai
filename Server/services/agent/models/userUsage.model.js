import mongoose from "mongoose";

const userUsageSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true, unique: true },
    tokensUsed: { type: Number, default: 0 },
    limit: { type: Number, default: 2500 },
    cooldownUntil: { type: Date, default: null },
    windowStartedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const UserUsage = mongoose.model("UserUsage", userUsageSchema);
export default UserUsage;
