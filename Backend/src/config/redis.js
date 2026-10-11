// redis.js
import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

import Redis from "ioredis";

// General use: caching, rate limiting, etc.
export const redis = new Redis(process.env.REDIS_URL);

// BullMQ requires maxRetriesPerRequest: null
export const bullMQ_redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

redis.on("error", (err) => console.error("Redis error:", err.message));
bullMQ_redis.on("error", (err) => console.error("BullMQ Redis error:", err.message));