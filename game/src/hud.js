// In-run HUD: speed, score, multiplier, distance, best and the two tallies, all
// drawn on the canvas so the readout belongs to the same world as the road.

import { PALETTE } from './config.js';
import { drawRule, neonText } from './neon.js';
import { clamp, formatDistance, formatMultiplier, groupDigits } from './util.js';

const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

function font(size, weight = 700) {
  return `${weight} ${size}px ${MONO}`;
}

export function drawHud(ctx, view, state) {
  const u = clamp(view.height / 720, 0.62, 1.6);
  const pad = 30 * u;
  const { time } = state;

  ctx.save();
  drawSpeedBlock(ctx, pad, pad, u, state);
  drawScoreBlock(ctx, view.width / 2, pad, u, state, time);
  drawBestBlock(ctx, view.width - pad, pad, u, state);
  drawTallies(ctx, pad, view.height - pad, u, state);
  drawHint(ctx, view.width - pad, view.height - pad, u, state);
  drawGrazeHeat(ctx, view, u, state);
  drawPopups(ctx, view, u, state);
  ctx.restore();
}

function drawSpeedBlock(ctx, x, y, u, state) {
  const kph = Math.round(state.speed * 0.36);
  neonText(ctx, 'SPEED', x, y + 10 * u, { font: font(11 * u, 600), colour: PALETTE.dim, align: 'left' });
  neonText(ctx, String(kph), x, y + 52 * u, {
    font: font(46 * u, 700),
    colour: PALETTE.white,
    glowColour: PALETTE.cyan,
    glow: 22,
  });
  neonText(ctx, 'KM/H', x + (String(kph).length * 27 + 12) * u, y + 52 * u, {
    font: font(12 * u, 600),
    colour: PALETTE.cyan,
  });

  // Speed bar with a bright leading edge that grows with the bike.
  const width = 196 * u;
  const barY = y + 66 * u;
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = PALETTE.dimmer;
  ctx.fillRect(x, barY, width, 3 * u);
  ctx.restore();
  const ratio = clamp(state.speedRatio, 0, 1);
  const gradient = ctx.createLinearGradient(x, 0, x + width, 0);
  gradient.addColorStop(0, PALETTE.cyanDeep);
  gradient.addColorStop(0.6, PALETTE.cyan);
  gradient.addColorStop(1, PALETTE.white);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = gradient;
  ctx.globalAlpha = 0.95;
  ctx.fillRect(x, barY, width * ratio, 3 * u);
  ctx.globalAlpha = 0.6;
  for (let i = 1; i < 8; i += 1) {
    ctx.fillStyle = PALETTE.white;
    ctx.fillRect(x + (width * i) / 8, barY - 2 * u, 1, 7 * u);
  }
  ctx.restore();

  if (state.grazeHeat > 0.04) {
    neonText(ctx, 'GRAZE', x, barY + 26 * u, {
      font: font(12 * u, 700),
      colour: PALETTE.cyanSoft,
      alpha: clamp(state.grazeHeat, 0, 1),
      glow: 16,
    });
  }
}

function drawScoreBlock(ctx, centreX, y, u, state, time) {
  const score = groupDigits(state.score);
  neonText(ctx, 'SCORE', centreX, y + 10 * u, {
    font: font(11 * u, 600),
    colour: PALETTE.dim,
    align: 'center',
  });
  neonText(ctx, score, centreX, y + 54 * u, {
    font: font(44 * u, 700),
    colour: PALETTE.white,
    glow: 20,
    align: 'center',
  });

  const multColour = state.multiplier > 4 ? PALETTE.magentaSoft : PALETTE.cyan;
  const pulse = 1 + Math.sin(time * 6) * 0.02 * clamp(state.multiplier - 1, 0, 3);
  ctx.save();
  ctx.translate(centreX, y + 84 * u);
  ctx.scale(pulse, pulse);
  neonText(ctx, formatMultiplier(state.multiplier), 0, 0, {
    font: font(20 * u, 700),
    colour: multColour,
    glow: 18,
    align: 'center',
  });
  ctx.restore();

  // Multiplier meter: how much is left before the chain decays back to 1x.
  const width = 132 * u;
  const fraction = clamp((state.multiplier - 1) / 6, 0, 1);
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = PALETTE.dimmer;
  ctx.fillRect(centreX - width / 2, y + 94 * u, width, 2 * u);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = multColour;
  ctx.fillRect(centreX - width / 2, y + 94 * u, width * fraction, 2 * u);
  ctx.restore();
}

