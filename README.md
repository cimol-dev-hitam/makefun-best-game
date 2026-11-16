[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/cimol-dev-hitam/makefun-best-game/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/cimol-dev-hitam/makefun-best-game/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

# NEON SLIPSTREAM

An endless hoverbike race down a collapsing neon canyon. The bike never stops
accelerating: the canyon narrows, the chicanes tighten, and the only way to
score is to keep threading the gates and stay off the walls.

Everything here is original and procedural: canvas 2D vector art, a seeded
canyon generator, and a WebAudio synth engine. No images, no audio files, no
web fonts, no libraries, no network requests.

## How to play

You ride a light-trail hoverbike through a procedurally generated canyon. The
throttle is fixed and always climbing, so every second you survive is faster
than the last.

- **Thread the gates.** Each gate is a light barrier across the canyon with one
  opening. Pass through the opening for points and a multiplier boost; hit the
  barrier and the run ends.
- **Collect rings** for score and a multiplier boost. The multiplier decays as
  you travel, so a chain only holds while you keep feeding it.
- **Graze the walls** for sparks, points and a short burst of extra speed. Ride
  too close and the wall ends the run.
- **Brake** when a chicane arrives faster than you can steer it. Speed is score,
  but a wall is nothing.
- Your best run is kept in the browser, so the next run has a number to beat.

## Controls

| Key | Action |
| --- | --- |
| `A` / `D` or `←` / `→` | Steer left and right |
| `S` / `↓` | Brake |
| `Space` / `Enter` / click | Start a run, restart after a crash |
| `P` / `Esc` | Pause and resume |
| `R` | Restart instantly |
| `M` | Mute the synth |
| Mouse | Hold the button to steer toward the pointer |

## Running it

The game is plain static files: no build step, no dependencies.

```bash
node serve.ts          # serves game/ on http://localhost:8080
```

Or serve `game/` with any static file server and open `index.html` in a desktop
browser.

## Layout

```
game/index.html        the page: one canvas and the module entry
game/src/main.js       boot, fixed-timestep loop, run state machine
game/src/canyon.js     seeded canyon generation, gates, rings, corridor sampling
game/src/bike.js       steering, thrust, trail and every collision
game/src/camera.js     lagging follow camera, screen shake, perspective projection
game/src/renderer.js   the scene: walls, cliffs, floor, gates, rings, rider
game/src/particles.js  exhaust, sparks, debris
game/src/hud.js        in-run readouts
game/src/screens.js    title, pause and run summary
game/src/audio.js      procedural WebAudio engine and effects
game/src/input.js      keyboard and mouse
game/src/neon.js       neon stroke and text primitives
game/src/overlay.js    cached screen-space light layers
game/src/config.js     palette and tuning
game/src/util.js       numeric helpers
game/src/random.js     seeded PRNG
game/src/shots.js      reproducible screenshot harness (?shot=)
main.ts                hands the entry in: copies game/ and screenshots/, writes the dossier
```

`main.ts` copies `game/` and `screenshots/` into `/output` and writes
`/output/dossier.json` with `buildDossier`. Outside the grader:
`MAKEFUN_OUTPUT_DIR=out node main.ts`.

## License

MIT.
