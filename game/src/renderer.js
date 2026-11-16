// Scene renderer: draws the canyon, the gates, the rings, the rider's light
// trail, the rider and the particles, all through one shared perspective
// projection. Everything is vector drawing on canvas 2D.

import { PALETTE } from './config.js';
import { neonStroke, roundRect } from './neon.js';
import { drawBackdropLayer, drawHorizonHaze, drawRoadSheen } from './overlay.js';
import { hash01 } from './random.js';
import { clamp } from './util.js';

const FAR_DISTANCE = 5600;
const SLICE_COUNT = 78;

// Wider, shallower copies of the corridor drawn behind it: the canyon walls the
// road is cut into.
const STRATA = [
  { scale: 1.28, expand: 165, fill: '#090614', edge: PALETTE.cyan, alpha: 0.22 },
  { scale: 1.72, expand: 330, fill: '#08050f', edge: PALETTE.magenta, alpha: 0.28 },
  { scale: 2.35, expand: 540, fill: '#06040b', edge: PALETTE.magenta, alpha: 0.18 },
];

// Depth samples: dense near the rider where motion is read, sparse far away
// where the projection compresses everything anyway.
function buildDepthSlices() {
  const slices = [];
  for (let dy = -340; dy < 0; dy += 85) slices.push(dy);
  slices.push(0);
  for (let i = 1; i <= SLICE_COUNT; i += 1) {
    const u = i / SLICE_COUNT;
    slices.push(Math.pow(u, 2.05) * FAR_DISTANCE);
  }
  return slices;
}

// Closes an edge polyline off to one side of the screen, so it can be filled.
function filledEdge(points, key, edgeX) {
  return (ctx) => {
    ctx.moveTo(points[0][key].x, points[0][key].y);
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i][key].x, points[i][key].y);
    ctx.lineTo(edgeX, points[points.length - 1][key].y);
    ctx.lineTo(edgeX, points[0][key].y);
    ctx.closePath();
  };
}

function edgeLine(points, key) {
  return (ctx) => {
    ctx.moveTo(points[0][key].x, points[0][key].y);
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i][key].x, points[i][key].y);
  };
}

export class SceneRenderer {
  constructor() {
    this.slices = buildDepthSlices();
  }

  // Sample the corridor (and its three canyon ledges) at every depth slice once
  // per frame; the wall, floor and marking passes all reuse these points.
  buildFrame(canyon, camera, project, width) {
    const camY = camera.y;
    const points = [];
    const strata = STRATA.map(() => []);
    for (const dy of this.slices) {
      const worldY = camY + dy;
      const { cx, hw } = canyon.sample(worldY);
      points.push({
        dy,
        worldY,
        cx,
        hw,
        left: project(cx - hw, worldY),
        right: project(cx + hw, worldY),
      });
      for (let i = 0; i < STRATA.length; i += 1) {
        const layer = STRATA[i];
        const centre = cx * layer.scale;
        const half = hw * layer.scale + layer.expand;
        strata[i].push({ left: project(centre - half, worldY), right: project(centre + half, worldY) });
      }
    }
    const cliffs = { left: [], right: [] };
    for (const slice of points) {
      for (const side of ['left', 'right']) {
        const sign = side === 'left' ? -1 : 1;
        const key = Math.round(slice.worldY / 165) + (sign > 0 ? 977 : 0);
        const reach = 190 + hash01(key, 4) * 340;
        cliffs[side].push(project(slice.cx + sign * (slice.hw + reach), slice.worldY));
      }
    }
    return { points, strata, cliffs, camY, width };
  }

