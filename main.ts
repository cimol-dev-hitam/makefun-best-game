// NEON SLIPSTREAM — submission program for make.fun's best-game-01.
//
// The game is static: game/index.html plus the ES modules under game/src. This
// program does the handing-in, nothing else. It stages a copy of game/ and
// screenshots/ in the output directory and then writes dossier.json there, the
// canonical summary of the entry that the scorer and the judge read. The dossier
// is produced by the kit's vendored library so the bytes match what the grader
// rebuilds from the staged copy.
//
// Every path is anchored on this file's own directory rather than the process
// working directory, so `node main.ts` behaves the same from inside the repo, from
// a parent directory, or from the grader's sandbox.
//
//   node main.ts                              # writes to /output (the grader)
//   MAKEFUN_OUTPUT_DIR=out node main.ts       # anywhere else

import { cpSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

/** Directory holding this program, and therefore game/ and screenshots/. */
const entry = fileURLToPath(new URL('.', import.meta.url));

/** Where the staged copy goes; the grader mounts it at /output. */
const stage = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/**
 * The scorer's caps, restated so this program fails here — with a readable
 * message — instead of failing the gate later. text_max_bytes is the one that
 * changes the dossier's bytes: 160 KiB of source text, screenshots of 4 files and
 * 256 KiB each, and a game tree of 993 files, 48 MiB and 1000 bytes per path.
 */
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

/** What an entry cannot be handed in without. */
const REQUIRED = [
  { path: join(entry, 'game'), kind: 'directory', what: 'game/' },
  { path: join(entry, 'game', 'index.html'), kind: 'file', what: 'game/index.html' },
  { path: join(entry, 'screenshots'), kind: 'directory', what: 'screenshots/' },
];

/** A short, human-readable state for a path: file, directory, or missing. */
function kindOf(path: string): string {
  try {
    const info = statSync(path);
    return info.isDirectory() ? 'directory' : info.isFile() ? 'file' : 'not a regular file or directory';
  } catch {
    return 'missing';
  }
}

/**
 * Refuse to stage an incomplete entry. Each complaint names the path and what was
 * found, and the process exits 1 without touching the output directory, so a
 * broken run leaves the previous staged copy alone rather than a half-written one.
 */
function checkEntry(): void {
  const problems: string[] = [];
  for (const check of REQUIRED) {
    const found = kindOf(check.path);
    if (found !== check.kind) problems.push(`${check.what}: expected a ${check.kind}, found ${found} (${check.path})`);
  }
  if (problems.length > 0) {
    throw new Error(`incomplete entry, refusing to hand it in:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  }
}

/** Copy the game and its screenshots into the staging directory. */
function stageFiles(): void {
  mkdirSync(stage, { recursive: true });
  cpSync(join(entry, 'game'), join(stage, 'game'), { recursive: true });
  // screenshots/ is created even when empty; checkEntry has already ruled that out,
  // but the copy stays unconditional so the staged tree always has both folders.
  mkdirSync(join(stage, 'screenshots'), { recursive: true });
  cpSync(join(entry, 'screenshots'), join(stage, 'screenshots'), { recursive: true });
}

/** Write the dossier from what was just staged, not from the source tree. */
function writeDossier(): void {
  // buildDossier throws on a tree past a cap or one it cannot read; the caller
  // reports that message as-is, since it already says which limit was hit.
  writeFileSync(join(stage, 'dossier.json'), buildDossier(stage, CAPS));
}

function main(): number {
  try {
    checkEntry();
    stageFiles();
    writeDossier();
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`main.ts: ${message}\n`);
    return 1;
  }
}

process.exitCode = main();
