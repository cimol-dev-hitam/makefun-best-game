// The rider: forward acceleration that never stops, lateral inertia, the light
// trail it leaves, and every collision the run can end on.

import { TUNING } from './config.js';
import { clamp, damp } from './util.js';

export class Bike {
  constructor() {
    this.reset(0);
  }

  reset(seedOffset = 0) {
    this.x = 0;
    this.y = 0;
    this.lateralVelocity = 0;
    this.speed = TUNING.startSpeed;
    this.speedBonus = 0;
    this.lean = 0;
    this.trail = [];
    this.trailClock = 0;
    this.alive = true;
    this.deathCause = null;
    this.prevY = 0;
    this.graze = 0;
    this.grazeHeat = 0;
    this.seedOffset = seedOffset;
  }

  get speedRatio() {
    return clamp((this.speed - TUNING.startSpeed) / (TUNING.maxSpeed - TUNING.startSpeed), 0, 1.2);
  }

  maxLateral() {
    return TUNING.maxLateralSpeed + this.speed * TUNING.lateralSpeedPerForward;
  }

  // dt is a fixed simulation step; input is {axis, brake}.
  update(dt, input, canyon, events) {
    if (!this.alive) return;

    // Forward: the bike always accelerates unless the rider brakes, and a graze
    // bonus fades away over the next second or so.
    this.speedBonus = Math.max(0, this.speedBonus - TUNING.grazeDecay * dt);
    if (input.brake) {
      this.speed = Math.max(TUNING.brakeFloor, this.speed - TUNING.brakeDrag * dt);
    } else {
      const push = TUNING.acceleration * (1 + this.speed * 0.00022);
      this.speed = Math.min(TUNING.maxSpeed * (1 + this.speedBonus), this.speed + push * dt);
    }

    // Lateral: acceleration from the stick, then damping, so the bike drifts
    // into a turn and settles rather than snapping sideways.
    const grip = 0.72 + 0.28 * (1 - clamp(this.speedRatio, 0, 1));
    this.lateralVelocity += input.axis * TUNING.steerAcceleration * grip * dt;
    this.lateralVelocity *= Math.exp(-TUNING.steerDamping * dt);
    this.lateralVelocity = clamp(this.lateralVelocity, -this.maxLateral(), this.maxLateral());
    this.x += this.lateralVelocity * dt;

    this.lean = damp(this.lean, clamp(this.lateralVelocity / 620, -1, 1), 9, dt);

    this.prevY = this.y;
    this.y += this.speed * dt;

    canyon.growTo(this.y + 4000);

    this.checkGraze(canyon, events, dt);
    this.checkWalls(canyon, events);
    if (!this.alive) return;
    this.checkGates(canyon, events);
    this.checkRings(canyon, events);
    this.pushTrail(dt);
  }

  // Ride the wall closely and you get sparks, a little score and a short burst
  // of speed; touch it and the run is over.
  checkGraze(canyon, events, dt) {
    const gap = canyon.wallDistance(this.y, this.x);
    const band = TUNING.grazeBand;
    this.graze = clamp(1 - (gap - TUNING.bikeHalfWidth) / band, 0, 1);
    if (this.graze > 0 && gap > TUNING.bikeHalfWidth) {
      this.speedBonus = Math.min(TUNING.grazeSpeedBonus, this.speedBonus + this.graze * TUNING.grazeCharge * dt);
      this.grazeHeat = Math.min(1, this.grazeHeat + this.graze * 2.2 * dt);
      events.graze = Math.max(events.graze, this.graze);
      events.grazeScore += TUNING.grazeScore * this.graze * dt;
    } else {
      this.graze = 0;
      this.grazeHeat = Math.max(0, this.grazeHeat - 1.4 * dt);
    }
  }

  checkWalls(canyon, events) {
    const gap = canyon.wallDistance(this.y, this.x);
    if (gap <= TUNING.bikeHalfWidth - TUNING.wallPadding) {
      this.alive = false;
      this.deathCause = 'CANYON WALL';
      events.crash = { x: this.x, y: this.y, side: this.x < canyon.sample(this.y).cx ? -1 : 1, kind: 'wall' };
    }
  }

  checkGates(canyon, events) {
    for (const g of canyon.visibleGates(this.prevY - 1, 400)) {
      if (this.prevY <= g.y && this.y >= g.y) {
        const offset = Math.abs(this.x - g.cx);
        if (offset > g.gapHalf - 8) {
          this.alive = false;
          this.deathCause = 'GATE PYLON';
          events.crash = { x: this.x, y: g.y, side: Math.sign(this.x - g.cx) || 1, kind: 'gate' };
          return;
        }
        events.gates += 1;
        events.gateBurst = { x: g.cx, y: g.y };
      }
    }
  }

  checkRings(canyon, events) {
    for (const ring of canyon.visibleRings(this.y - 90, 260)) {
      const dx = this.x - ring.x;
      const dy = this.y - ring.y;
      if (dx * dx + dy * dy < (ring.r + 20) * (ring.r + 20)) {
        ring.taken = true;
        events.rings += 1;
        events.ringBurst = { x: ring.x, y: ring.y };
      }
    }
  }

  pushTrail(dt) {
    this.trailClock += dt;
    const head = this.trail.length ? this.trail[this.trail.length - 1] : null;
    const moved = head ? Math.hypot(this.x - head.x, this.y - head.y) : Infinity;
    if (moved > 7 || !head) {
      this.trail.push({ x: this.x, y: this.y, age: 0 });
      if (this.trail.length > 96) this.trail.shift();
    }
    for (const point of this.trail) point.age += dt;
    while (this.trail.length && this.trail[0].age > 0.55) this.trail.shift();
  }
}
