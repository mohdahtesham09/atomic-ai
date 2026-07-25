import Redis from "ioredis";

const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: process.env.REDIS_PORT || 6379,
  lazyConnect: true,
  retryStrategy: (times) => Math.min(times * 100, 3000),
});

redis.on("error", (err) => {
  console.warn("[Gateway Redis Warning]:", err.message);
});

const protect = async (req, res, next) => {
  try {
    const sessionId = req.cookies?.session;

    if (!sessionId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: session not found",
      });
    }

    let session = null;
    try {
      if (redis.status !== "ready" && redis.status !== "connecting") {
        await redis.connect().catch(() => {});
      }
      session = await redis.get(`session-${sessionId}`).catch(() => null);
    } catch (_) {}

    if (!session) {
      return res.status(401).json({
        success: false,
        message: "Session expired or invalid",
      });
    }

    const userData = JSON.parse(session);
    const userId = userData._id || userData.userId || userData.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: user id not found in session",
      });
    }

    req.user = {
      ...userData,
      _id: String(userId),
      id: String(userId),
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: `Protect middleware error: ${error.message}`,
    });
  }
};

export default protect;