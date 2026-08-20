const buckets = globalThis.__splusTutorBuckets || new Map();
globalThis.__splusTutorBuckets = buckets;

export function checkBasicDailyLimit(key, limit = 25) {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const current = buckets.get(key);
  if (!current || now - current.startedAt > day) {
    buckets.set(key, { startedAt: now, count: 1 });
    return { allowed: true, remaining: Math.max(0, limit - 1) };
  }
  if (current.count >= limit) return { allowed: false, remaining: 0 };
  current.count += 1;
  return { allowed: true, remaining: Math.max(0, limit - current.count) };
}
