// NEON SLIPSTREAM — boot, fixed-timestep loop and the run state machine.
// One module owns the wiring; the simulation, the drawing and the sound each
// live in their own file.

import { PALETTE, STORAGE_KEY, TUNING } from './config.js';
import { Canyon } from './canyon.js';
import { Bike } from './bike.js';
import { Camera } from './camera.js';
import { Particles } from './particles.js';
import { SceneRenderer } from './renderer.js';
import { Input } from './input.js';
import { Synth } from './audio.js';
import { drawHud, drawMuteBadge } from './hud.js';
import { drawCountdown, drawGameOver, drawPause, drawTitle } from './screens.js';
import { drawScreenTexture } from './overlay.js';
import { randomSeed } from './random.js';
import { clamp, formatDistance } from './util.js';
import { readShotConfig, autopilotSteer } from './shots.js';

const STEP = 1 / 120;
const MAX_FRAME = 0.06;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
const input = new Input(canvas);
const synth = new Synth();
const camera = new Camera();
const particles = new Particles();
const renderer = new SceneRenderer();
const bike = new Bike();

const view = { width: 1280, height: 720, dpr: 1 };

const game = {
  mode: 'title',
  time: 0,
  frozen: false,
  flash: 0,
  seed: 0,
  canyon: null,
  run: emptyRun(0),
  popups: [],
  best: loadBest(),
  muted: false,
  goFlash: 0,
  deadFor: 0,
  shot: readShotConfig(),
};

function emptyRun(seed) {
  return {
    seed,
    score: 0,
    multiplier: 1,
    bestMultiplier: 1,
    rings: 0,
    gates: 0,
    distance: 0,
    topSpeed: 0,
    cause: '—',
    newBest: false,
  };
}

