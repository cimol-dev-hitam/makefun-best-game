// Camera: trails the bike with lag, shakes on impact, and owns the single
// perspective projection every draw call shares, so the whole scene stays
// consistent while the far canyon compresses toward the horizon.

import { TUNING } from './config.js';
import { damp } from './util.js';

export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.shake = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.phase = 0;
  }

  snapTo(bike) {
    this.x = bike.x;
    this.y = bike.y - TUNING.cameraPullBack;
    this.shake = 0;
  }

  update(bike, dt) {
    this.x = damp(this.x, bike.x, TUNING.cameraFollowRate, dt);
    this.y = bike.y - TUNING.cameraPullBack;
    this.phase += dt;

    if (this.shake > 0.01) {
      this.shake = damp(this.shake, 0, 5.5, dt);
      const wobble = this.phase * 60;
      this.shakeX = Math.sin(wobble * 1.7) * this.shake * 16;
      this.shakeY = Math.cos(wobble * 2.3) * this.shake * 12;
    } else {
      this.shake = 0;
      this.shakeX = 0;
      this.shakeY = 0;
    }
  }

  kick(amount) {
    this.shake = Math.min(1.6, this.shake + amount);
  }

  // Returns project(worldX, worldY) -> {x, y, s} in CSS pixels.
  projector(width, height) {
    const K = TUNING.perspective;
    const centre = width / 2;
    const baseY = height * TUNING.focusLine;
    const camX = this.x + this.shakeX;
    const camY = this.y + this.shakeY;

    return (worldX, worldY) => {
      const dy = worldY - camY;
      if (dy <= 0) return { x: centre + (worldX - camX), y: baseY - dy, s: 1 };
      const s = 1 / (1 + dy * K);
      return { x: centre + (worldX - camX) * s, y: baseY - dy * s, s };
    };
  }
}
