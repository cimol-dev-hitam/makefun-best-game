// Small numeric helpers shared by the simulation and the renderer.

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Frame-rate independent smoothing: moves `current` toward `target` with a
// half-life style constant, so the camera feels the same at any frame rate.
export function damp(current, target, rate, dt) {
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}

export function smoothstep(t) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

export function easeOutCubic(t) {
  const x = clamp(t, 0, 1);
  return 1 - Math.pow(1 - x, 3);
}

export function pad(value, length) {
  const text = String(Math.max(0, Math.floor(value)));
  return text.length >= length ? text : '0'.repeat(length - text.length) + text;
}

// 123456 -> "123,456"
export function groupDigits(value) {
  return String(Math.max(0, Math.floor(value))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatDistance(pixels) {
  const metres = pixels / 11;
  return metres >= 1000 ? (metres / 1000).toFixed(2) + ' km' : Math.floor(metres) + ' m';
}

export function formatMultiplier(value) {
  return value.toFixed(2) + 'x';
}
