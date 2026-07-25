import asyncHandler from "../utils/asyncHandler.js";
import User from "../model/user.model.js";
import { getAuth } from "firebase-admin/auth";
import { app } from "../Config/firebase.js";
import ApiError from "../utils/apiError.js";
import redis from "../../../shared/redis/redis.js";
import crypto from "crypto";

export const login = asyncHandler(async (req, res) => {
  const { token } = req.body;

  if (!token) {
    throw new ApiError(400, "Firebase token is required");
  }

  const decoded = await getAuth(app).verifyIdToken(token);

  const rawEmail = decoded.email ? String(decoded.email).trim() : null;
  const normalizedEmail = rawEmail ? rawEmail.toLowerCase() : null;

  const queryConditions = [{ firebaseUid: decoded.uid }];
  if (normalizedEmail) {
    queryConditions.push({ email: normalizedEmail });
    if (rawEmail && rawEmail !== normalizedEmail) {
      queryConditions.push({ email: rawEmail });
    }
  }

  let user = await User.findOne({ $or: queryConditions }).sort({
    createdAt: 1,
  });

  if (user) {
    let modified = false;
    if (!user.firebaseUid || user.firebaseUid !== decoded.uid) {
      user.firebaseUid = decoded.uid;
      modified = true;
    }
    if (normalizedEmail && user.email !== normalizedEmail) {
      user.email = normalizedEmail;
      modified = true;
    }
    if (decoded.picture && user.avatar !== decoded.picture) {
      user.avatar = decoded.picture;
      modified = true;
    }
    if (decoded.name && (!user.name || user.name === "User")) {
      user.name = decoded.name;
      modified = true;
    }
    if (modified) {
      await user.save();
    }
  } else {
    try {
      user = await User.create({
        firebaseUid: decoded.uid,
        name: decoded.name || normalizedEmail?.split("@")[0] || "User",
        email: normalizedEmail,
        avatar: decoded.picture || "",
        provider: decoded.firebase?.sign_in_provider || "google",
      });
    } catch (createErr) {
      if (createErr.code === 11000) {
        user = await User.findOne({ $or: queryConditions });
      } else {
        throw createErr;
      }
    }
  }

  const userIdStr = user._id.toString();

  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[Auth] Resolved user: ${userIdStr} (firebaseUid: ${user.firebaseUid}, email: ${user.email})`,
    );
  }

  const sessionId = crypto.randomUUID();

  try {
    await redis.set(
      `session-${sessionId}`,
      JSON.stringify({
        _id: userIdStr,
        userId: userIdStr,
        firebaseUid: user.firebaseUid,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        provider: user.provider,
      }),
      "EX",
      7 * 24 * 60 * 60,
    );
    await redis.set(
      `user-session-${userIdStr}`,
      sessionId,
      "EX",
      7 * 24 * 60 * 60,
    );
  } catch (redisErr) {
    console.warn("[AuthService] Redis session save warning:", redisErr.message);
  }

  res.cookie("session", sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/"
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return res.status(200).json({
    success: true,
    message: "Login successful",
    data: user,
    user,
  });
});

export const logout = asyncHandler(async (req, res) => {
  const sessionId = req.cookies?.session;

  if (sessionId) {
    try {
      const sessionData = await redis.get(`session-${sessionId}`);
      if (sessionData) {
        const parsed = JSON.parse(sessionData);
        const uid = parsed._id || parsed.userId;
        if (uid) await redis.del(`user-session-${uid}`);
      }
      await redis.del(`session-${sessionId}`);
    } catch (_) {}
  }

  res.clearCookie("session", {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
  });

  return res.status(200).json({
    success: true,
    message: "Logout successfully",
  });
});

export const deductCredits = asyncHandler(async (req, res) => {
  const { userId, agent } = req.body;

  const COST = {
    chat: 1,
    search: 5,
    coding: 10,
    pdf: 10,
    ppt: 10,
    vision: 10,
  };

  if (!userId || !agent) {
    return res.status(400).json({
      success: false,
      message: "userId and agent are required.",
    });
  }

  const requiredCredits = COST[agent];

  if (!requiredCredits) {
    return res.status(400).json({
      success: false,
      message: `Invalid agent: ${agent}`,
    });
  }

  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found.",
    });
  }

  if (user.credits < requiredCredits) {
    return res.status(400).json({
      success: false,
      message: "Not enough credits.",
      requiredCredits,
      availableCredits: user.credits,
    });
  }

  user.credits -= requiredCredits;
  await user.save();

  const sessionId = await redis.get(`user-session-${user._id.toString()}`);

  console.log("sessionId:", sessionId);

  if (sessionId) {
    await redis.set(
      `session-${sessionId}`,
      JSON.stringify({
        userId: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        plan: user.plan,
        credits: user.credits,
        totalCredits: user.totalCredits,
        planExpiresAt: user.planExpiresAt,
      }),
      "EX",
      7 * 24 * 60 * 60,
    );
  }

  return res.status(200).json({
    success: true,
    message: `${requiredCredits} credits deducted successfully.`,
    agent,
    deductedCredits: requiredCredits,
    remainingCredits: user.credits,
  });
});
