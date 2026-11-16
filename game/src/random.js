// Deterministic randomness: a seeded generator so a run can be replayed from
// its seed, and a cheap hash for stable per-object variation.

export function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Stable pseudo-random value in [0,1) from an integer and a salt, used where a
// value must not change from frame to frame (wall rubble, dust motes).
export function hash01(n, salt = 1) {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(salt + 0x7f4a7c15, 0xc2b2ae35);
  h ^= h >>> 13;
  h = Math.imul(h, 0x27d4eb2d);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function pick(rand, list) {
  return list[Math.floor(rand() * list.length) % list.length];
}

export function randomSeed() {
  return (Math.random() * 0xffffffff) >>> 0;
}