function loadBest() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const value = stored ? Number.parseInt(stored, 10) : 0;
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(Math.floor(value)));
  } catch {
    /* private mode: the best score simply does not persist */
  }
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  view.width = window.innerWidth;
  view.height = window.innerHeight;
  view.dpr = dpr;
  canvas.width = Math.round(view.width * dpr);
  canvas.height = Math.round(view.height * dpr);
  canvas.style.width = `${view.width}px`;
  canvas.style.height = `${view.height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// ---------------------------------------------------------------- run control

function startRun(seed) {
  const runSeed = (seed ?? randomSeed()) >>> 0;
  game.seed = runSeed;
  game.canyon = new Canyon(runSeed);
  game.run = emptyRun(runSeed);
  game.popups = [];
  game.flash = 0;
  bike.reset();
  camera.snapTo(bike);
  particles.clear();
  game.mode = 'playing';
  game.time = 0;
  game.goFlash = 0.9;
  synth.start();
  synth.resume();
}

// The title screen rides the canyon by itself, on a loop, behind the type.
function startAttract(seed) {
  game.seed = (seed ?? randomSeed()) >>> 0;
  game.canyon = new Canyon(game.seed);
  game.run = emptyRun(game.seed);
  game.popups = [];
  bike.reset();
  camera.snapTo(bike);
  particles.clear();
  game.mode = 'title';
}

function endRun() {
  game.mode = 'dead';
  game.deadFor = 0;
  game.run.cause = bike.deathCause ?? 'UNKNOWN';
  const beatBest = game.run.score > game.best;
  if (beatBest) {
    game.best = Math.floor(game.run.score);
    game.run.newBest = true;
    saveBest(game.best);
  }
  game.flash = 0.75;
  synth.silenceEngine();
  synth.crash();
  camera.kick(1.1);
  for (let i = 0; i < 42; i += 1) particles.spawn('debris', bike.x, bike.y, {
    vx: (Math.random() - 0.5) * 900,
    vy: (Math.random() - 0.5) * 700,
  });
  particles.burst('magentaSpark', bike.x, bike.y, 26, 420);
}

// ----------------------------------------------------------------- simulation

function simulate(dt, forcedInput = null) {
  game.time += dt;
  const control = forcedInput ?? { axis: input.axis, brake: input.brake };
  const events = {
    rings: 0,
    gates: 0,
    graze: 0,
    grazeScore: 0,
    crash: null,
    ringBurst: null,
    gateBurst: null,
  };

  bike.update(dt, control, game.canyon, events);
  camera.update(bike, dt);
  particles.update(dt, bike, bike.speed);
  updatePopups(dt);
  game.flash = Math.max(0, game.flash - dt * 2.6);
  game.goFlash = Math.max(0, game.goFlash - dt);

  if (game.mode !== 'title') applyEvents(events, dt);
  else applyAttractEvents(events);

  if (!bike.alive) {
    if (game.mode === 'playing') endRun();
    else if (game.mode === 'title') startAttract(randomSeed());
  }
}

function applyEvents(events, dt) {
  const run = game.run;

  run.score += bike.speed * TUNING.scorePerPixel * dt * run.multiplier;
  run.score += events.grazeScore * run.multiplier;
  run.multiplier = Math.max(1, run.multiplier - TUNING.multiplierDecayPerPixel * bike.speed * dt);
  run.distance = bike.y;
  run.topSpeed = Math.max(run.topSpeed, bike.speed);

  if (events.rings > 0) {
    run.rings += events.rings;
    run.multiplier = Math.min(TUNING.multiplierMax, run.multiplier + TUNING.ringMultiplier * events.rings);
    const gain = Math.round(TUNING.ringScore * run.multiplier);
    run.score += gain;
    synth.ring();
    addPopup(`+${gain}`, 132, 26, PALETTE.cyanSoft);
    if (events.ringBurst) {
      particles.burst('burst', events.ringBurst.x, events.ringBurst.y, 12, 180);
      camera.kick(0.12);
    }
  }

  if (events.gates > 0) {
    run.gates += events.gates;
    run.multiplier = Math.min(TUNING.multiplierMax, run.multiplier + TUNING.gateMultiplier);
    const gain = Math.round(TUNING.gateScore * run.multiplier);
    run.score += gain;
    synth.gate();
    addPopup(`GATE +${gain}`, 150, 8, PALETTE.magentaSoft);
    if (events.gateBurst) particles.burst('gateBurst', events.gateBurst.x, events.gateBurst.y, 16, 260);
    camera.kick(0.3);
  }

  if (events.graze > 0) {
    if (Math.random() < 0.55) {
      const side = bike.x < game.canyon.sample(bike.y).cx ? -1 : 1;
      particles.spawn('spark', bike.x + side * 14, bike.y + 4, {
        vx: side * (120 + Math.random() * 260),
        vy: -bike.speed * (0.05 + Math.random() * 0.12),
      });
    }
    if (Math.random() < 0.06) synth.graze();
  }

  if (events.crash) {
    camera.kick(1.2);
  }

  run.bestMultiplier = Math.max(run.bestMultiplier, run.multiplier);
}

function applyAttractEvents(events) {
  if (events.rings > 0) synth.ui();
  if (events.rings && events.ringBurst) particles.burst('burst', events.ringBurst.x, events.ringBurst.y, 8, 140);
}

function addPopup(text, offsetX, offsetY, colour) {
  game.popups.push({ text, offsetX, offsetY, colour, age: 0, life: 1.1 });
  if (game.popups.length > 8) game.popups.shift();
}

function updatePopups(dt) {
  for (let i = game.popups.length - 1; i >= 0; i -= 1) {
    game.popups[i].age += dt;
    if (game.popups[i].age >= game.popups[i].life) game.popups.splice(i, 1);
  }
}

// -------------------------------------------------------------------- drawing

function speedRatioOf() {
  return clamp((bike.speed - TUNING.startSpeed) / (TUNING.maxSpeed - TUNING.startSpeed), 0, 1);
}

function render() {
  const ratio = speedRatioOf();
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);

  renderer.draw(ctx, view, {
    canyon: game.canyon,
    camera,
    bike,
    particles,
    time: game.time,
    speedRatio: ratio,
    showBike: true,
    wrecked: !bike.alive,
  });

  if (game.flash > 0.01) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255, 240, 250, ${game.flash * 0.5})`;
    ctx.fillRect(0, 0, view.width, view.height);
    ctx.restore();
  }

  drawScreenTexture(ctx, view.width, view.height, game.time);

  if (game.mode === 'playing' || game.mode === 'paused') {
    drawHud(ctx, view, {
      ...hudState(ratio),
      popups: game.popups,
    });
  }
  if (game.mode === 'title') {
    drawTitle(ctx, view, { time: game.time, best: game.best, seed: game.seed });
  }
  if (game.mode === 'paused') {
    drawPause(ctx, view, hudState(ratio));
  }
  if (game.mode === 'playing' && game.goFlash > 0) {
    drawCountdown(ctx, view, Math.min(1, game.goFlash / 0.55));
  }
  if (game.mode === 'dead') {
    drawGameOver(ctx, view, {
      score: game.run.score,
      cause: game.run.cause,
      distanceText: formatDistance(game.run.distance),
      topSpeed: Math.round(game.run.topSpeed * 0.36),
      rings: game.run.rings,
      gates: game.run.gates,
      bestMultiplier: game.run.bestMultiplier,
      best: Math.max(game.best, game.run.score),
      newBest: game.run.newBest,
      time: game.time,
      reveal: Math.min(1, game.deadFor / 0.45),
    });
  }
  if (game.muted) drawMuteBadge(ctx, view, true);
}

