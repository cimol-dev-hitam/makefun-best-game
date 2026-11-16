// Particles: exhaust, wall sparks, ring bursts and crash debris. One pooled
// array, one additive draw call per particle, no images anywhere.

import { TUNING, PALETTE } from './config.js';
import { clamp } from './util.js';

const KINDS = {
  exhaust: { life: 0.55, size: 7, drag: 2.2, colour: PALETTE.cyan, growth: -3 },
  spark: { life: 0.42, size: 2.4, drag: 0.9, colour: PALETTE.cyanSoft, growth: -1 },
  magentaSpark: { life: 0.5, size: 2.8, drag: 1.1, colour: PALETTE.magentaSoft, growth: -1 },
  debris: { life: 1.1, size: 3.4, drag: 0.6, colour: PALETTE.white, growth: -0.6 },
  burst: { life: 0.6, size: 5, drag: 2.4, colour: PALETTE.cyan, growth: 26 },
  gateBurst: { life: 0.8, size: 6, drag: 1.6, colour: PALETTE.magenta, growth: 30 },
};

export class Particles {
  constructor(limit = TUNING.maxParticles) {
    this.limit = limit;
    this.items = [];
  }

  clear() {
    this.items.length = 0;
  }

  spawn(kind, x, y, options = {}) {
    const spec = KINDS[kind] ?? KINDS.spark;
    if (this.items.length >= this.limit) this.items.shift();
    const spread = options.spread ?? 1;
    this.items.push({
      kind,
      x,
      y,
      vx: options.vx ?? (Math.random() - 0.5) * 260 * spread,
      vy: options.vy ?? (Math.random() - 0.5) * 260 * spread,
      life: spec.life * (0.7 + Math.random() * 0.6),
      age: 0,
      size: spec.size * (0.6 + Math.random() * 0.8),
      growth: spec.growth,
      drag: spec.drag,
      colour: options.colour ?? spec.colour,
    });
  }

  burst(kind, x, y, count, speed = 240) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const power = speed * (0.35 + Math.random() * 0.9);
      this.spawn(kind, x, y, {
        vx: Math.cos(angle) * power,
        vy: Math.sin(angle) * power,
        spread: 0.4,
      });
    }
  }

  update(dt, bike, forwardSpeed) {
    // One exhaust puff every few steps: a stream, not a wall of light.
    if (bike.alive && Math.random() < 0.3) {
      const back = -17 - Math.random() * 8;
      this.spawn('exhaust', bike.x + (Math.random() - 0.5) * 7, bike.y + back, {
        vx: (Math.random() - 0.5) * 60 - bike.lateralVelocity * 0.4,
        vy: -forwardSpeed * 0.18 - Math.random() * 70,
      });
    }

    for (let i = this.items.length - 1; i >= 0; i -= 1) {
      const p = this.items[i];
      p.age += dt;
      if (p.age >= p.life) {
        this.items.splice(i, 1);
        continue;
      }
      const drag = Math.exp(-p.drag * dt);
      p.vx *= drag;
      p.vy *= drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.size = Math.max(0.4, p.size + p.growth * dt);
    }
  }

  draw(ctx, project) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.items) {
      const point = project(p.x, p.y);
      const fade = 1 - p.age / p.life;
      const radius = Math.max(0.5, p.size * (0.4 + point.s * 0.9));
      ctx.globalAlpha = clamp(fade * 0.85, 0, 1);
      ctx.fillStyle = p.colour;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
