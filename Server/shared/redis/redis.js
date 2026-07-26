import Redis from 'ioredis';

const getRedisClient = () => {
  const options = {
    lazyConnect: true,
    retryStrategy: (times) => Math.min(times * 100, 3000),
  };

  if (process.env.REDIS_URL) {
    return new Redis(process.env.REDIS_URL, options);
  }

  return new Redis({
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    ...options,
  });
};

const redis = getRedisClient();

redis.on("connect", () => {
  console.log("[Redis] connected");
});

redis.on("error", (err) => {
  console.warn("[Redis] connection warning:", err.message);
});

export default redis;