function hudState(ratio) {
  return {
    speed: bike.speed,
    speedRatio: ratio,
    score: game.run.score,
    multiplier: game.run.multiplier,
    distance: game.run.distance,
    best: Math.max(game.best, game.run.score),
    rings: game.run.rings,
    gates: game.run.gates,
    seed: game.seed,
    grazeHeat: bike.grazeHeat,
    time: game.time,
  };
}

// --------------------------------------------------------------------- actions

function handleActions(actions) {
  for (const action of actions) {
    // Any key or click is the gesture the browser needs before audio may play.
    synth.resume();
    if (action === 'mute') {
      game.muted = !game.muted;
      synth.setMuted(game.muted);
      continue;
    }

    if (game.mode === 'title') {
      if (action === 'confirm' || action === 'restart') startRun();
      continue;
    }

    if (action === 'pause') {
      if (game.mode === 'playing') {
        game.mode = 'paused';
        synth.silenceEngine();
      } else if (game.mode === 'paused') {
        game.mode = 'playing';
      }
      continue;
    }

    if (action === 'restart') {
      startRun();
      continue;
    }

    if (action === 'confirm') {
      if (game.mode === 'dead') startRun();
      else if (game.mode === 'paused') game.mode = 'playing';
    }
  }
}

// ------------------------------------------------------------------- main loop

let previous = performance.now();
let accumulator = 0;

function frame(now) {
  const delta = Math.min(MAX_FRAME, (now - previous) / 1000);
  previous = now;

  input.update(view.width);
  handleActions(input.takeActions());

  if (!game.frozen) {
    if (game.mode === 'playing') {
      accumulator += delta;
      let guard = 0;
      while (accumulator >= STEP && guard < 12) {
        simulate(STEP);
        accumulator -= STEP;
        guard += 1;
      }
      synth.setEngine(speedRatioOf(), bike.lean);
    } else if (game.mode === 'title') {
      accumulator += delta;
      let guard = 0;
      while (accumulator >= STEP && guard < 12) {
        simulate(STEP, autopilotSteer(bike, game.canyon, game.seed));
        accumulator -= STEP;
        guard += 1;
      }
    } else {
      accumulator = 0;
      game.time += delta * 0.4;
      if (game.mode === 'dead') game.deadFor += delta;
    }
  }

  render();
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ shot mode

// ?shot=title|run|hud|gameover&seed=7&t=12 pre-drives the game so a screenshot
// lands on a specific, reproducible moment. Outside the harness nothing here
// runs: without the query parameter the game starts at the title.
function applyShotMode() {
  const shot = game.shot;
  if (!shot) return;

  if (shot.mode === 'title') {
    startAttract(shot.seed);
    for (let i = 0; i < shot.t / STEP; i += 1) simulate(STEP, autopilotSteer(bike, game.canyon, game.seed));
    game.frozen = true;
    return;
  }

  startRun(shot.seed);
  const limit = shot.mode === 'gameover' ? 400 : shot.t;
  let steps = 0;
  while (steps < limit / STEP) {
    simulate(STEP, autopilotSteer(bike, game.canyon, game.seed));
    steps += 1;
    if (shot.mode === 'gameover' && !bike.alive) break;
  }
  if (shot.mode === 'gameover' && bike.alive) {
    // Force the ending if the autopilot is still riding: aim into the wall.
    const corridor = game.canyon.sample(bike.y);
    const side = bike.x > corridor.cx ? 1 : -1;
    let guard = 0;
    while (bike.alive && guard < 4000) {
      simulate(STEP, { axis: side, brake: false });
      guard += 1;
    }
  }
  if (game.mode === 'dead') game.deadFor = 1;
  game.frozen = true;
}

function boot() {
  resize();
  window.addEventListener('resize', resize);
  startAttract(randomSeed());
  applyShotMode();
  window.__neonSlipstream = { game, bike, camera, canvas, view, simulate, startRun, render };
  if (game.shot) {
    // One warm frame so the harness can screenshot as soon as it is set.
    render();
    window.__neonReady = true;
  }
  requestAnimationFrame((now) => {
    previous = now;
    frame(now);
  });
}

boot();
