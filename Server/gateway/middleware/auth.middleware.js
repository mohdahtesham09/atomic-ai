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
    const cookieExists = Boolean(req.cookies?.session);
    let redisConnected = redis.status === "ready";

    if (!redisConnected && redis.status !== "connecting") {
      try {
        await redis.connect();
        redisConnected = redis.status === "ready";
      } catch (_) {
        redisConnected = false;
      }
    }

    const sessionId = req.cookies?.session;
    let session = null;
    let redisSessionFound = false;

    if (sessionId && redisConnected) {
      try {
        session = await redis.get(`session:${sessionId}`);
        redisSessionFound = Boolean(session);
      } catch (_) {
        session = null;
        redisSessionFound = false;
      }
    }

    console.log(
      `[Auth] cookie exists: ${cookieExists}, redis connected: ${redisConnected}, redis session found: ${redisSessionFound}`
    );

    if (!cookieExists || !sessionId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: session not found",
      });
    }

    if (!redisSessionFound || !session) {
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