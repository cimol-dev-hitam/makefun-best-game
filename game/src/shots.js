// Screenshot harness: reads a ?shot= query so a still can be taken of an exact
// moment, and drives the bike through the canyon by itself while it gets there.
// With no query string none of this runs and the game opens on its title.

import { clamp } from './util.js';

export function readShotConfig() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('shot');
  if (!mode) return null;
  return {
    mode,
    seed: Number.parseInt(params.get('seed') ?? '7', 10) >>> 0,
    t: Number.parseFloat(params.get('t') ?? '0') || 0,
    multiplier: params.has('mult') ? Number.parseFloat(params.get('mult')) : undefined,
    score: params.has('score') ? Number.parseFloat(params.get('score')) : undefined,
  };
}

// A simple aiming autopilot: look a little way up the road, pick the corridor
// centre (or the gate opening when one is close), and steer at it with a term
// that cancels the bike's own sideways drift.
export function autopilotSteer(bike, canyon, seed = 0) {
  const here = canyon.sample(bike.y);
  const aim = canyon.aimPoint(bike.y, 280);
  const margin = 34;

  // Without a gate to aim at, follow a weighted line through the corridor a
  // little, a fair way and a long way ahead, so corners are entered early.
  let target = aim.x;
  if (!aim.gate) {
    const near = canyon.sample(bike.y + 240).cx;
    const mid = canyon.sample(bike.y + 620).cx;
    const far = canyon.sample(bike.y + 1050).cx;
    target = near * 0.48 + mid * 0.32 + far * 0.2;
  }

  // Never ride the wall: if the margin gets thin, head back inside first, but
  // only when no gate has been committed to (a gap can sit close to a wall).
  const room = here.hw - Math.abs(bike.x - here.cx);
  if (room < 34 && !aim.gate) target = here.cx + Math.sign(here.cx - bike.x) * here.hw * 0.4;
  target = clamp(target, here.cx - here.hw + margin, here.cx + here.hw - margin);

  const wobble = Math.sin((bike.y + seed) * 0.0045) * 18;
  const error = target + wobble - bike.x;
  const axis = clamp((error * 4.2 - bike.lateralVelocity * 0.28) / 220, -1, 1);
  return { axis, brake: false };
}