function drawBestBlock(ctx, rightX, y, u, state) {
  neonText(ctx, 'BEST', rightX, y + 10 * u, {
    font: font(11 * u, 600),
    colour: PALETTE.dim,
    align: 'right',
  });
  neonText(ctx, groupDigits(state.best), rightX, y + 34 * u, {
    font: font(19 * u, 700),
    colour: state.score > state.best ? PALETTE.magentaSoft : PALETTE.white,
    align: 'right',
  });
  neonText(ctx, 'DISTANCE', rightX, y + 58 * u, {
    font: font(11 * u, 600),
    colour: PALETTE.dim,
    align: 'right',
  });
  neonText(ctx, formatDistance(state.distance), rightX, y + 82 * u, {
    font: font(19 * u, 700),
    colour: PALETTE.cyanSoft,
    align: 'right',
  });
}

function drawTallies(ctx, x, bottomY, u, state) {
  neonText(ctx, `RINGS ${state.rings}`, x, bottomY - 16 * u, {
    font: font(12 * u, 600),
    colour: PALETTE.cyanSoft,
    alpha: 0.85,
  });
  neonText(ctx, `GATES ${state.gates}`, x + 96 * u, bottomY - 16 * u, {
    font: font(12 * u, 600),
    colour: PALETTE.magentaSoft,
    alpha: 0.85,
  });
  neonText(ctx, `SEED ${state.seed}`, x, bottomY, {
    font: font(10 * u, 600),
    colour: PALETTE.dimmer,
    alpha: 0.9,
  });
}

function drawHint(ctx, rightX, bottomY, u, state) {
  drawRule(ctx, rightX - 300 * u, bottomY - 30 * u, rightX, PALETTE.dimmer, 0.5);
  neonText(ctx, 'A / D  STEER     S  BRAKE     P  PAUSE', rightX, bottomY, {
    font: font(11 * u, 600),
    colour: PALETTE.dim,
    align: 'right',
    alpha: state.time < 12 ? 0.95 : 0.45,
  });
}

// Red-magenta edge glow when the rider is grinding the wall.
function drawGrazeHeat(ctx, view, u, state) {
  const heat = clamp(state.grazeHeat, 0, 1);
  if (heat < 0.05) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const gradient = ctx.createRadialGradient(
    view.width / 2,
    view.height / 2,
    view.width * 0.28,
    view.width / 2,
    view.height / 2,
    view.width * 0.7,
  );
  gradient.addColorStop(0, 'rgba(65, 240, 255, 0)');
  gradient.addColorStop(1, `rgba(65, 240, 255, ${0.16 * heat})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, view.width, view.height);
  ctx.restore();
  void u;
}

// Floating "+220" / "GATE" tags that rise from the rider.
function drawPopups(ctx, view, u, state) {
  if (!state.popups) return;
  for (const popup of state.popups) {
    const age = popup.age / popup.life;
    const alpha = clamp(1 - age, 0, 1);
    const x = view.width / 2 + popup.offsetX;
    const y = view.height * 0.62 - age * 46 * u - popup.offsetY;
    neonText(ctx, popup.text, x, y, {
      font: font(15 * u, 700),
      colour: popup.colour ?? PALETTE.cyanSoft,
      alpha,
      align: 'center',
      glow: 14,
    });
  }
}

export function drawMuteBadge(ctx, view, muted) {
  const u = clamp(view.height / 720, 0.62, 1.6);
  ctx.save();
  ctx.globalAlpha = 0.5;
  neonText(ctx, muted ? 'SOUND OFF (M)' : 'SOUND ON (M)', view.width - 30 * u, view.height / 2, {
    font: font(10 * u, 600),
    colour: PALETTE.dim,
    align: 'right',
  });
  ctx.restore();
}
