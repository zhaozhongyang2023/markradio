const failures = new Map();
const cooldownMs = 10 * 1000;

export function assertServiceAvailable(name) {
  const until = failures.get(name) || 0;
  if (Date.now() < until) {
    throw new Error(`${name} temporarily unavailable`);
  }
}

export function markServiceFailure(name) {
  failures.set(name, Date.now() + cooldownMs);
}

export function markServiceSuccess(name) {
  failures.delete(name);
}
