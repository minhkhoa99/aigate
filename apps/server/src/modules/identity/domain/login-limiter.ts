// Progressive lockout for password checks (identity.password-login-lockout, REFERENCE_BEHAVIOR).
const MAX_FAILS_BEFORE_LOCK = 5;
const LOCK_STEPS_MS = [30_000, 120_000, 600_000, 1_800_000];
const FAIL_WINDOW_MS = 60 * 60_000;
// 9router's map had no bound. ponytail: oldest client is evicted first; an attacker with more
// than this many source addresses can reset its own entry, which a per-IP limiter cannot stop anyway.
const MAX_TRACKED_CLIENTS = 10_000;

interface Entry {
  fails: number;
  lockUntil: number;
  lockLevel: number;
  lastFailAt: number;
}

export type LockState = { locked: false } | { locked: true; retryAfterSeconds: number };

export class LoginLimiter {
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly now: () => number = Date.now) {}

  check(client: string): LockState {
    const entry = this.current(client);
    const remaining = entry ? entry.lockUntil - this.now() : 0;
    return remaining > 0 ? { locked: true, retryAfterSeconds: Math.ceil(remaining / 1000) } : { locked: false };
  }

  fail(client: string): { remainingBeforeLock: number } {
    const now = this.now();
    const entry = this.current(client) ?? { fails: 0, lockUntil: 0, lockLevel: 0, lastFailAt: 0 };
    entry.fails += 1;
    entry.lastFailAt = now;
    if (entry.fails >= MAX_FAILS_BEFORE_LOCK) {
      entry.lockUntil = now + LOCK_STEPS_MS[Math.min(entry.lockLevel, LOCK_STEPS_MS.length - 1)];
      entry.lockLevel += 1;
      entry.fails = 0;
    }
    this.entries.delete(client);
    if (this.entries.size >= MAX_TRACKED_CLIENTS) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.set(client, entry);
    return { remainingBeforeLock: MAX_FAILS_BEFORE_LOCK - entry.fails };
  }

  succeed(client: string): void {
    this.entries.delete(client);
  }

  private current(client: string): Entry | undefined {
    const entry = this.entries.get(client);
    if (!entry) return undefined;
    const now = this.now();
    if (now - entry.lastFailAt > FAIL_WINDOW_MS && now >= entry.lockUntil) {
      this.entries.delete(client);
      return undefined;
    }
    return entry;
  }
}
