// The canyon: a seeded chain of control nodes that the corridor is sampled
// from, plus the gates and rings placed along it. Nothing here draws; it only
// answers "where is the corridor at this distance?" and "what is out there?".

import { mulberry32 } from './random.js';
import { clamp, lerp } from './util.js';

const NODE_SPACING = 300;
const CORRIDOR_LIMIT = 430;

// Catmull-Rom through four control values: smooth centre and width with no
// visible corner where nodes meet.
function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (3 * p1 - p0 - 3 * p2 + p3) * t3);
}

export class Canyon {
  constructor(seed) {
    this.seed = seed >>> 0;
    this.rand = mulberry32(this.seed);
    this.nodes = [];
    this.gates = [];
    this.rings = [];
    this.drift = 1;
    this.chicaneRun = 0;
    this.lastGateY = -2000;

    // The first stretch is deliberately open so a new rider gets a runway.
    this.nodes.push({ y: -900, cx: 0, hw: 300 });
    this.nodes.push({ y: -600, cx: 0, hw: 300 });
    this.nodes.push({ y: -300, cx: 0, hw: 292 });
    this.nodes.push({ y: 0, cx: 0, hw: 286 });
    this.growTo(5200);
  }

  // Difficulty climbs with distance travelled, from 0 (wide, lazy) to 1 (tight
  // and full of chicanes).
  difficultyAt(y) {
    return 1 - Math.exp(-Math.max(0, y - 1200) / 24000);
  }

  growTo(y) {
    while (this.nodes[this.nodes.length - 1].y < y) this.addNode();
  }

  addNode() {
    const last = this.nodes[this.nodes.length - 1];
    const y = last.y + NODE_SPACING;
    const t = this.difficultyAt(y);
    const rand = this.rand;

    let hw = lerp(268, 138, t) * (0.92 + rand() * 0.18);
    hw = Math.max(hw, 124);
    let amplitude;

    if (this.chicaneRun > 0) {
      // Tight S-bends: the direction flips at every node for two or three nodes.
      this.chicaneRun -= 1;
      this.drift *= -1;
      amplitude = lerp(85, 160, t) * (0.85 + rand() * 0.3);
      hw *= 0.94;
    } else if (rand() < 0.28 + 0.34 * t) {
      this.chicaneRun = 1 + Math.floor(rand() * 2);
      this.drift *= -1;
      amplitude = lerp(80, 155, t) * (0.85 + rand() * 0.3);
      hw *= 0.96;
    } else {
      if (rand() < 0.42) this.drift *= -1;
      amplitude = lerp(40, 110, t) * (0.55 + rand() * 0.9);
    }

    let cx = last.cx + this.drift * amplitude;
    // Bend the corridor back toward the middle when it wanders too far, so the
    // road never walks off the side of the screen.
    cx -= cx * 0.16;
    cx = clamp(cx, -CORRIDOR_LIMIT, CORRIDOR_LIMIT);

    this.nodes.push({ y, cx, hw });
    this.placeGate(y, cx, hw, t);
    this.placeRings(y, cx, hw, rand);
  }

  placeGate(y, cx, hw, t) {
    if (y < 900 || y - this.lastGateY < 900) return;
    if (this.rand() > 0.72 + 0.18 * t) return;

    const gapHalf = lerp(96, 58, t);
    const room = Math.max(0, hw - gapHalf - 44);
    const gapCentre = cx + (this.rand() * 2 - 1) * 0.72 * room;
    this.lastGateY = y;
    this.gates.push({ y, cx: gapCentre, gapHalf });
  }

  placeRings(y, cx, hw, rand) {
    const count = rand() < 0.55 ? 2 : 1;
    for (let i = 0; i < count; i += 1) {
      const spread = hw * 0.42;
      const x = cx + (rand() * 2 - 1) * spread * 0.75;
      const ry = y + rand() * NODE_SPACING * 0.8;
      this.rings.push({ x, y: ry, r: 27, taken: false, phase: rand() * Math.PI * 2 });
    }
  }

  // Index of the node at or before y.
  nodeIndexAt(y) {
    const nodes = this.nodes;
    let lo = 0;
    let hi = nodes.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (nodes[mid].y <= y) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  // Centre and half-width of the corridor at world distance y.
  sample(y) {
    this.growTo(y + NODE_SPACING * 3);
    const i = this.nodeIndexAt(y);
    const n0 = this.nodes[Math.max(0, i - 1)];
    const n1 = this.nodes[i];
    const n2 = this.nodes[Math.min(this.nodes.length - 1, i + 1)];
    const n3 = this.nodes[Math.min(this.nodes.length - 1, i + 2)];
    const span = Math.max(1, n2.y - n1.y);
    const t = clamp((y - n1.y) / span, 0, 1);

    const cx = catmull(n0.cx, n1.cx, n2.cx, n3.cx, t);
    const hw = Math.max(104, catmull(n0.hw, n1.hw, n2.hw, n3.hw, t));
    return { cx, hw };
  }

  // Distance from the bike to the nearest wall face at its own distance.
  wallDistance(y, x) {
    const { cx, hw } = this.sample(y);
    return hw - Math.abs(x - cx);
  }

  // Where the racing line wants the bike to be: the gate opening when one is
  // close, otherwise the middle of the corridor a little ahead.
  aimPoint(y, lookAhead = 300) {
    const gate = this.gateNear(y, 1250);
    const middle = this.sample(y + lookAhead).cx;
    if (gate) {
      // Commit to the opening earlier the faster the bike closes on it.
      const gain = 1 - clamp((gate.y - y - 340) / 820, 0, 1);
      return { x: lerp(middle, gate.cx, gain), gate };
    }
    return { x: middle, gate: null };
  }

  gateNear(y, range) {
    for (let i = 0; i < this.gates.length; i += 1) {
      const gate = this.gates[i];
      if (gate.y > y && gate.y < y + range) return gate;
    }
    return null;
  }

  // Gates and rings the draw pass should consider at this distance.
  visibleGates(y, range) {
    return this.gates.filter((gate) => gate.y > y - 120 && gate.y < y + range);
  }

  visibleRings(y, range) {
    return this.rings.filter((ring) => !ring.taken && ring.y > y - 90 && ring.y < y + range);
  }

  // Collapses the canyon behind the rider: forget nodes well behind and drop
  // collected rings so a long run stays cheap.
  pruneBehind(y) {
    const cut = y - 2600;
    if (this.nodes.length > 64 && this.nodes[0].y < cut - 4000) {
      let drop = 0;
      while (drop < this.nodes.length - 8 && this.nodes[drop + 1].y < cut) drop += 1;
      if (drop > 0) this.nodes.splice(0, drop);
    }
    if (this.rings.length > 700) this.rings = this.rings.filter((ring) => ring.y > y - 1200);
    if (this.gates.length > 200) this.gates = this.gates.filter((gate) => gate.y > y - 1200);
  }
}