  draw(ctx, view, scene) {
    const { canyon, camera, bike, particles, time, speedRatio } = scene;
    const project = camera.projector(view.width, view.height);
    const frame = this.buildFrame(canyon, camera, project, view.width);

    this.canyonRef = canyon;
    this.drawBackdrop(ctx, view, speedRatio, frame, project);
    this.drawCanyonStrata(ctx, frame, speedRatio);
    this.drawFloor(ctx, view, frame, speedRatio);
    this.drawFloorMarkings(ctx, view, project, canyon, frame);
    this.drawTrail(ctx, project, bike);
    this.drawRings(ctx, project, canyon, bike, time);
    this.drawGates(ctx, project, canyon, bike, time);
    this.drawWallFaces(ctx, view, frame);
    this.drawCliffs(ctx, frame, speedRatio);
    this.drawWallEdges(ctx, view, frame, speedRatio);
    this.drawWallDebris(ctx, view, project, canyon, frame);
    particles.draw(ctx, project);
    if (scene.showBike) this.drawBike(ctx, project, bike, time, scene.wrecked);
    return frame;
  }

  canyonSample(y) {
    return this.canyonRef ? this.canyonRef.sample(y) : null;
  }

  drawBackdrop(ctx, view, speedRatio, frame, project) {
    drawBackdropLayer(ctx, view.width, view.height);
    // A magenta haze at the vanishing point: the part of the canyon that already fell in.
    drawHorizonHaze(ctx, view.width, view.height);

    // Speed streaks on the road surface: short dashes of light that stream past
    // the rider and converge on the vanishing point.
    if (speedRatio > 0.08) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const spacing = 210;
      const first = Math.floor((frame.camY - 120) / spacing) * spacing;
      for (let i = 0; i < 22; i += 1) {
        const y = first + i * spacing;
        const corridor = this.canyonSample(y);
        if (!corridor) continue;
        const side = i % 2 === 0 ? 1 : -1;
        const x = corridor.cx + side * corridor.hw * (0.55 + hash01(i, 17) * 0.32);
        const a = project(x, y);
        const b = project(x, y + 150);
        if (a.y < -40 || b.y > view.height + 60) continue;
        ctx.globalAlpha = 0.03 + 0.1 * clamp(speedRatio, 0, 1);
        ctx.strokeStyle = i % 5 === 0 ? PALETTE.magenta : PALETTE.cyan;
        ctx.lineWidth = Math.max(1, 2.4 * a.s);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawCanyonStrata(ctx, frame, speedRatio) {
    for (let i = STRATA.length - 1; i >= 0; i -= 1) {
      const layer = STRATA[i];
      const points = frame.strata[i];
      const left = filledEdge(points, 'left', -600);
      const right = filledEdge(points, 'right', frame.width + 600);

      ctx.save();
      ctx.globalAlpha = layer.alpha;
      ctx.fillStyle = layer.fill;
      ctx.beginPath();
      left(ctx);
      ctx.fill();
      ctx.beginPath();
      right(ctx);
      ctx.fill();
      ctx.restore();

      const alpha = layer.alpha * (0.75 + speedRatio * 0.35);
      neonStroke(ctx, edgeLine(points, 'left'), { colour: layer.edge, width: 1, glow: 8, alpha });
      neonStroke(ctx, edgeLine(points, 'right'), { colour: layer.edge, width: 1, glow: 8, alpha });
    }
  }

  drawFloor(ctx, view, frame, speedRatio) {
    const points = frame.points;
    const floor = (ctx) => {
      ctx.moveTo(points[0].left.x, points[0].left.y);
      for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].left.x, points[i].left.y);
      for (let i = points.length - 1; i >= 0; i -= 1) ctx.lineTo(points[i].right.x, points[i].right.y);
      ctx.closePath();
    };

    ctx.save();
    ctx.beginPath();
    floor(ctx);
    ctx.clip();
    ctx.fillStyle = PALETTE.floor;
    ctx.fillRect(0, 0, view.width, view.height);

    const wash = ctx.createLinearGradient(0, view.height * 0.1, 0, view.height);
    wash.addColorStop(0, 'rgba(20, 30, 55, 0.55)');
    wash.addColorStop(0.45, 'rgba(9, 16, 28, 0.32)');
    wash.addColorStop(1, 'rgba(4, 6, 12, 0.12)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, view.width, view.height);

    // A cyan sheen up the middle of the road that brightens with speed.
    drawRoadSheen(ctx, view.width, view.height, 0.1 + speedRatio * 0.28);
    ctx.restore();
  }

  drawFloorMarkings(ctx, view, project, canyon, frame) {
    const camY = frame.camY;
    const startY = Math.floor((camY - 260) / 150) * 150;
    const endY = camY + 5200;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = PALETTE.cyan;

    // Cross lines give the road a ruled surface that streams toward the rider.
    for (let y = startY; y < endY; y += 150) {
      const corridor = canyon.sample(y);
      const left = project(corridor.cx - corridor.hw, y);
      const right = project(corridor.cx + corridor.hw, y);
      const fade = clamp(1 - (y - camY) / 5200, 0, 1);
      ctx.globalAlpha = 0.05 + 0.12 * fade;
      ctx.lineWidth = Math.max(0.6, left.s * 1.6);
      ctx.beginPath();
      ctx.moveTo(left.x, left.y);
      ctx.lineTo(right.x, right.y);
      ctx.stroke();
    }

    // Dashed centre line.
    ctx.strokeStyle = PALETTE.white;
    for (let y = startY; y < endY; y += 200) {
      const a = canyon.sample(y);
      const b = canyon.sample(y + 95);
      const p1 = project(a.cx, y);
      const p2 = project(b.cx, y + 95);
      if (p1.y < -60 || p2.y > view.height + 60) continue;
      ctx.globalAlpha = 0.09 * clamp(1 - (y - camY) / 4200, 0, 1);
      ctx.lineWidth = Math.max(0.7, 3 * p1.s);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    // Guard ticks along both walls: the strongest cue for raw speed.
    ctx.strokeStyle = PALETTE.cyanSoft;
    const tickStart = Math.floor((camY - 120) / 110) * 110;
    for (let y = tickStart; y < camY + 3000; y += 110) {
      const corridor = canyon.sample(y);
      for (const side of [-1, 1]) {
        const edge = project(corridor.cx + side * corridor.hw, y);
        const out = project(corridor.cx + side * (corridor.hw + 28), y);
        ctx.globalAlpha = clamp(0.5 - (y - camY) / 7000, 0.05, 0.5);
        ctx.lineWidth = Math.max(0.8, edge.s * 2.2);
        ctx.beginPath();
        ctx.moveTo(edge.x, edge.y);
        ctx.lineTo(out.x, out.y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // The light trail: a ribbon that fades with age, drawn additively so crossing
  // loops brighten instead of covering each other.
  drawTrail(ctx, project, bike) {
    const trail = bike.trail;
    if (trail.length < 4) return;
    const points = trail.map((point) => ({ ...project(point.x, point.y), age: point.age }));

    const ribbon = [];
    for (let i = 0; i < points.length; i += 1) {
      const prev = points[Math.max(0, i - 1)];
      const next = points[Math.min(points.length - 1, i + 1)];
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      const length = Math.hypot(dx, dy) || 1;
      const nx = -dy / length;
      const ny = dx / length;
      const life = 1 - clamp(points[i].age / 0.55, 0, 1);
      const half = 5.5 * points[i].s * (0.45 + life * 0.55);
      ribbon.push({
        left: { x: points[i].x + nx * half, y: points[i].y + ny * half },
        right: { x: points[i].x - nx * half, y: points[i].y - ny * half },
        life,
      });
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = PALETTE.cyan;
    for (let i = 1; i < ribbon.length; i += 1) {
      const a = ribbon[i - 1];
      const b = ribbon[i];
      ctx.globalAlpha = 0.1 + 0.45 * Math.min(a.life, b.life);
      ctx.beginPath();
      ctx.moveTo(a.left.x, a.left.y);
      ctx.lineTo(b.left.x, b.left.y);
      ctx.lineTo(b.right.x, b.right.y);
      ctx.lineTo(a.right.x, a.right.y);
      ctx.closePath();
      ctx.fill();
    }

    const fresh = Math.max(0, points.length - 24);
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = PALETTE.white;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(points[fresh].x, points[fresh].y);
    for (let i = fresh + 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
    ctx.restore();
  }

  drawRings(ctx, project, canyon, bike, time) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const ring of canyon.visibleRings(bike.y, 4400)) {
      const p = project(ring.x, ring.y);
      if (p.y < -80 || p.y > 1600) continue;
      const radius = Math.max(1.6, ring.r * p.s);
      const pulse = 1 + Math.sin(time * 3.4 + ring.phase) * 0.07;
      ctx.globalAlpha = clamp(0.24 + p.s * 0.9, 0.1, 1);
      ctx.strokeStyle = PALETTE.cyan;
      ctx.lineWidth = Math.max(1, 3.4 * p.s);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, radius * pulse, radius * 0.86 * pulse, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = clamp(0.14 + p.s * 0.5, 0.05, 0.7);
      ctx.fillStyle = PALETTE.cyanDeep;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, radius * 0.62, radius * 0.54, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = clamp(0.5 * p.s, 0.05, 0.9);
      ctx.fillStyle = PALETTE.white;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.8, radius * 0.16), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // A gate is a solid light barrier across the canyon with one opening: hit the
  // barrier and the run ends, thread the opening and the multiplier climbs.
  drawGates(ctx, project, canyon, bike, time) {
    for (const gate of canyon.visibleGates(bike.y, 4600)) {
      const corridor = canyon.sample(gate.y);
      const post = project(gate.cx, gate.y);
      const alpha = clamp(0.3 + post.s * 1.5, 0.2, 1);
      const segments = [
        [corridor.cx - corridor.hw, gate.cx - gate.gapHalf],
        [gate.cx + gate.gapHalf, corridor.cx + corridor.hw],
      ];

      for (const [fromX, toX] of segments) {
        if (toX <= fromX) continue;
        const a1 = project(fromX, gate.y - 9);
        const a2 = project(toX, gate.y - 9);
        const b1 = project(toX, gate.y + 9);
        const b2 = project(fromX, gate.y + 9);
        const trace = (ctx) => {
          ctx.moveTo(a1.x, a1.y);
          ctx.lineTo(a2.x, a2.y);
          ctx.lineTo(b1.x, b1.y);
          ctx.lineTo(b2.x, b2.y);
          ctx.closePath();
        };

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#2a0a1e';
        ctx.beginPath();
        trace(ctx);
        ctx.fill();
        ctx.restore();

        // Hatched stripes inside the barrier read as energy, not concrete.
        ctx.save();
        ctx.beginPath();
        trace(ctx);
        ctx.clip();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = PALETTE.magenta;
        ctx.globalAlpha = 0.4 * alpha;
        ctx.lineWidth = Math.max(1, 3 * post.s);
        const leftX = Math.min(a1.x, a2.x) - 30;
        const width = Math.abs(a2.x - a1.x) + 60;
        for (let x = leftX; x < leftX + width; x += 14) {
          ctx.beginPath();
          ctx.moveTo(x, a1.y - 6);
          ctx.lineTo(x + 9, b1.y + 6);
          ctx.stroke();
        }
        ctx.restore();

        neonStroke(ctx, trace, { colour: PALETTE.magenta, width: 1.4, glow: 10, alpha: alpha * 0.9 });
      }

      // The two posts that frame the opening, and a chevron pointing through it.
      for (const edgeX of [gate.cx - gate.gapHalf, gate.cx + gate.gapHalf]) {
        const marker = project(edgeX, gate.y);
        const size = Math.max(3, 9 * marker.s);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = alpha;
        ctx.fillStyle = PALETTE.cyan;
        ctx.fillRect(marker.x - size * 0.42, marker.y - size * 1.9, size * 0.84, size * 3.8);
        ctx.globalAlpha = alpha * 0.65;
        ctx.fillStyle = PALETTE.white;
        ctx.fillRect(marker.x - size * 0.16, marker.y - size * 1.5, size * 0.32, size * 3);
        ctx.restore();
      }

      const chevron = Math.max(4, 13 * post.s) * (1 + Math.sin(time * 5) * 0.07);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.8 * alpha;
      ctx.strokeStyle = PALETTE.cyanSoft;
      ctx.lineWidth = Math.max(1, 2 * post.s);
      ctx.beginPath();
      ctx.moveTo(post.x - chevron, post.y + chevron * 0.55);
      ctx.lineTo(post.x, post.y - chevron * 0.3);
      ctx.lineTo(post.x + chevron, post.y + chevron * 0.55);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawWallFaces(ctx, view, frame) {
    const points = frame.points;
    for (const trace of [filledEdge(points, 'left', -420), filledEdge(points, 'right', view.width + 420)]) {
      ctx.save();
      ctx.globalAlpha = 0.95;
      const wallGradient = ctx.createLinearGradient(0, 0, view.width, 0);
      wallGradient.addColorStop(0, PALETTE.wallNear);
      wallGradient.addColorStop(0.5, PALETTE.wallDeep);
      wallGradient.addColorStop(1, PALETTE.wallNear);
      ctx.fillStyle = wallGradient;
      ctx.beginPath();
      trace(ctx);
      ctx.fill();
      ctx.restore();
    }
  }

  // The lit lip of each wall, drawn after the rock so the spill lies over it.
  drawWallEdges(ctx, view, frame, speedRatio) {
    const points = frame.points;

    // Light spilling from the road onto the rock: three very wide, very faint
    // strokes down each edge, which read as a falloff across the wall face.
    const spill = 0.65 + speedRatio * 0.5;
    for (const side of ['left', 'right']) {
      const path = edgeLine(points, side);
      for (const [lineWidth, opacity] of [[120, 0.035], [52, 0.055], [20, 0.09]]) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = PALETTE.magenta;
        ctx.globalAlpha = opacity * spill;
        ctx.lineWidth = lineWidth;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        path(ctx);
        ctx.stroke();
        ctx.restore();
      }
    }

    const left = filledEdge(points, 'left', -420);
    const right = filledEdge(points, 'right', view.width + 420);
    for (const trace of [left, right]) {
      neonStroke(ctx, trace, { colour: PALETTE.magenta, width: 1.3, glow: 16, alpha: 0.5 + speedRatio * 0.3 });
    }
    // A cyan hairline along each edge keeps the corridor readable at a glance.
    neonStroke(ctx, edgeLine(points, 'left'), { colour: PALETTE.cyan, width: 1, glow: 8, alpha: 0.55 });
    neonStroke(ctx, edgeLine(points, 'right'), { colour: PALETTE.cyan, width: 1, glow: 8, alpha: 0.55 });
  }

  // Rock: a jagged band outside each wall, its outer ridge broken by the seeded
  // hash so the canyon looks quarried rather than extruded.
  drawCliffs(ctx, frame, speedRatio) {
    const points = frame.points;
    for (const side of ['left', 'right']) {
      const ridge = frame.cliffs[side];
      const trace = (ctx) => {
        ctx.moveTo(points[0][side].x, points[0][side].y);
        for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i][side].x, points[i][side].y);
        for (let i = ridge.length - 1; i >= 0; i -= 1) ctx.lineTo(ridge[i].x, ridge[i].y);
        ctx.closePath();
      };

      ctx.save();
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = '#0a0713';
      ctx.beginPath();
      trace(ctx);
      ctx.fill();
      ctx.restore();

      const ridgeColour = hash01(Math.round(frame.camY / 1200), side === 'left' ? 31 : 41) > 0.72 ? PALETTE.cyan : PALETTE.magenta;
      neonStroke(ctx, (c) => {
        c.moveTo(ridge[0].x, ridge[0].y);
        for (let i = 1; i < ridge.length; i += 1) c.lineTo(ridge[i].x, ridge[i].y);
      }, { colour: ridgeColour, width: 1.1, glow: 9, alpha: 0.24 + speedRatio * 0.2 });

      // Strata cracks running from the road edge out into the rock.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = PALETTE.magenta;
      for (let i = 2; i < points.length - 1; i += 3) {
        const near = points[i][side];
        const far = ridge[i];
        ctx.globalAlpha = 0.06 + speedRatio * 0.06;
        ctx.lineWidth = Math.max(0.6, near.s * 1.4);
        ctx.beginPath();
        ctx.moveTo(near.x, near.y);
        ctx.lineTo(far.x, far.y);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // Rubble and broken panels along the wall faces, seeded from world distance so
  // nothing flickers between frames.
  drawWallDebris(ctx, view, project, canyon, frame) {
    const camY = frame.camY;
    const step = 165;
    const start = Math.floor((camY - 200) / step) * step;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let y = start; y < camY + 3200; y += step) {
      const corridor = canyon.sample(y);
      const key = Math.round(y / step);
      for (const side of [-1, 1]) {
        const seed = key * 31 + (side > 0 ? 7 : 3);
        const height = 30 + hash01(seed, 5) * 130;
        const inset = 5 + hash01(seed, 9) * 24;
        const p = project(corridor.cx + side * (corridor.hw + inset), y);
        if (p.y < -80 || p.y > view.height + 100) continue;
        ctx.globalAlpha = clamp(0.2 + p.s * 0.5, 0.05, 0.55);
        ctx.strokeStyle = hash01(seed, 2) > 0.55 ? PALETTE.magenta : PALETTE.cyanDeep;
        ctx.lineWidth = Math.max(0.7, 2 * p.s);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + side * (3 + hash01(seed, 12) * 12) * p.s, p.y - height * p.s);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawBike(ctx, project, bike, time, wrecked) {
    const p = project(bike.x, bike.y);
    const s = p.s;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(bike.lean * 0.4);

    if (!wrecked) {
      // Underglow puddle of light on the road.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const glow = ctx.createRadialGradient(0, 6 * s, 0, 0, 6 * s, 62 * s);
      glow.addColorStop(0, 'rgba(65, 240, 255, 0.3)');
      glow.addColorStop(0.5, 'rgba(65, 240, 255, 0.09)');
      glow.addColorStop(1, 'rgba(65, 240, 255, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.ellipse(0, 6 * s, 62 * s, 40 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Headlight cone thrown forward over the road.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const beam = ctx.createLinearGradient(0, -18 * s, 0, -150 * s);
      beam.addColorStop(0, 'rgba(180, 250, 255, 0.16)');
      beam.addColorStop(1, 'rgba(180, 250, 255, 0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(-6 * s, -16 * s);
      ctx.lineTo(6 * s, -16 * s);
      ctx.lineTo(46 * s, -150 * s);
      ctx.lineTo(-46 * s, -150 * s);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Hull: a narrow arrowhead with two swept fins.
    const hull = (ctx) => {
      ctx.moveTo(0, -21 * s);
      ctx.lineTo(9 * s, -4 * s);
      ctx.lineTo(11 * s, 12 * s);
      ctx.lineTo(5 * s, 18 * s);
      ctx.lineTo(0, 14 * s);
      ctx.lineTo(-5 * s, 18 * s);
      ctx.lineTo(-11 * s, 12 * s);
      ctx.lineTo(-9 * s, -4 * s);
      ctx.closePath();
    };

    ctx.save();
    ctx.globalAlpha = wrecked ? 0.55 : 1;
    ctx.fillStyle = wrecked ? '#3a3d48' : PALETTE.white;
    ctx.beginPath();
    hull(ctx);
    ctx.fill();
    ctx.restore();

    neonStroke(ctx, hull, {
      colour: wrecked ? PALETTE.magenta : PALETTE.cyan,
      width: 1.6,
      glow: 12,
      alpha: wrecked ? 0.8 : 0.95,
    });

    if (!wrecked) {
      // Cockpit slit and thruster flare.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = PALETTE.cyan;
      ctx.globalAlpha = 0.9;
      roundRect(ctx, -3.4 * s, -9 * s, 6.8 * s, 10 * s, 3 * s);
      ctx.fill();
      const flare = 0.6 + Math.sin(time * 26) * 0.18;
      ctx.globalAlpha = 0.5 + flare * 0.4;
      ctx.fillStyle = PALETTE.magenta;
      ctx.beginPath();
      ctx.ellipse(0, 20 * s, 5.4 * s, (7 + flare * 7) * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
}
