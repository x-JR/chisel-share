/**
 * In-memory sliding-window rate limiter.
 *
 * Suitable for single-process deployments (Docker single container).
 * If you ever scale to multiple instances, replace with a Redis-backed approach.
 */

interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();

// Prune stale buckets every minute to avoid unbounded memory growth.
setInterval(() => {
  const cutoff = Date.now() - 3_600_000; // keep last 1 hour at most
  for (const [key, bucket] of buckets) {
    bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);
    if (bucket.timestamps.length === 0) buckets.delete(key);
  }
}, 60_000);

export interface RateLimitResult {
  allowed: boolean;
  /** Requests remaining in current window (only meaningful when allowed = true). */
  remaining: number;
  /** Milliseconds until the oldest request falls outside the window. */
  retryAfterMs: number;
}

/**
 * Check and record a rate-limit hit.
 *
 * @param ip       - Client IP address used as the identity key.
 * @param action   - Logical action name (e.g. "download", "upload").
 * @param limit    - Maximum number of requests allowed in `windowMs`.
 * @param windowMs - Sliding window length in milliseconds.
 */
export function checkRateLimit(
  ip: string,
  action: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const key = `${action}:${ip}`;
  const now = Date.now();
  const windowStart = now - windowMs;

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    buckets.set(key, bucket);
  }

  // Drop timestamps outside the window.
  bucket.timestamps = bucket.timestamps.filter((t) => t > windowStart);

  if (bucket.timestamps.length >= limit) {
    const oldest = bucket.timestamps[0];
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: oldest + windowMs - now,
    };
  }

  bucket.timestamps.push(now);
  return {
    allowed: true,
    remaining: limit - bucket.timestamps.length,
    retryAfterMs: 0,
  };
}
