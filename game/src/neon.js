// Neon drawing primitives. There is no bloom pass: every glowing edge is the
// same path stroked three times, wide and faint to tight and bright, so the
// look costs three draw calls and stays sharp at any resolution.

import { PALETTE } from './config.js';

export function neonStroke(ctx, tracePath, options = {}) {
  const { colour = PALETTE.cyan, width = 2, glow = 12, alpha = 1, composite = 'lighter' } = options;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalCompositeOperation = composite;
  ctx.strokeStyle = colour;

  const passes = [
    [width + glow, 0.1 * alpha],
    [width + glow * 0.45, 0.22 * alpha],
    [width, 1 * alpha],
  ];
  for (const [lineWidth, passAlpha] of passes) {
    ctx.beginPath();
    tracePath(ctx);
    ctx.globalAlpha = passAlpha;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
  ctx.restore();
}

export function neonPolygon(ctx, tracePath, options = {}) {
  const { fill = PALETTE.wallDeep, alpha = 1, colour = PALETTE.magenta, glow = 10 } = options;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fill;
  ctx.beginPath();
  tracePath(ctx);
  ctx.fill();
  ctx.restore();
  if (colour) neonStroke(ctx, tracePath, { colour, width: 1.6, glow, alpha: alpha * 0.8 });
}

export function neonText(ctx, text, x, y, options = {}) {
  const {
    font = '700 20px ui-monospace, "SF Mono", Menlo, monospace',
    colour = PALETTE.white,
    glowColour = colour,
    glow = 18,
    alpha = 1,
    align = 'left',
    baseline = 'alphabetic',
  } = options;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillStyle = colour;
  // Two soft passes behind the glyphs read as light spill without a blur filter.
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha * 0.55;
  ctx.shadowColor = glowColour;
  ctx.shadowBlur = glow;
  ctx.fillText(text, x, y);
  ctx.globalAlpha = alpha;
  ctx.shadowBlur = glow * 0.35;
  ctx.fillText(text, x, y);
  ctx.restore();
}

// A panel: near-black with a hairline frame, used by every overlay screen.
export function drawPanel(ctx, x, y, w, h, options = {}) {
  const { fill = 'rgba(6, 8, 14, 0.82)', border = PALETTE.cyan, borderAlpha = 0.5, radius = 4 } = options;
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, x, y, w, h, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = border;
  ctx.globalAlpha = borderAlpha;
  ctx.stroke();
  // Corner ticks: a small nod to a targeting overlay.
  ctx.globalAlpha = borderAlpha * 0.9;
  ctx.strokeStyle = border;
  const tick = 12;
  ctx.beginPath();
  ctx.moveTo(x, y + tick);
  ctx.lineTo(x, y);
  ctx.lineTo(x + tick, y);
  ctx.moveTo(x + w - tick, y + h);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + w, y + h - tick);
  ctx.stroke();
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, radius) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

export function drawRule(ctx, x1, y, x2, colour = PALETTE.dim, alpha = 0.5) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = colour;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x1, y + 0.5);
  ctx.lineTo(x2, y + 0.5);
  ctx.stroke();
  ctx.restore();
}
