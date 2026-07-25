import mongoose from "mongoose";

const userMemorySchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
    },
    memories: [
      {
        key: { type: String, required: true },
        value: { type: String, required: true },
        category: { type: String, default: "general" },
        updatedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

export const UserMemory = mongoose.model("UserMemory", userMemorySchema);
