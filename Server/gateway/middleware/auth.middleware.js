import redis from "../../shared/redis/redis.js";

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
    let sessionFound = false;

    if (sessionId && redisConnected) {
      try {
        session = await redis.get(`session:${sessionId}`);
        sessionFound = Boolean(session);
      } catch (_) {
        session = null;
        sessionFound = false;
      }
    }

    console.log(
      `[Auth] redis connected: ${redisConnected}, cookie exists: ${cookieExists}, session found: ${sessionFound}`
    );

    if (!cookieExists || !sessionId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: session not found",
      });
    }

    if (!sessionFound || !session) {
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