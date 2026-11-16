// Non-game screens: the title, the pause overlay and the run summary. They are
// drawn over the live canyon behind them, so every screen is still the game.

import { PALETTE } from './config.js';
import { drawPanel, drawRule, neonText, roundRect } from './neon.js';
import { clamp, groupDigits } from './util.js';

const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

function font(size, weight = 700) {
  return `${weight} ${size}px ${MONO}`;
}

function tracking(ctx, pixels) {
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${pixels}px`;
}

function keycap(ctx, x, y, label, width, height, active = false) {
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, x, y, width, height, 3);
  ctx.fillStyle = active ? 'rgba(65, 240, 255, 0.16)' : 'rgba(244, 248, 255, 0.06)';
  ctx.fill();
  ctx.strokeStyle = active ? PALETTE.cyan : 'rgba(244, 248, 255, 0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
  neonText(ctx, label, x + width / 2, y + height / 2, {
    font: font(11, 700),
    colour: active ? PALETTE.cyan : PALETTE.white,
    align: 'center',
    baseline: 'middle',
    glow: active ? 10 : 0,
  });
}

function caption(ctx, x, y, text, colour = PALETTE.dim, align = 'left', alpha = 1) {
  neonText(ctx, text, x, y, { font: font(11, 600), colour, align, alpha });
}

export function drawTitle(ctx, view, state) {
  const { width, height } = view;
  const u = clamp(height / 720, 0.62, 1.6);
  const centreX = width / 2;

  // Darken the attract-mode canyon so the type sits on top of it.
  const scrim = ctx.createLinearGradient(0, 0, 0, height);
  scrim.addColorStop(0, 'rgba(3, 4, 10, 0.72)');
  scrim.addColorStop(0.42, 'rgba(3, 4, 10, 0.34)');
  scrim.addColorStop(0.72, 'rgba(3, 4, 10, 0.62)');
  scrim.addColorStop(1, 'rgba(3, 4, 10, 0.9)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, width, height);

  // Wordmark.
  const topY = height * 0.3;
  ctx.save();
  tracking(ctx, 10 * u);
  neonText(ctx, 'NEON', centreX, topY - 40 * u, {
    font: font(30 * u, 600),
    colour: PALETTE.white,
    align: 'center',
    alpha: 0.92,
    glow: 16,
  });
  ctx.restore();

  ctx.save();
  tracking(ctx, 4 * u);
  neonText(ctx, 'SLIPSTREAM', centreX, topY + 40 * u, {
    font: font(88 * u, 700),
    colour: PALETTE.cyan,
    glowColour: PALETTE.cyan,
    glow: 34,
    align: 'center',
  });
  ctx.restore();

  // A magenta streak under the wordmark, like a bike's light trail.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = PALETTE.magenta;
  ctx.lineWidth = 2 * u;
  ctx.beginPath();
  ctx.moveTo(centreX - 250 * u, topY + 66 * u);
  ctx.lineTo(centreX - 120 * u, topY + 60 * u);
  ctx.lineTo(centreX + 262 * u, topY + 52 * u);
  ctx.stroke();
  ctx.restore();

  drawRule(ctx, centreX - 210 * u, topY + 74 * u, centreX + 210 * u, PALETTE.dim, 0.45);
  caption(ctx, centreX, topY + 98 * u, 'ENDLESS CANYON RUN  ·  ONE LIFE  ·  NO FINISH LINE', PALETTE.cyanSoft, 'center', 0.85);

  // Controls.
  const panelY = height * 0.56;
  const panelW = 540 * u;
  const panelH = 96 * u;
  drawPanel(ctx, centreX - panelW / 2, panelY, panelW, panelH, { borderAlpha: 0.28 });

  const capY = panelY + 20 * u;
  let capX = centreX - panelW / 2 + 28 * u;
  keycap(ctx, capX, capY, 'A', 26 * u, 26 * u, false);
  keycap(ctx, capX + 30 * u, capY, 'D', 26 * u, 26 * u, false);
  caption(ctx, capX + 64 * u, capY + 17 * u, 'STEER', PALETTE.white, 'left', 0.9);

  capX += 128 * u;
  keycap(ctx, capX, capY, 'S', 26 * u, 26 * u, false);
  caption(ctx, capX + 34 * u, capY + 17 * u, 'BRAKE', PALETTE.white, 'left', 0.9);

  capX += 96 * u;
  keycap(ctx, capX, capY, 'P', 26 * u, 26 * u, false);
  caption(ctx, capX + 34 * u, capY + 17 * u, 'PAUSE', PALETTE.white, 'left', 0.9);

  capX += 104 * u;
  keycap(ctx, capX, capY, 'R', 26 * u, 26 * u, false);
  caption(ctx, capX + 34 * u, capY + 17 * u, 'RESTART', PALETTE.white, 'left', 0.9);

  caption(
    ctx,
    centreX,
    panelY + 76 * u,
    'GRAZE THE WALLS FOR A SPEED BONUS  ·  THREAD THE GATES TO BUILD YOUR MULTIPLIER',
    PALETTE.dim,
    'center',
    0.9,
  );

  // Call to action, on its own strip so the canyon behind can never swallow it.
  const ctaY = height * 0.79;
  ctx.save();
  ctx.globalAlpha = 0.82;
  ctx.fillStyle = 'rgba(4, 5, 11, 0.86)';
  roundRect(ctx, centreX - 190 * u, ctaY - 34 * u, 380 * u, 52 * u, 3);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 0.4;
  ctx.strokeStyle = PALETTE.cyan;
  ctx.lineWidth = 1;
  roundRect(ctx, centreX - 190 * u, ctaY - 34 * u, 380 * u, 52 * u, 3);
  ctx.stroke();
  ctx.restore();

  const pulse = 0.65 + Math.sin(state.time * 3.2) * 0.25;
  neonText(ctx, 'PRESS SPACE TO RIDE', centreX, ctaY, {
    font: font(20 * u, 700),
    colour: PALETTE.white,
    glowColour: PALETTE.cyan,
    glow: 26,
    alpha: pulse + 0.2,
    align: 'center',
  });

  // Best score and seed, top corners.
  caption(ctx, 32 * u, 40 * u, 'BEST RUN', PALETTE.dim);
  neonText(ctx, groupDigits(state.best), 32 * u, 68 * u, {
    font: font(24 * u, 700),
    colour: state.best > 0 ? PALETTE.white : PALETTE.dimmer,
  });
  caption(ctx, width - 32 * u, 40 * u, `SEED ${state.seed}`, PALETTE.dim, 'right');
  caption(ctx, width - 32 * u, 60 * u, 'PROCEDURAL CANYON', PALETTE.dimmer, 'right');

  caption(ctx, centreX, height - 22 * u, 'CANVAS 2D  ·  PROCEDURAL AUDIO  ·  NO ASSETS', PALETTE.dimmer, 'center', 0.8);
}

export function drawPause(ctx, view, state) {
  const { width, height } = view;
  const u = clamp(height / 720, 0.62, 1.6);
  ctx.fillStyle = 'rgba(3, 4, 10, 0.68)';
  ctx.fillRect(0, 0, width, height);

  const panelW = 420 * u;
  const panelH = 220 * u;
  const x = (width - panelW) / 2;
  const y = (height - panelH) / 2;
  drawPanel(ctx, x, y, panelW, panelH, { borderAlpha: 0.4 });

  neonText(ctx, 'PAUSED', width / 2, y + 62 * u, {
    font: font(38 * u, 700),
    colour: PALETTE.white,
    glowColour: PALETTE.cyan,
    glow: 26,
    align: 'center',
  });
  drawRule(ctx, x + 40 * u, y + 84 * u, x + panelW - 40 * u, PALETTE.dim, 0.4);

  const rows = [
    ['SCORE', groupDigits(state.score)],
    ['SPEED', `${Math.round(state.speed * 0.36)} KM/H`],
    ['MULTIPLIER', state.multiplier.toFixed(2) + 'x'],
  ];
  rows.forEach((row, i) => {
    const rowY = y + 118 * u + i * 24 * u;
    caption(ctx, x + 48 * u, rowY, row[0], PALETTE.dim);
    neonText(ctx, row[1], x + panelW - 48 * u, rowY, {
      font: font(13 * u, 700),
      colour: PALETTE.cyanSoft,
      align: 'right',
    });
  });

  caption(ctx, width / 2, y + panelH - 22 * u, 'P / ESC  RESUME     ·     R  RESTART', PALETTE.white, 'center', 0.85);
}

export function drawGameOver(ctx, view, state) {
  const { width, height } = view;
  const u = clamp(height / 720, 0.62, 1.6);
  const reveal = clamp(state.reveal ?? 1, 0, 1);

  ctx.save();
  ctx.globalAlpha = reveal;

  const scrim = ctx.createRadialGradient(width / 2, height * 0.5, 40, width / 2, height * 0.5, width * 0.72);
  scrim.addColorStop(0, 'rgba(4, 4, 10, 0.62)');
  scrim.addColorStop(1, 'rgba(3, 3, 8, 0.92)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, width, height);

  const panelW = 620 * u;
  const panelH = 396 * u;
  const x = (width - panelW) / 2;
  const y = (height - panelH) / 2;
  drawPanel(ctx, x, y, panelW, panelH, { borderAlpha: 0.36, border: PALETTE.magenta });

  ctx.save();
  tracking(ctx, 6 * u);
  neonText(ctx, 'RUN TERMINATED', width / 2, y + 56 * u, {
    font: font(30 * u, 700),
    colour: PALETTE.magenta,
    glowColour: PALETTE.magenta,
    glow: 26,
    align: 'center',
  });
  ctx.restore();

  caption(ctx, width / 2, y + 84 * u, `CAUSE OF DEATH: ${state.cause}`, PALETTE.white, 'center', 0.9);

  // Final score, large.
  neonText(ctx, groupDigits(state.score), width / 2, y + 160 * u, {
    font: font(64 * u, 700),
    colour: PALETTE.white,
    glowColour: PALETTE.cyan,
    glow: 28,
    align: 'center',
  });
  caption(ctx, width / 2, y + 184 * u, 'FINAL SCORE', PALETTE.dim, 'center');

  drawRule(ctx, x + 44 * u, y + 210 * u, x + panelW - 44 * u, PALETTE.dim, 0.35);

  const columns = [
    ['DISTANCE', state.distanceText],
    ['TOP SPEED', `${state.topSpeed} KM/H`],
    ['RINGS', String(state.rings)],
    ['GATES', String(state.gates)],
    ['BEST MULT', state.bestMultiplier.toFixed(2) + 'x'],
  ];
  const colWidth = (panelW - 88 * u) / columns.length;
  columns.forEach((column, i) => {
    const colX = x + 44 * u + colWidth * i + colWidth / 2;
    caption(ctx, colX, y + 240 * u, column[0], PALETTE.dim, 'center');
    neonText(ctx, column[1], colX, y + 264 * u, {
      font: font(15 * u, 700),
      colour: PALETTE.cyanSoft,
      align: 'center',
    });
  });

  drawRule(ctx, x + 44 * u, y + 292 * u, x + panelW - 44 * u, PALETTE.dim, 0.35);

  if (state.newBest) {
    ctx.save();
    tracking(ctx, 4 * u);
    neonText(ctx, 'NEW BEST RUN', width / 2, y + 324 * u, {
      font: font(18 * u, 700),
      colour: PALETTE.magentaSoft,
      glowColour: PALETTE.magenta,
      glow: 22,
      align: 'center',
    });
    ctx.restore();
  } else {
    caption(ctx, width / 2, y + 324 * u, `BEST RUN  ${groupDigits(state.best)}`, PALETTE.dim, 'center', 0.95);
  }

  const pulse = 0.6 + Math.sin(state.time * 3.6) * 0.3;
  neonText(ctx, 'PRESS R OR CLICK TO RIDE AGAIN', width / 2, y + panelH - 30 * u, {
    font: font(16 * u, 700),
    colour: PALETTE.white,
    glowColour: PALETTE.cyan,
    glow: 22,
    alpha: pulse + 0.25,
    align: 'center',
  });
  ctx.restore();
}

export function drawCountdown(ctx, view, value) {
  const { width, height } = view;
  const u = clamp(height / 720, 0.62, 1.6);
  const alpha = clamp(value, 0, 1);
  ctx.save();
  ctx.globalAlpha = alpha;
  neonText(ctx, 'GO', width / 2, height * 0.52, {
    font: font(64 * u, 700),
    colour: PALETTE.cyan,
    glow: 30,
    align: 'center',
  });
  ctx.restore();
}
