# Platformer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a classic side-scrolling platformer (enemies, power-ups, blocks, coins, 3 levels) that runs in the browser.

**Architecture:** A pure, deterministic core (`step(state, input)` at a fixed 1/60 s tick, plain-data `GameState`) with thin edges: text-format level parser, keyboard input, canvas renderer with code-defined pixel-art sprites, WebAudio synth. Seams (`InputSource`, `LevelSource`, `SaveStore`) leave room for touch controls, a level editor, and save data.

**Tech Stack:** TypeScript, HTML5 Canvas, Vite, Vitest, yarn. No game engine.

**Spec:** `docs/superpowers/specs/2026-10-06-platformer-design.md`

## Global Constraints

- Package manager is `yarn` only. Never npm/pnpm/bun.
- TypeScript + HTML5 Canvas, no game engine. Vite for dev/build, Vitest for tests.
- Dependency rule: `src/core` imports nothing from `render`, `audio`, `input`, `save`, or `levels`. Edges depend on `core`, never the reverse.
- `GameState` is plain serializable data (no class instances, no functions). `step(state, input)` is deterministic: same state + inputs give the same result. Fixed tick is 1/60 s.
- Logical canvas is 256x224 (16 tiles x 14 tiles of 16 px), scaled up with image smoothing disabled.
- Work on branch `feature/platformer` (already created). TDD: failing test, minimal code, green, commit. Commit after each red-green-refactor cycle. Never change behavior and refactor in the same step.
- Commit messages explain *why*, not *what*. Never add a Claude signature or Co-Authored-By line to commits.
- Run Snyk code scan on new first-party code at the end (Task 14) and fix findings.
- Level text legend: `.` empty, `#` solid, `B` brick, `?` coin block, `M` mushroom block, `g` walker, `k` shell enemy, `c` coin, `P` player start, `F` flag. Exactly one `P` and one `F` per level.

## Coordinates and conventions (used by every task)

- World units are **tiles**. `x` grows right, `y` grows down. A body's `x,y` is its top-left corner. `tiles[row][col]`.
- Tile size on screen is 16 px. Constants are in tiles and seconds; the core multiplies velocities by `DT`.
- In test levels built with `levelText(width, edits, rows = 6)` (Task 4): ground is row 5, the player spawns standing on it at `(col 1, row 4)`, and the flag `F` is at `(col width-1, row 4)`. A block "directly above the player's head" is at row 3. Edits are `[col, row, glyph]` and are applied last.

## File Structure

```
package.json, tsconfig.json, vite.config.ts, index.html, .gitignore, .yarnrc.yml
src/main.ts                     loop wiring (Task 13)
src/core/constants.ts           all tuning numbers
src/core/types.ts               shared types (Tile, Level, GameState, ...)
src/core/events.ts              emit()
src/core/physics.ts             solidAt, moveBody, overlaps
src/core/state.ts               createGame, loadLevel, resetGame
src/core/game.ts                step() and phase handling, camera
src/core/player.ts              updatePlayer
src/core/growth.ts              growPlayer, shrinkPlayer
src/core/enemies.ts             updateEnemies
src/core/combat.ts              stomp/hurt/kick/kill, resolveShellHits
src/core/blocks.ts              hitBlock, addCoin
src/core/mushrooms.ts           makeMushroom, updateMushrooms, collectMushrooms
src/core/pickups.ts             collectCoins
src/core/goal.ts                checkGoal, stepLevelClear
src/levels/format.ts            parseLevel, serializeLevel
src/levels/source.ts            LevelSource, fromLevels
src/levels/builder.ts           LevelBuilder (authoring helper that emits level text)
src/levels/builtin.ts           the 3 built-in levels
src/input/keyboard.ts           InputSource, createKeyboardInput
src/save/store.ts               SaveData, SaveStore, memory store, recordProgress
src/render/spriteData.ts        pixel-art grids + palette (pure data)
src/render/sprites.ts           bakeSprites -> offscreen canvases
src/render/renderer.ts          render(ctx, state, sheet)
src/audio/synth.ts              createAudio
src/testing/level-text.ts       levelText, span (test helpers, no core imports)
src/testing/helpers.ts          playing, tick, collect, NONE
src/testing/bot.ts              createBot (replay-test player)
```

Tests are colocated: `foo.ts` -> `foo.test.ts`.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`, `.yarnrc.yml`
- Create: `src/main.ts` (stub), `src/core/constants.ts`
- Test: `src/core/constants.test.ts`

**Interfaces:**
- Produces: `DT` (number, 1/60) exported from `src/core/constants.ts`; scripts `yarn dev`, `yarn test`, `yarn typecheck`, `yarn build`.

- [ ] **Step 1: Write package.json, config files, and install**

`package.json`:
```json
{
  "name": "platformer",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```

`.yarnrc.yml` (harmless on yarn classic; keeps plain `node_modules` on yarn berry):
```yaml
nodeLinker: node-modules
```

`.gitignore`:
```
node_modules
dist
.DS_Store
.worktrees
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "types": []
  },
  "include": ["src"]
}
```

`vite.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['src/**/*.test.ts'] },
});
```
(Use this second version as the file contents.)

Run: `yarn add -D typescript vite vitest`
Expected: installs, creates `yarn.lock`.

- [ ] **Step 2: Write the failing test**

`src/core/constants.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { DT } from './constants';

describe('constants', () => {
  it('simulates at a fixed 60 ticks per second', () => {
    expect(DT).toBeCloseTo(1 / 60);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `yarn test`
Expected: FAIL — cannot resolve `./constants`.

- [ ] **Step 4: Minimal implementation, plus the page shell**

`src/core/constants.ts`:
```ts
export const DT = 1 / 60;
```

`src/main.ts`:
```ts
// Wired up in Task 13.
export {};
```

`index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Platformer</title>
    <style>
      html, body { margin: 0; height: 100%; background: #111; display: flex; align-items: center; justify-content: center; }
      canvas { image-rendering: pixelated; width: min(100vw, calc(100vh * 256 / 224)); aspect-ratio: 256 / 224; }
    </style>
  </head>
  <body>
    <canvas id="game"></canvas>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 5: Run tests and typecheck**

Run: `yarn test && yarn typecheck`
Expected: 1 test passes; typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Scaffold Vite/TypeScript/Vitest project

Establish the toolchain first so every later behavior is driven by a failing test."
```

---

### Task 2: Core types and level text format

**Files:**
- Create: `src/core/types.ts`, `src/levels/format.ts`
- Test: `src/levels/format.test.ts`

**Interfaces:**
- Produces (from `src/core/types.ts`): `Tile`, `Cell`, `Level`, `Input`, `Rect`, `Body`, `Player`, `Enemy`, `Mushroom`, `EventType`, `GameEvent`, `Phase`, `GameState` (exact definitions below).
- Produces (from `src/levels/format.ts`): `parseLevel(text: string): Level`, `serializeLevel(level: Level): string`.

- [ ] **Step 1: Write the types file** (declarations only; nothing to test yet)

`src/core/types.ts`:
```ts
export type Tile = 'empty' | 'solid' | 'brick' | 'coinBlock' | 'mushroomBlock' | 'used';

export interface Cell {
  col: number;
  row: number;
}

export interface Level {
  width: number;
  height: number;
  tiles: Tile[][];
  spawn: Cell;
  flag: Cell;
  walkers: Cell[];
  shells: Cell[];
  coins: Cell[];
}

export interface Input {
  left: boolean;
  right: boolean;
  jump: boolean;
  run: boolean;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Body extends Rect {
  vx: number;
  vy: number;
}

export interface Player extends Body {
  size: 'small' | 'big';
  onGround: boolean;
  jumping: boolean;
  facing: 1 | -1;
  coyote: number;
  jumpBuffer: number;
  invulnerable: number;
}

export interface Enemy extends Body {
  kind: 'walker' | 'shell';
  mode: 'walking' | 'stunned' | 'sliding';
  dir: 1 | -1;
  onGround: boolean;
  awake: boolean;
  cooldown: number;
}

export interface Mushroom extends Body {
  dir: 1 | -1;
  onGround: boolean;
}

export type EventType =
  | 'jump' | 'coin' | 'stomp' | 'kick' | 'sprout' | 'powerup'
  | 'shrink' | 'bump' | 'break' | 'death' | 'flag' | 'oneup';

export interface GameEvent {
  type: EventType;
}

export type Phase = 'title' | 'playing' | 'dying' | 'levelClear' | 'gameOver' | 'won';

export interface GameState {
  phase: Phase;
  levels: Level[];
  levelIndex: number;
  width: number;
  height: number;
  tiles: Tile[][];
  player: Player;
  enemies: Enemy[];
  mushrooms: Mushroom[];
  coinPickups: Cell[];
  flag: Rect;
  cameraX: number;
  score: number;
  coins: number;
  lives: number;
  timeLeft: number;
  phaseTimer: number;
  tick: number;
  prevJump: boolean;
  events: GameEvent[];
}
```

- [ ] **Step 2: Write the failing tests**

`src/levels/format.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { parseLevel, serializeLevel } from './format';

const SAMPLE = `
...c..
..?BM.
.P.gkF
######
`;

describe('parseLevel', () => {
  it('reads size and tiles', () => {
    const level = parseLevel(SAMPLE);
    expect(level.width).toBe(6);
    expect(level.height).toBe(4);
    expect(level.tiles[1][2]).toBe('coinBlock');
    expect(level.tiles[1][3]).toBe('brick');
    expect(level.tiles[1][4]).toBe('mushroomBlock');
    expect(level.tiles[3][0]).toBe('solid');
  });

  it('extracts entities and leaves their cell empty', () => {
    const level = parseLevel(SAMPLE);
    expect(level.spawn).toEqual({ col: 1, row: 2 });
    expect(level.flag).toEqual({ col: 5, row: 2 });
    expect(level.walkers).toEqual([{ col: 3, row: 2 }]);
    expect(level.shells).toEqual([{ col: 4, row: 2 }]);
    expect(level.coins).toEqual([{ col: 3, row: 0 }]);
    expect(level.tiles[2][3]).toBe('empty');
  });

  it('rejects an empty level', () => {
    expect(() => parseLevel('\n\n')).toThrow(/empty/);
  });

  it('rejects ragged rows', () => {
    expect(() => parseLevel('.P.F\n...\n####')).toThrow(/Row 1/);
  });

  it('rejects unknown glyphs', () => {
    expect(() => parseLevel('.Px.F\n#####')).toThrow(/Unknown glyph 'x'/);
  });

  it('requires exactly one start', () => {
    expect(() => parseLevel('....F\n#####')).toThrow(/exactly one P/);
    expect(() => parseLevel('.P.PF\n#####')).toThrow(/exactly one P/);
  });

  it('requires exactly one flag', () => {
    expect(() => parseLevel('.P...\n#####')).toThrow(/exactly one F/);
  });
});

describe('serializeLevel', () => {
  it('round-trips parse -> serialize', () => {
    expect(serializeLevel(parseLevel(SAMPLE))).toBe(SAMPLE.trim());
  });

  it('refuses tiles that have no glyph', () => {
    const level = parseLevel(SAMPLE);
    level.tiles[0][0] = 'used';
    expect(() => serializeLevel(level)).toThrow(/used/);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `yarn vitest run src/levels/format.test.ts`
Expected: FAIL — cannot resolve `./format`.

- [ ] **Step 4: Implement**

`src/levels/format.ts`:
```ts
import type { Cell, Level, Tile } from '../core/types';

const GLYPH_TO_TILE: Record<string, Tile> = {
  '.': 'empty',
  '#': 'solid',
  B: 'brick',
  '?': 'coinBlock',
  M: 'mushroomBlock',
};

const TILE_TO_GLYPH: Partial<Record<Tile, string>> = {
  empty: '.',
  solid: '#',
  brick: 'B',
  coinBlock: '?',
  mushroomBlock: 'M',
};

export function parseLevel(text: string): Level {
  const rows = text
    .split('\n')
    .map((row) => row.trimEnd())
    .filter((row) => row.length > 0);
  if (rows.length === 0) throw new Error('Level is empty');

  const width = rows[0].length;
  const level: Level = {
    width,
    height: rows.length,
    tiles: [],
    spawn: { col: -1, row: -1 },
    flag: { col: -1, row: -1 },
    walkers: [],
    shells: [],
    coins: [],
  };
  let starts = 0;
  let flags = 0;

  rows.forEach((line, row) => {
    if (line.length !== width) {
      throw new Error(`Row ${row} has width ${line.length}, expected ${width}`);
    }
    const tileRow: Tile[] = [];
    [...line].forEach((glyph, col) => {
      const cell: Cell = { col, row };
      switch (glyph) {
        case 'P': level.spawn = cell; starts += 1; tileRow.push('empty'); return;
        case 'F': level.flag = cell; flags += 1; tileRow.push('empty'); return;
        case 'g': level.walkers.push(cell); tileRow.push('empty'); return;
        case 'k': level.shells.push(cell); tileRow.push('empty'); return;
        case 'c': level.coins.push(cell); tileRow.push('empty'); return;
      }
      const tile = GLYPH_TO_TILE[glyph];
      if (tile === undefined) {
        throw new Error(`Unknown glyph '${glyph}' at row ${row}, col ${col}`);
      }
      tileRow.push(tile);
    });
    level.tiles.push(tileRow);
  });

  if (starts !== 1) throw new Error(`Level needs exactly one P (found ${starts})`);
  if (flags !== 1) throw new Error(`Level needs exactly one F (found ${flags})`);
  return level;
}

export function serializeLevel(level: Level): string {
  const grid = level.tiles.map((row) =>
    row.map((tile) => {
      const glyph = TILE_TO_GLYPH[tile];
      if (glyph === undefined) throw new Error(`Tile '${tile}' has no level glyph`);
      return glyph;
    }),
  );
  const put = (cell: Cell, glyph: string) => {
    grid[cell.row][cell.col] = glyph;
  };
  put(level.spawn, 'P');
  put(level.flag, 'F');
  level.walkers.forEach((cell) => put(cell, 'g'));
  level.shells.forEach((cell) => put(cell, 'k'));
  level.coins.forEach((cell) => put(cell, 'c'));
  return grid.map((row) => row.join('')).join('\n');
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `yarn vitest run src/levels/format.test.ts && yarn typecheck`
Expected: all pass; typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/core/types.ts src/levels
git commit -m "Add shared types and the text level format

Levels as plain text keep authoring easy and give a future editor a round-trippable format."
```

---

### Task 3: Constants, physics, and game-state construction

**Files:**
- Modify: `src/core/constants.ts` (replace contents)
- Create: `src/core/physics.ts`, `src/core/state.ts`, `src/testing/level-text.ts`
- Test: `src/core/physics.test.ts`, `src/core/state.test.ts`

**Interfaces:**
- Consumes: types from Task 2; `parseLevel`.
- Produces:
  - `src/core/physics.ts`: `solidAt(tiles: Tile[][], col: number, row: number): boolean`; `moveBody(b: Body, tiles: Tile[][]): MoveResult`; `interface MoveResult { hitX: boolean; landed: boolean; bonk: Cell | null }`; `overlaps(a: Rect, b: Rect): boolean`.
  - `src/core/state.ts`: `createGame(levels: Level[]): GameState` (phase `'title'`); `loadLevel(s: GameState, index: number, size: Player['size']): void`; `resetGame(s: GameState): void`.
  - `src/testing/level-text.ts`: `levelText(width, edits?, rows?)`, `span(from, to, row, glyph)`, `type Edit`.

- [ ] **Step 1: Replace constants**

`src/core/constants.ts`:
```ts
export const DT = 1 / 60;
export const VIEW_TILES_W = 16;

export const GRAVITY = 55;
export const MAX_FALL = 20;
export const JUMP_VELOCITY = 19;
export const JUMP_CUT_VELOCITY = 5;
export const WALK_SPEED = 5;
export const RUN_SPEED = 8;
export const ACCEL = 25;
export const FRICTION = 30;
export const COYOTE_TIME = 0.1;
export const JUMP_BUFFER_TIME = 0.1;
export const INVULN_TIME = 2;
export const PLAYER_W = 0.75;

export const STOMP_BOUNCE = 10;
export const STOMP_DEPTH = 0.5;
export const KICK_GRACE = 0.25;
export const WALKER_SPEED = 2;
export const SHELL_SLIDE_SPEED = 9;
export const MUSHROOM_SPEED = 2.5;

export const DEATH_TIME = 1.5;
export const DEATH_HOP = 12;
export const LEVEL_CLEAR_TIME = 2;
export const START_LIVES = 3;
export const START_TIME = 300;

export const POINTS = {
  coin: 100,
  stomp: 200,
  shellKill: 100,
  mushroom: 1000,
  brick: 50,
  timeBonus: 10,
};
```

- [ ] **Step 2: Write test-level helper** (support code used by tests; no behavior of its own)

`src/testing/level-text.ts`:
```ts
export type Edit = [col: number, row: number, glyph: string];

/**
 * Builds level text: `rows` rows (default 6), ground on the last row,
 * `P` at (1, rows-2), `F` at (width-1, rows-2). Edits are applied last.
 */
export function levelText(width: number, edits: Edit[] = [], rows = 6): string {
  const grid = Array.from({ length: rows }, () => Array<string>(width).fill('.'));
  grid[rows - 1].fill('#');
  grid[rows - 2][1] = 'P';
  grid[rows - 2][width - 1] = 'F';
  for (const [col, row, glyph] of edits) grid[row][col] = glyph;
  return grid.map((row) => row.join('')).join('\n');
}

/** Edits that set glyph on cols from..to (inclusive) of one row. */
export function span(from: number, to: number, row: number, glyph: string): Edit[] {
  return Array.from({ length: to - from + 1 }, (_, i): Edit => [from + i, row, glyph]);
}
```

- [ ] **Step 3: Write the failing physics tests**

`src/core/physics.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { parseLevel } from '../levels/format';
import { levelText } from '../testing/level-text';
import { moveBody, overlaps, solidAt } from './physics';
import type { Body } from './types';

const tilesOf = (text: string) => parseLevel(text).tiles;
const body = (o: Partial<Body>): Body => ({ x: 0, y: 0, w: 0.75, h: 1, vx: 0, vy: 0, ...o });

describe('solidAt', () => {
  const tiles = tilesOf(levelText(10));
  it('treats ground as solid and air as empty', () => {
    expect(solidAt(tiles, 3, 5)).toBe(true);
    expect(solidAt(tiles, 3, 4)).toBe(false);
  });
  it('treats the left and right world edges as walls', () => {
    expect(solidAt(tiles, -1, 0)).toBe(true);
    expect(solidAt(tiles, 10, 0)).toBe(true);
  });
  it('treats above and below the world as open', () => {
    expect(solidAt(tiles, 3, -1)).toBe(false);
    expect(solidAt(tiles, 3, 6)).toBe(false);
  });
});

describe('moveBody', () => {
  it('lands on the ground and snaps flush to it', () => {
    const tiles = tilesOf(levelText(10));
    const b = body({ x: 3, y: 3, vy: 12 });
    let landed = false;
    for (let i = 0; i < 60 && !landed; i++) landed = moveBody(b, tiles).landed;
    expect(landed).toBe(true);
    expect(b.y).toBeCloseTo(4);
    expect(b.vy).toBe(0);
  });

  it('reports landing when resting with a small downward velocity', () => {
    const tiles = tilesOf(levelText(10));
    const b = body({ x: 3, y: 4, vy: 0.9 });
    expect(moveBody(b, tiles).landed).toBe(true);
    expect(b.y).toBeCloseTo(4);
  });

  it('stops against a wall on the right', () => {
    const tiles = tilesOf(levelText(10, [[6, 4, '#']]));
    const b = body({ x: 4, y: 4 });
    let hit = false;
    for (let i = 0; i < 20; i++) {
      b.vx = 8;
      hit ||= moveBody(b, tiles).hitX;
    }
    expect(hit).toBe(true);
    expect(b.x).toBeCloseTo(6 - 0.75);
  });

  it('stops against a wall on the left', () => {
    const tiles = tilesOf(levelText(10, [[2, 4, '#']]));
    const b = body({ x: 4, y: 4 });
    let hit = false;
    for (let i = 0; i < 20; i++) {
      b.vx = -8;
      hit ||= moveBody(b, tiles).hitX;
    }
    expect(hit).toBe(true);
    expect(b.x).toBeCloseTo(3);
  });

  it('bonks its head on a block and reports which one', () => {
    const tiles = tilesOf(levelText(10, [[5, 3, '#']]));
    const b = body({ x: 5.1, y: 4, vy: -10 });
    const result = moveBody(b, tiles);
    expect(result.bonk).toEqual({ col: 5, row: 3 });
    expect(b.y).toBeCloseTo(4);
    expect(b.vy).toBe(0);
  });

  it('picks the block nearest the body center when straddling two', () => {
    const tiles = tilesOf(levelText(10, [[5, 3, '#'], [6, 3, '#']]));
    const b = body({ x: 5.6, y: 4, vy: -10 });
    expect(moveBody(b, tiles).bonk).toEqual({ col: 5, row: 3 });
  });
});

describe('overlaps', () => {
  it('detects intersecting rects and ignores touching edges', () => {
    const a = { x: 0, y: 0, w: 1, h: 1 };
    expect(overlaps(a, { x: 0.5, y: 0.5, w: 1, h: 1 })).toBe(true);
    expect(overlaps(a, { x: 1, y: 0, w: 1, h: 1 })).toBe(false);
  });
});
```

- [ ] **Step 4: Run to verify failure**

Run: `yarn vitest run src/core/physics.test.ts`
Expected: FAIL — cannot resolve `./physics`.

- [ ] **Step 5: Implement physics**

`src/core/physics.ts`:
```ts
import { DT } from './constants';
import type { Body, Cell, Rect, Tile } from './types';

const EPS = 1e-6;

export interface MoveResult {
  hitX: boolean;
  landed: boolean;
  bonk: Cell | null;
}

export function solidAt(tiles: Tile[][], col: number, row: number): boolean {
  if (col < 0 || col >= tiles[0].length) return true;
  if (row < 0 || row >= tiles.length) return false;
  return tiles[row][col] !== 'empty';
}

function overlapsSolid(b: Body, tiles: Tile[][]): boolean {
  for (let row = Math.floor(b.y); row <= Math.floor(b.y + b.h - EPS); row++) {
    for (let col = Math.floor(b.x); col <= Math.floor(b.x + b.w - EPS); col++) {
      if (solidAt(tiles, col, row)) return true;
    }
  }
  return false;
}

function bonkedCell(b: Body, tiles: Tile[][]): Cell | null {
  const row = Math.floor(b.y);
  const center = b.x + b.w / 2;
  let best: Cell | null = null;
  let bestDistance = Infinity;
  for (let col = Math.floor(b.x); col <= Math.floor(b.x + b.w - EPS); col++) {
    if (!solidAt(tiles, col, row)) continue;
    const distance = Math.abs(col + 0.5 - center);
    if (distance < bestDistance) {
      best = { col, row };
      bestDistance = distance;
    }
  }
  return best;
}

/** Moves one tick: X axis first, then Y. Mutates the body. */
export function moveBody(b: Body, tiles: Tile[][]): MoveResult {
  const result: MoveResult = { hitX: false, landed: false, bonk: null };

  b.x += b.vx * DT;
  if (b.vx !== 0 && overlapsSolid(b, tiles)) {
    b.x = b.vx > 0 ? Math.floor(b.x + b.w - EPS) - b.w : Math.floor(b.x) + 1;
    b.vx = 0;
    result.hitX = true;
  }

  b.y += b.vy * DT;
  if (b.vy !== 0 && overlapsSolid(b, tiles)) {
    if (b.vy > 0) {
      b.y = Math.floor(b.y + b.h - EPS) - b.h;
      result.landed = true;
    } else {
      result.bonk = bonkedCell(b, tiles);
      b.y = Math.floor(b.y) + 1;
    }
    b.vy = 0;
  }
  return result;
}

export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
```

- [ ] **Step 6: Run physics tests**

Run: `yarn vitest run src/core/physics.test.ts`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/core/constants.ts src/core/physics.ts src/core/physics.test.ts src/testing/level-text.ts
git commit -m "Add tile collision physics

Axis-separated AABB resolution is the foundation every mover (player, enemies, mushrooms) shares."
```

- [ ] **Step 8: Write the failing state tests**

`src/core/state.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { parseLevel } from '../levels/format';
import { levelText } from '../testing/level-text';
import { START_LIVES } from './constants';
import { createGame, loadLevel, resetGame } from './state';

const level = (edits: Parameters<typeof levelText>[1] = []) => parseLevel(levelText(20, edits));

describe('createGame', () => {
  it('starts on the title screen with fresh counters', () => {
    const s = createGame([level()]);
    expect(s.phase).toBe('title');
    expect(s.lives).toBe(START_LIVES);
    expect(s.score).toBe(0);
    expect(s.coins).toBe(0);
    expect(s.levelIndex).toBe(0);
  });

  it('places the player standing on the spawn cell', () => {
    const s = createGame([level()]);
    expect(s.player.size).toBe('small');
    expect(s.player.y + s.player.h).toBeCloseTo(5);
    expect(s.player.x).toBeGreaterThan(1);
    expect(s.player.x + s.player.w).toBeLessThan(2);
  });

  it('spawns enemies and coins from the level', () => {
    const s = createGame([level([[8, 4, 'g'], [10, 4, 'k'], [12, 3, 'c']])]);
    expect(s.enemies.map((e) => e.kind)).toEqual(['walker', 'shell']);
    expect(s.coinPickups).toEqual([{ col: 12, row: 3 }]);
  });

  it('builds the flag pole from the flag cell down to the ground', () => {
    const s = createGame([level()]);
    expect(s.flag.y).toBe(4);
    expect(s.flag.h).toBe(1);
    expect(s.flag.x).toBeCloseTo(19.35);
  });

  it('copies tiles so play never mutates the level definition', () => {
    const lvl = level([[5, 3, '?']]);
    const s = createGame([lvl]);
    s.tiles[3][5] = 'used';
    expect(lvl.tiles[3][5]).toBe('coinBlock');
  });
});

describe('loadLevel', () => {
  it('keeps a big player big and sizes the body to match', () => {
    const s = createGame([level(), level()]);
    loadLevel(s, 1, 'big');
    expect(s.levelIndex).toBe(1);
    expect(s.player.size).toBe('big');
    expect(s.player.h).toBe(2);
    expect(s.player.y + s.player.h).toBeCloseTo(5);
  });
});

describe('resetGame', () => {
  it('returns to a fresh title state', () => {
    const s = createGame([level(), level()]);
    Object.assign(s, { phase: 'gameOver', score: 900, coins: 4, lives: 0, levelIndex: 1 });
    resetGame(s);
    expect(s).toMatchObject({ phase: 'title', score: 0, coins: 0, lives: START_LIVES, levelIndex: 0 });
  });
});
```

- [ ] **Step 9: Run to verify failure**

Run: `yarn vitest run src/core/state.test.ts`
Expected: FAIL — cannot resolve `./state`.

- [ ] **Step 10: Implement state**

`src/core/state.ts`:
```ts
import { PLAYER_W, START_LIVES, START_TIME, WALKER_SPEED } from './constants';
import type { Cell, Enemy, GameState, Level, Player, Rect } from './types';

function makePlayer(spawn: Cell, size: Player['size']): Player {
  const h = size === 'big' ? 2 : 1;
  return {
    x: spawn.col + (1 - PLAYER_W) / 2,
    y: spawn.row + 1 - h,
    w: PLAYER_W,
    h,
    vx: 0,
    vy: 0,
    size,
    onGround: false,
    jumping: false,
    facing: 1,
    coyote: 0,
    jumpBuffer: 0,
    invulnerable: 0,
  };
}

function makeEnemy(cell: Cell, kind: Enemy['kind']): Enemy {
  return {
    x: cell.col + 0.1,
    y: cell.row + 0.2,
    w: 0.8,
    h: 0.8,
    vx: -WALKER_SPEED,
    vy: 0,
    kind,
    mode: 'walking',
    dir: -1,
    onGround: false,
    awake: false,
    cooldown: 0,
  };
}

function makeFlag(level: Level): Rect {
  let bottom = level.flag.row;
  while (bottom < level.height && level.tiles[bottom][level.flag.col] === 'empty') bottom += 1;
  return { x: level.flag.col + 0.35, y: level.flag.row, w: 0.3, h: bottom - level.flag.row };
}

export function loadLevel(s: GameState, index: number, size: Player['size']): void {
  const level = s.levels[index];
  s.levelIndex = index;
  s.width = level.width;
  s.height = level.height;
  s.tiles = level.tiles.map((row) => [...row]);
  s.player = makePlayer(level.spawn, size);
  s.enemies = [
    ...level.walkers.map((cell) => makeEnemy(cell, 'walker')),
    ...level.shells.map((cell) => makeEnemy(cell, 'shell')),
  ];
  s.mushrooms = [];
  s.coinPickups = level.coins.map((cell) => ({ ...cell }));
  s.flag = makeFlag(level);
  s.cameraX = 0;
  s.timeLeft = START_TIME;
}

export function createGame(levels: Level[]): GameState {
  const state: GameState = {
    phase: 'title',
    levels,
    levelIndex: 0,
    width: 0,
    height: 0,
    tiles: [],
    player: makePlayer({ col: 0, row: 0 }, 'small'),
    enemies: [],
    mushrooms: [],
    coinPickups: [],
    flag: { x: 0, y: 0, w: 0, h: 0 },
    cameraX: 0,
    score: 0,
    coins: 0,
    lives: START_LIVES,
    timeLeft: START_TIME,
    phaseTimer: 0,
    tick: 0,
    prevJump: false,
    events: [],
  };
  loadLevel(state, 0, 'small');
  return state;
}

export function resetGame(s: GameState): void {
  s.score = 0;
  s.coins = 0;
  s.lives = START_LIVES;
  loadLevel(s, 0, 'small');
  s.phase = 'title';
}
```

- [ ] **Step 11: Run all tests and typecheck**

Run: `yarn test && yarn typecheck`
Expected: all pass; typecheck clean.

- [ ] **Step 12: Commit**

```bash
git add src/core/state.ts src/core/state.test.ts
git commit -m "Add game state construction and level loading

A single loadLevel path serves start, respawn and level progression, so they cannot drift apart."
```

---

### Task 4: Step loop, player movement, camera

**Files:**
- Create: `src/core/events.ts`, `src/core/game.ts`, `src/core/player.ts`, `src/testing/helpers.ts`
- Test: `src/core/player.test.ts`, `src/core/game.test.ts`

**Interfaces:**
- Consumes: Task 2/3 exports.
- Produces:
  - `src/core/events.ts`: `emit(s: GameState, type: EventType): void`.
  - `src/core/player.ts`: `updatePlayer(s: GameState, input: Input): void`.
  - `src/core/game.ts`: `step(s: GameState, input: Input): GameState` (mutates and returns `s`).
  - `src/testing/helpers.ts`: re-exports `levelText`, `span`; `NONE: Input`; `playing(...texts: string[]): GameState` (phase `'playing'`); `tick(s, input?: Partial<Input>, n?: number): GameState`; `collect(s, input?: Partial<Input>, n?: number): EventType[]` (all events across n ticks); `eventTypes(s): EventType[]` (events of the last tick).

- [ ] **Step 1: Write the test helpers** (support code)

`src/testing/helpers.ts`:
```ts
import { step } from '../core/game';
import { createGame } from '../core/state';
import type { EventType, GameState, Input } from '../core/types';
import { parseLevel } from '../levels/format';

export { levelText, span } from './level-text';

export const NONE: Input = { left: false, right: false, jump: false, run: false };

/** A game already in the `playing` phase on the given level texts. */
export function playing(...texts: string[]): GameState {
  const s = createGame(texts.map(parseLevel));
  s.phase = 'playing';
  return s;
}

export function tick(s: GameState, input: Partial<Input> = {}, n = 1): GameState {
  for (let i = 0; i < n; i++) step(s, { ...NONE, ...input });
  return s;
}

/** Runs n ticks and returns every event emitted along the way. */
export function collect(s: GameState, input: Partial<Input> = {}, n = 1): EventType[] {
  const seen: EventType[] = [];
  for (let i = 0; i < n; i++) {
    step(s, { ...NONE, ...input });
    seen.push(...s.events.map((e) => e.type));
  }
  return seen;
}

export function eventTypes(s: GameState): EventType[] {
  return s.events.map((e) => e.type);
}
```

- [ ] **Step 2: Write the failing player tests**

`src/core/player.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { collect, levelText, NONE, playing, span, tick } from '../testing/helpers';
import { step } from './game';
import { COYOTE_TIME, RUN_SPEED, WALK_SPEED } from './constants';

const FLAT = levelText(30);
const LEDGE = levelText(30, span(5, 29, 5, '.')); // ground only on cols 0-4

describe('player movement', () => {
  it('rests on the ground', () => {
    const s = playing(FLAT);
    tick(s, {}, 5);
    expect(s.player.onGround).toBe(true);
    expect(s.player.y).toBeCloseTo(4);
  });

  it('accelerates toward walking speed', () => {
    const s = playing(FLAT);
    tick(s, { right: true }, 10);
    expect(s.player.vx).toBeGreaterThan(0);
    expect(s.player.vx).toBeLessThan(WALK_SPEED);
    tick(s, { right: true }, 60);
    expect(s.player.vx).toBeCloseTo(WALK_SPEED);
  });

  it('runs faster while the run button is held', () => {
    const s = playing(FLAT);
    tick(s, { right: true, run: true }, 60);
    expect(s.player.vx).toBeCloseTo(RUN_SPEED);
  });

  it('slows to a stop when input is released', () => {
    const s = playing(FLAT);
    tick(s, { right: true }, 60);
    tick(s, {}, 60);
    expect(s.player.vx).toBe(0);
  });
});

describe('player jumping', () => {
  it('jumps and announces it', () => {
    const s = playing(FLAT);
    tick(s, {}, 5);
    step(s, { ...NONE, jump: true });
    expect(s.player.vy).toBeLessThan(0);
    expect(s.player.onGround).toBe(false);
    expect(s.events).toEqual([{ type: 'jump' }]);
  });

  it('lands again after a jump', () => {
    const s = playing(FLAT);
    tick(s, {}, 5);
    tick(s, { jump: true }, 1);
    tick(s, {}, 120);
    expect(s.player.onGround).toBe(true);
    expect(s.player.y).toBeCloseTo(4);
  });

  it('does not jump again while the button stays held', () => {
    const s = playing(FLAT);
    tick(s, {}, 5);
    tick(s, { jump: true }, 1);
    tick(s, {}, 120); // land
    expect(collect(s, { jump: true }, 30)).toEqual(['jump']);
  });

  it('jumps higher the longer the button is held', () => {
    const apex = (holdTicks: number) => {
      const s = playing(FLAT);
      tick(s, {}, 5);
      let top = s.player.y;
      for (let i = 0; i < 100; i++) {
        step(s, { ...NONE, jump: i < holdTicks });
        top = Math.min(top, s.player.y);
      }
      return 4 - top;
    };
    expect(apex(40)).toBeGreaterThan(apex(2) + 1);
  });

  it('allows a jump shortly after walking off a ledge (coyote time)', () => {
    const s = playing(LEDGE);
    tick(s, {}, 3);
    for (let i = 0; i < 200 && s.player.onGround; i++) tick(s, { right: true });
    expect(s.player.onGround).toBe(false);
    tick(s, { right: true, jump: true });
    expect(s.player.vy).toBeLessThan(0);
  });

  it('refuses a jump once coyote time has run out', () => {
    const s = playing(LEDGE);
    tick(s, {}, 3);
    for (let i = 0; i < 200 && s.player.onGround; i++) tick(s, { right: true });
    tick(s, { right: true }, Math.ceil((COYOTE_TIME / (1 / 60)) * 2));
    expect(collect(s, { right: true, jump: true }, 1)).not.toContain('jump');
  });

  it('remembers a jump pressed just before landing (jump buffer)', () => {
    const s = playing(FLAT);
    tick(s, {}, 3);
    Object.assign(s.player, { y: 3.7, vy: 5, onGround: false, coyote: 0 });
    const events = [...collect(s, { jump: true }, 1), ...collect(s, {}, 8)];
    expect(events).toContain('jump');
  });
});
```

- [ ] **Step 3: Write the failing game tests**

`src/core/game.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { parseLevel } from '../levels/format';
import { collect, levelText, NONE, playing, tick } from '../testing/helpers';
import { step } from './game';
import { createGame } from './state';

describe('step: title screen', () => {
  it('starts play when jump is pressed', () => {
    const s = createGame([parseLevel(levelText(30))]);
    expect(s.phase).toBe('title');
    step(s, NONE);
    expect(s.phase).toBe('title');
    step(s, { ...NONE, jump: true });
    expect(s.phase).toBe('playing');
  });

  it('does not turn the same held press into a jump', () => {
    const s = createGame([parseLevel(levelText(30))]);
    step(s, { ...NONE, jump: true });
    expect(collect(s, { jump: true }, 5)).not.toContain('jump'); // still the same held press
  });
});

describe('step: events', () => {
  it('clears last tick\'s events at the start of each tick', () => {
    const s = playing(levelText(30));
    tick(s, {}, 5);
    tick(s, { jump: true });
    expect(s.events).toHaveLength(1);
    tick(s, { jump: true });
    expect(s.events).toHaveLength(0);
  });
});

describe('camera', () => {
  const WIDE = levelText(60);

  it('follows the player to the right', () => {
    const s = playing(WIDE);
    tick(s, { right: true, run: true }, 120);
    expect(s.cameraX).toBeGreaterThan(0);
    expect(s.cameraX).toBeLessThanOrEqual(60 - 16);
  });

  it('never scrolls backward and walls the player in on the left', () => {
    const s = playing(WIDE);
    tick(s, { right: true, run: true }, 120);
    const before = s.cameraX;
    tick(s, { left: true, run: true }, 120);
    expect(s.cameraX).toBe(before);
    expect(s.player.x).toBeGreaterThanOrEqual(before - 1e-9);
  });

  it('stays at zero on a level narrower than the view', () => {
    const s = playing(levelText(10));
    tick(s, { right: true }, 20);
    expect(s.cameraX).toBe(0);
  });
});
```

- [ ] **Step 4: Run to verify failure**

Run: `yarn vitest run src/core/player.test.ts src/core/game.test.ts`
Expected: FAIL — cannot resolve `./game` / `../testing/helpers`.

- [ ] **Step 5: Implement events, player, and the step loop**

`src/core/events.ts`:
```ts
import type { EventType, GameState } from './types';

export function emit(s: GameState, type: EventType): void {
  s.events.push({ type });
}
```

`src/core/player.ts`:
```ts
import {
  ACCEL,
  COYOTE_TIME,
  DT,
  FRICTION,
  GRAVITY,
  JUMP_BUFFER_TIME,
  JUMP_CUT_VELOCITY,
  JUMP_VELOCITY,
  MAX_FALL,
  RUN_SPEED,
  WALK_SPEED,
} from './constants';
import { emit } from './events';
import { moveBody } from './physics';
import type { GameState, Input } from './types';

function approach(value: number, target: number, delta: number): number {
  return value < target ? Math.min(value + delta, target) : Math.max(value - delta, target);
}

export function updatePlayer(s: GameState, input: Input): void {
  const p = s.player;
  const jumpPressed = input.jump && !s.prevJump;

  p.coyote = p.onGround ? COYOTE_TIME : Math.max(0, p.coyote - DT);
  p.jumpBuffer = jumpPressed ? JUMP_BUFFER_TIME : Math.max(0, p.jumpBuffer - DT);
  p.invulnerable = Math.max(0, p.invulnerable - DT);

  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (dir !== 0) {
    p.facing = dir as 1 | -1;
    const turning = p.vx !== 0 && Math.sign(p.vx) !== dir;
    const max = input.run ? RUN_SPEED : WALK_SPEED;
    p.vx = approach(p.vx, dir * max, (turning ? FRICTION : ACCEL) * DT);
  } else {
    p.vx = approach(p.vx, 0, FRICTION * DT);
  }

  if (p.jumpBuffer > 0 && p.coyote > 0) {
    p.vy = -JUMP_VELOCITY;
    p.jumpBuffer = 0;
    p.coyote = 0;
    p.onGround = false;
    p.jumping = true;
    emit(s, 'jump');
  }
  if (p.jumping && !input.jump && p.vy < -JUMP_CUT_VELOCITY) p.vy = -JUMP_CUT_VELOCITY;
  p.vy = Math.min(p.vy + GRAVITY * DT, MAX_FALL);

  const result = moveBody(p, s.tiles);
  p.onGround = result.landed;
  if (result.landed) p.jumping = false;

  if (p.x < s.cameraX) {
    p.x = s.cameraX;
    p.vx = Math.max(0, p.vx);
  }
}
```

`src/core/game.ts`:
```ts
import { DT, VIEW_TILES_W } from './constants';
import { updatePlayer } from './player';
import type { GameState, Input } from './types';

function updateCamera(s: GameState): void {
  const target = s.player.x + s.player.w / 2 - VIEW_TILES_W / 2;
  const max = Math.max(0, s.width - VIEW_TILES_W);
  s.cameraX = Math.min(max, Math.max(s.cameraX, target));
}

function stepPlaying(s: GameState, input: Input): void {
  s.timeLeft = Math.max(0, s.timeLeft - DT);
  updatePlayer(s, input);
  updateCamera(s);
}

/** Advances the simulation by one fixed tick. Mutates and returns `s`. */
export function step(s: GameState, input: Input): GameState {
  s.events = [];
  const jumpPressed = input.jump && !s.prevJump;
  switch (s.phase) {
    case 'title':
      if (jumpPressed) s.phase = 'playing';
      break;
    case 'playing':
      stepPlaying(s, input);
      break;
  }
  s.prevJump = input.jump;
  s.tick += 1;
  return s;
}
```

- [ ] **Step 6: Run tests and typecheck**

Run: `yarn test && yarn typecheck`
Expected: all pass.

If "jumps higher the longer the button is held" or the coyote test fails, fix the *test setup*, not the physics, unless the failure shows a genuine bug (re-check the ordering inside `updatePlayer`: timers, horizontal, jump, cut, gravity, move).

- [ ] **Step 7: Commit**

```bash
git add src/core/events.ts src/core/player.ts src/core/game.ts src/core/player.test.ts src/core/game.test.ts src/testing/helpers.ts
git commit -m "Add the fixed-step loop, player movement and camera

Coyote time, jump buffering and variable jump height are what make the platforming forgiving, so they are pinned by tests from the start."
```

---

### Task 5: Walker enemy, stomping, damage, death and respawn

**Files:**
- Create: `src/core/growth.ts`, `src/core/enemies.ts`, `src/core/combat.ts`
- Modify: `src/core/game.ts`
- Test: `src/core/enemies.test.ts`, `src/core/combat.test.ts`

**Interfaces:**
- Consumes: `moveBody`, `overlaps`, `emit`, `loadLevel`, `resetGame`, constants.
- Produces:
  - `src/core/growth.ts`: `growPlayer(p: Player): void`, `shrinkPlayer(p: Player): void` (keep feet position).
  - `src/core/enemies.ts`: `updateEnemies(s: GameState): void`.
  - `src/core/combat.ts`: `resolvePlayerEnemies(s: GameState): void`, `hurtPlayer(s: GameState): void`, `killPlayer(s: GameState): void`.
  - `game.ts`: phases `'dying'` and `'gameOver'` handled.

- [ ] **Step 1: Write failing enemy movement tests**

`src/core/enemies.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { levelText, playing, span, tick } from '../testing/helpers';

describe('walker movement', () => {
  it('turns around at a wall', () => {
    const s = playing(levelText(30, [[10, 4, 'g'], [8, 4, '#']]));
    tick(s, {}, 60);
    expect(s.enemies[0].dir).toBe(1);
    expect(s.enemies[0].x).toBeGreaterThanOrEqual(9);
  });

  it('turns around at a ledge instead of falling', () => {
    const s = playing(levelText(30, [[10, 4, 'g'], ...span(6, 9, 5, '.')]));
    tick(s, {}, 20);
    expect(s.enemies[0].dir).toBe(1);
    expect(s.enemies[0].y).toBeCloseTo(4.2);
    expect(s.enemies[0].x).toBeGreaterThanOrEqual(10);
  });

  it('stays asleep until the camera nears it', () => {
    const s = playing(levelText(60, [[50, 4, 'g']]));
    tick(s, {}, 30);
    expect(s.enemies[0].awake).toBe(false);
    expect(s.enemies[0].x).toBeCloseTo(50.1);
  });

  it('is removed after falling out of the world', () => {
    const s = playing(levelText(30, [[10, 4, 'g'], ...span(8, 14, 5, '.')]));
    s.enemies[0].dir = 1;
    s.enemies[0].x = 12;
    tick(s, {}, 120);
    expect(s.enemies).toHaveLength(0);
  });
});
```
(The last test relies on the walker *not* turning when already past the ledge: it starts mid-gap at x=12, over empty ground, so it simply falls.)

- [ ] **Step 2: Write failing combat tests**

`src/core/combat.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { collect, levelText, playing, span, tick } from '../testing/helpers';
import { DEATH_TIME, INVULN_TIME, START_LIVES } from './constants';
import { growPlayer } from './growth';

const deathTicks = Math.ceil(DEATH_TIME / (1 / 60)) + 2;

function sideHit() {
  const s = playing(levelText(30, [[5, 4, 'g']]));
  tick(s, {}, 3);
  s.player.x = 4.6; // overlapping the walker, standing on the ground
  return s;
}

describe('stomping', () => {
  it('defeats a walker, bounces the player and scores', () => {
    const s = playing(levelText(30, [[5, 4, 'g']]));
    tick(s, {}, 3);
    Object.assign(s.player, { x: 5.2, y: 3, vy: 8, onGround: false, coyote: 0 });
    const events = collect(s, {}, 5);
    expect(s.enemies).toHaveLength(0);
    expect(s.score).toBe(200);
    expect(s.player.vy).toBeLessThan(0);
    expect(events).toContain('stomp');
    expect(s.phase).toBe('playing');
  });
});

describe('taking damage', () => {
  it('kills a small player on a side hit', () => {
    const s = sideHit();
    const events = collect(s, {}, 1);
    expect(s.phase).toBe('dying');
    expect(s.lives).toBe(START_LIVES - 1);
    expect(events).toContain('death');
  });

  it('shrinks a big player and grants brief invulnerability', () => {
    const s = sideHit();
    growPlayer(s.player);
    const events = collect(s, {}, 1);
    expect(s.phase).toBe('playing');
    expect(s.player.size).toBe('small');
    expect(s.player.h).toBe(1);
    expect(s.player.invulnerable).toBeGreaterThan(INVULN_TIME - 0.1);
    expect(events).toContain('shrink');
    tick(s, {}, 10);
    expect(s.phase).toBe('playing');
  });
});

describe('death flow', () => {
  it('respawns at the level start with the enemies reset', () => {
    const s = sideHit();
    tick(s, {}, deathTicks);
    expect(s.phase).toBe('playing');
    expect(s.lives).toBe(START_LIVES - 1);
    expect(s.player.size).toBe('small');
    expect(s.player.x).toBeCloseTo(1.125);
    expect(s.enemies).toHaveLength(1);
    expect(s.enemies[0].x).toBeCloseTo(5.1, 0); // reset, then a tick or two of walking
  });

  it('ends the game when the last life is lost', () => {
    const s = sideHit();
    s.lives = 1;
    tick(s, {}, deathTicks);
    expect(s.phase).toBe('gameOver');
    expect(s.lives).toBe(0);
  });

  it('returns to the title screen from game over on jump', () => {
    const s = playing(levelText(30));
    Object.assign(s, { phase: 'gameOver', score: 500, lives: 0 });
    tick(s, { jump: true });
    expect(s).toMatchObject({ phase: 'title', score: 0, lives: START_LIVES });
  });

  it('kills the player who falls into a pit', () => {
    const s = playing(levelText(30, span(3, 29, 5, '.')));
    for (let i = 0; i < 300 && s.phase === 'playing'; i++) tick(s, { right: true });
    expect(s.phase).toBe('dying');
    expect(s.lives).toBe(START_LIVES - 1);
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `yarn vitest run src/core/enemies.test.ts src/core/combat.test.ts`
Expected: FAIL — modules not found / behaviors missing.

- [ ] **Step 4: Implement growth, enemies, combat**

`src/core/growth.ts`:
```ts
import type { Player } from './types';

/** Both keep the player's feet in place. */
export function growPlayer(p: Player): void {
  if (p.size === 'big') return;
  p.size = 'big';
  p.h = 2;
  p.y -= 1;
}

export function shrinkPlayer(p: Player): void {
  if (p.size === 'small') return;
  p.size = 'small';
  p.h = 1;
  p.y += 1;
}
```

`src/core/enemies.ts`:
```ts
import {
  DT,
  GRAVITY,
  MAX_FALL,
  SHELL_SLIDE_SPEED,
  VIEW_TILES_W,
  WALKER_SPEED,
} from './constants';
import { moveBody, solidAt } from './physics';
import type { Enemy, GameState, Tile } from './types';

function groundAhead(tiles: Tile[][], e: Enemy): boolean {
  const frontX = e.dir > 0 ? e.x + e.w + 0.05 : e.x - 0.05;
  return solidAt(tiles, Math.floor(frontX), Math.floor(e.y + e.h + 0.05));
}

function stepEnemy(s: GameState, e: Enemy): void {
  e.cooldown = Math.max(0, e.cooldown - DT);
  if (e.mode === 'stunned') e.vx = 0;
  else e.vx = e.dir * (e.mode === 'sliding' ? SHELL_SLIDE_SPEED : WALKER_SPEED);
  e.vy = Math.min(e.vy + GRAVITY * DT, MAX_FALL);

  const result = moveBody(e, s.tiles);
  e.onGround = result.landed;
  if (result.hitX) e.dir = -e.dir as 1 | -1;
  else if (e.mode === 'walking' && e.onGround && !groundAhead(s.tiles, e)) {
    e.dir = -e.dir as 1 | -1;
  }
}

export function updateEnemies(s: GameState): void {
  for (const e of s.enemies) {
    if (!e.awake && e.x < s.cameraX + VIEW_TILES_W + 2) e.awake = true;
    if (e.awake) stepEnemy(s, e);
  }
  s.enemies = s.enemies.filter((e) => e.y <= s.height + 2);
}
```

`src/core/combat.ts`:
```ts
import {
  DEATH_HOP,
  DEATH_TIME,
  INVULN_TIME,
  POINTS,
  STOMP_BOUNCE,
  STOMP_DEPTH,
} from './constants';
import { emit } from './events';
import { shrinkPlayer } from './growth';
import { overlaps } from './physics';
import type { Enemy, GameState } from './types';

function stomp(s: GameState, e: Enemy): void {
  s.player.vy = -STOMP_BOUNCE;
  s.score += POINTS.stomp;
  s.enemies = s.enemies.filter((other) => other !== e);
  emit(s, 'stomp');
}

export function killPlayer(s: GameState): void {
  const p = s.player;
  s.phase = 'dying';
  s.phaseTimer = DEATH_TIME;
  s.lives -= 1;
  p.vx = 0;
  p.vy = p.y > s.height ? 0 : -DEATH_HOP;
  emit(s, 'death');
}

export function hurtPlayer(s: GameState): void {
  const p = s.player;
  if (p.size === 'big') {
    shrinkPlayer(p);
    p.invulnerable = INVULN_TIME;
    emit(s, 'shrink');
  } else {
    killPlayer(s);
  }
}

export function resolvePlayerEnemies(s: GameState): void {
  const p = s.player;
  for (const e of [...s.enemies]) {
    if (s.phase !== 'playing') return;
    if (!overlaps(p, e)) continue;
    const stomping = p.vy > 0 && p.y + p.h - e.y < STOMP_DEPTH;
    if (stomping) stomp(s, e);
    else if (e.cooldown === 0 && p.invulnerable === 0) hurtPlayer(s);
  }
}
```

- [ ] **Step 5: Wire into `game.ts`**

Replace `src/core/game.ts` with:
```ts
import { resolvePlayerEnemies, killPlayer } from './combat';
import { DT, GRAVITY, MAX_FALL, VIEW_TILES_W } from './constants';
import { updateEnemies } from './enemies';
import { updatePlayer } from './player';
import { loadLevel, resetGame } from './state';
import type { GameState, Input } from './types';

function updateCamera(s: GameState): void {
  const target = s.player.x + s.player.w / 2 - VIEW_TILES_W / 2;
  const max = Math.max(0, s.width - VIEW_TILES_W);
  s.cameraX = Math.min(max, Math.max(s.cameraX, target));
}

function stepPlaying(s: GameState, input: Input): void {
  s.timeLeft = Math.max(0, s.timeLeft - DT);
  updatePlayer(s, input);
  updateEnemies(s);
  resolvePlayerEnemies(s);
  if (s.phase === 'playing' && s.player.y > s.height) killPlayer(s);
  updateCamera(s);
}

function stepDying(s: GameState): void {
  const p = s.player;
  p.vy = Math.min(p.vy + GRAVITY * DT, MAX_FALL);
  p.y += p.vy * DT;
  s.phaseTimer -= DT;
  if (s.phaseTimer > 0) return;
  if (s.lives <= 0) {
    s.phase = 'gameOver';
  } else {
    loadLevel(s, s.levelIndex, 'small');
    s.phase = 'playing';
  }
}

/** Advances the simulation by one fixed tick. Mutates and returns `s`. */
export function step(s: GameState, input: Input): GameState {
  s.events = [];
  const jumpPressed = input.jump && !s.prevJump;
  switch (s.phase) {
    case 'title':
      if (jumpPressed) s.phase = 'playing';
      break;
    case 'playing':
      stepPlaying(s, input);
      break;
    case 'dying':
      stepDying(s);
      break;
    case 'gameOver':
      if (jumpPressed) resetGame(s);
      break;
  }
  s.prevJump = input.jump;
  s.tick += 1;
  return s;
}
```

- [ ] **Step 6: Run all tests and typecheck**

Run: `yarn test && yarn typecheck`
Expected: all pass (Tasks 1-5).

- [ ] **Step 7: Commit**

```bash
git add src/core
git commit -m "Add walker enemies, stomping, damage and the death flow

Stomp-vs-side-hit is the core risk/reward loop of the genre; death and respawn make it consequential."
```

---

### Task 6: Question blocks and bricks

**Files:**
- Create: `src/core/mushrooms.ts` (only `makeMushroom` for now), `src/core/blocks.ts`
- Modify: `src/core/player.ts`
- Test: `src/core/blocks.test.ts`

**Interfaces:**
- Consumes: `moveBody` result `bonk`, `emit`, `POINTS`.
- Produces:
  - `src/core/mushrooms.ts`: `makeMushroom(col: number, row: number): Mushroom` — spawns on top of the block cell `(col,row)`, moving right.
  - `src/core/blocks.ts`: `addCoin(s: GameState): void` (+100 points, +1 coin, extra life at 100 coins, emits `coin`/`oneup`); `hitBlock(s: GameState, col: number, row: number): void`.

- [ ] **Step 1: Write failing tests**

`src/core/blocks.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { collect, levelText, playing, tick } from '../testing/helpers';
import { addCoin, hitBlock } from './blocks';
import { START_LIVES } from './constants';
import { growPlayer } from './growth';

/** Player directly under a block at (5, blockRow), settled and ready to jump. */
function underBlock(glyph: string, blockRow = 3, big = false) {
  const s = playing(levelText(30, [[5, blockRow, glyph]]));
  tick(s, {}, 3);
  if (big) growPlayer(s.player);
  s.player.x = 5.1;
  tick(s, {}, 3);
  return s;
}

describe('coin block', () => {
  it('pays a coin when bumped from below, then goes inert', () => {
    const s = underBlock('?');
    const events = collect(s, { jump: true }, 3);
    expect(s.tiles[3][5]).toBe('used');
    expect(s.coins).toBe(1);
    expect(s.score).toBe(100);
    expect(events).toContain('coin');
  });

  it('pays only once', () => {
    const s = playing(levelText(30, [[5, 3, '?']]));
    hitBlock(s, 5, 3);
    hitBlock(s, 5, 3);
    expect(s.coins).toBe(1);
  });
});

describe('mushroom block', () => {
  it('sprouts a mushroom on top of the block', () => {
    const s = underBlock('M');
    const events = collect(s, { jump: true }, 3);
    expect(s.tiles[3][5]).toBe('used');
    expect(s.mushrooms).toHaveLength(1);
    expect(s.mushrooms[0].y + s.mushrooms[0].h).toBeLessThanOrEqual(3 + 1e-9);
    expect(events).toContain('sprout');
  });
});

describe('brick', () => {
  it('only bumps when the player is small', () => {
    const s = underBlock('B');
    const events = collect(s, { jump: true }, 3);
    expect(s.tiles[3][5]).toBe('brick');
    expect(events).toContain('bump');
  });

  it('breaks when the player is big', () => {
    const s = underBlock('B', 2, true);
    const events = collect(s, { jump: true }, 3);
    expect(s.tiles[2][5]).toBe('empty');
    expect(s.score).toBe(50);
    expect(events).toContain('break');
  });
});

describe('addCoin', () => {
  it('awards an extra life every 100 coins', () => {
    const s = playing(levelText(30));
    s.coins = 99;
    addCoin(s);
    expect(s.coins).toBe(0);
    expect(s.lives).toBe(START_LIVES + 1);
    expect(s.events.map((e) => e.type)).toEqual(['coin', 'oneup']);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `yarn vitest run src/core/blocks.test.ts`
Expected: FAIL — cannot resolve `./blocks`.

- [ ] **Step 3: Implement**

`src/core/mushrooms.ts`:
```ts
import { MUSHROOM_SPEED } from './constants';
import type { Mushroom } from './types';

/** A mushroom resting on top of block cell (col, row), heading right. */
export function makeMushroom(col: number, row: number): Mushroom {
  return { x: col + 0.1, y: row - 0.8, w: 0.8, h: 0.8, vx: MUSHROOM_SPEED, vy: 0, dir: 1, onGround: false };
}
```

`src/core/blocks.ts`:
```ts
import { POINTS } from './constants';
import { emit } from './events';
import { makeMushroom } from './mushrooms';
import type { GameState } from './types';

export function addCoin(s: GameState): void {
  s.coins += 1;
  s.score += POINTS.coin;
  emit(s, 'coin');
  if (s.coins >= 100) {
    s.coins -= 100;
    s.lives += 1;
    emit(s, 'oneup');
  }
}

/** Called when the player's head hits the tile at (col, row). */
export function hitBlock(s: GameState, col: number, row: number): void {
  switch (s.tiles[row][col]) {
    case 'coinBlock':
      s.tiles[row][col] = 'used';
      addCoin(s);
      break;
    case 'mushroomBlock':
      s.tiles[row][col] = 'used';
      s.mushrooms.push(makeMushroom(col, row));
      emit(s, 'sprout');
      break;
    case 'brick':
      if (s.player.size === 'big') {
        s.tiles[row][col] = 'empty';
        s.score += POINTS.brick;
        emit(s, 'break');
      } else {
        emit(s, 'bump');
      }
      break;
    default:
      break;
  }
}
```

In `src/core/player.ts`, add the import `import { hitBlock } from './blocks';` and, directly after `if (result.landed) p.jumping = false;`, add:
```ts
  if (result.bonk) hitBlock(s, result.bonk.col, result.bonk.row);
```

- [ ] **Step 4: Run all tests and typecheck**

Run: `yarn test && yarn typecheck`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/core
git commit -m "Add question blocks and bricks

Head-bumping blocks is the main way coins and power-ups enter play."
```

---

### Task 7: Mushroom power-up

**Files:**
- Modify: `src/core/mushrooms.ts`, `src/core/game.ts`
- Test: `src/core/mushrooms.test.ts`

**Interfaces:**
- Consumes: `makeMushroom`, `growPlayer`, `moveBody`, `overlaps`.
- Produces: `updateMushrooms(s: GameState): void`, `collectMushrooms(s: GameState): void`.

- [ ] **Step 1: Write failing tests**

`src/core/mushrooms.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { collect, levelText, playing, span, tick } from '../testing/helpers';
import { growPlayer } from './growth';
import { makeMushroom } from './mushrooms';

describe('mushroom movement', () => {
  it('walks right and turns around at a wall', () => {
    const s = playing(levelText(30, [[10, 4, '#']]));
    s.mushrooms.push(makeMushroom(7, 5)); // resting on the ground at row 4
    tick(s, {}, 60);
    expect(s.mushrooms[0].dir).toBe(-1);
  });

  it('walks off ledges and is removed when it leaves the world', () => {
    const s = playing(levelText(30, span(9, 29, 5, '.')));
    s.mushrooms.push(makeMushroom(7, 5));
    tick(s, {}, 120);
    expect(s.mushrooms).toHaveLength(0);
  });
});

describe('collecting a mushroom', () => {
  const overlapping = () => {
    const s = playing(levelText(30));
    tick(s, {}, 3);
    s.mushrooms.push({ x: 1.1, y: 4.2, w: 0.8, h: 0.8, vx: 0, vy: 0, dir: 1, onGround: true });
    return s;
  };

  it('grows a small player, keeping the feet in place', () => {
    const s = overlapping();
    const events = collect(s, {}, 1);
    expect(s.player.size).toBe('big');
    expect(s.player.h).toBe(2);
    expect(s.player.y + s.player.h).toBeCloseTo(5);
    expect(s.mushrooms).toHaveLength(0);
    expect(s.score).toBe(1000);
    expect(events).toContain('powerup');
  });

  it('only scores for a player who is already big', () => {
    const s = overlapping();
    growPlayer(s.player);
    tick(s, {}, 1);
    expect(s.player.size).toBe('big');
    expect(s.score).toBe(1000);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `yarn vitest run src/core/mushrooms.test.ts`
Expected: FAIL — `updateMushrooms`/`collectMushrooms` not exported or behavior missing.

- [ ] **Step 3: Implement**

Replace `src/core/mushrooms.ts` with:
```ts
import { DT, GRAVITY, MAX_FALL, MUSHROOM_SPEED, POINTS } from './constants';
import { emit } from './events';
import { growPlayer } from './growth';
import { moveBody, overlaps } from './physics';
import type { GameState, Mushroom } from './types';

/** A mushroom resting on top of block cell (col, row), heading right. */
export function makeMushroom(col: number, row: number): Mushroom {
  return { x: col + 0.1, y: row - 0.8, w: 0.8, h: 0.8, vx: MUSHROOM_SPEED, vy: 0, dir: 1, onGround: false };
}

export function updateMushrooms(s: GameState): void {
  for (const m of s.mushrooms) {
    m.vx = m.dir * MUSHROOM_SPEED;
    m.vy = Math.min(m.vy + GRAVITY * DT, MAX_FALL);
    const result = moveBody(m, s.tiles);
    m.onGround = result.landed;
    if (result.hitX) m.dir = -m.dir as 1 | -1;
  }
  s.mushrooms = s.mushrooms.filter((m) => m.y <= s.height + 2);
}

export function collectMushrooms(s: GameState): void {
  const p = s.player;
  s.mushrooms = s.mushrooms.filter((m) => {
    if (!overlaps(p, m)) return true;
    s.score += POINTS.mushroom;
    growPlayer(p);
    emit(s, 'powerup');
    return false;
  });
}
```

In `src/core/game.ts`, add `import { collectMushrooms, updateMushrooms } from './mushrooms';` and change `stepPlaying` to:
```ts
function stepPlaying(s: GameState, input: Input): void {
  s.timeLeft = Math.max(0, s.timeLeft - DT);
  updatePlayer(s, input);
  updateEnemies(s);
  updateMushrooms(s);
  resolvePlayerEnemies(s);
  collectMushrooms(s);
  if (s.phase === 'playing' && s.player.y > s.height) killPlayer(s);
  updateCamera(s);
}
```

- [ ] **Step 4: Run all tests and typecheck**

Run: `yarn test && yarn typecheck`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/core
git commit -m "Add the mushroom power-up

Growing gives the hit-point layer that makes damage and brick-breaking meaningful."
```

---

### Task 8: Coins, goal flag, level progression, win

**Files:**
- Create: `src/core/pickups.ts`, `src/core/goal.ts`
- Modify: `src/core/game.ts`
- Test: `src/core/pickups.test.ts`, `src/core/goal.test.ts`

**Interfaces:**
- Consumes: `addCoin`, `overlaps`, `loadLevel`, `resetGame`.
- Produces: `collectCoins(s: GameState): void`; `checkGoal(s: GameState): void`; `stepLevelClear(s: GameState): void`.

- [ ] **Step 1: Write failing tests**

`src/core/pickups.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { collect, levelText, playing } from '../testing/helpers';

describe('coin pickups', () => {
  it('collects a coin the player walks through', () => {
    const s = playing(levelText(30, [[3, 4, 'c']]));
    const events = collect(s, { right: true }, 40);
    expect(s.coins).toBe(1);
    expect(s.score).toBe(100);
    expect(s.coinPickups).toHaveLength(0);
    expect(events).toContain('coin');
  });

  it('leaves coins the player never touches', () => {
    const s = playing(levelText(30, [[20, 4, 'c']]));
    collect(s, { right: true }, 10);
    expect(s.coinPickups).toHaveLength(1);
  });
});
```

`src/core/goal.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { DT, LEVEL_CLEAR_TIME, START_LIVES } from './constants';
import { growPlayer } from './growth';
import { levelText, playing, tick } from '../testing/helpers';
import type { GameState } from './types';

const clearTicks = Math.ceil(LEVEL_CLEAR_TIME / DT) + 2;

function runToFlag(s: GameState) {
  for (let i = 0; i < 400 && s.phase === 'playing'; i++) tick(s, { right: true, run: true });
}

describe('goal flag', () => {
  it('ends the level and awards a time bonus', () => {
    const s = playing(levelText(12));
    runToFlag(s);
    expect(s.phase).toBe('levelClear');
    expect(s.score).toBeGreaterThan(2500);
    expect(s.events.map((e) => e.type)).toContain('flag');
  });

  it('loads the next level, keeping the player\'s size', () => {
    const s = playing(levelText(12), levelText(14));
    tick(s, {}, 3);
    growPlayer(s.player);
    runToFlag(s);
    tick(s, {}, clearTicks);
    expect(s.phase).toBe('playing');
    expect(s.levelIndex).toBe(1);
    expect(s.width).toBe(14);
    expect(s.player.size).toBe('big');
    expect(s.player.h).toBe(2);
  });

  it('is won after the last level, and jump returns to the title', () => {
    const s = playing(levelText(12));
    runToFlag(s);
    tick(s, {}, clearTicks);
    expect(s.phase).toBe('won');
    tick(s, { jump: true });
    expect(s).toMatchObject({ phase: 'title', score: 0, lives: START_LIVES, levelIndex: 0 });
  });

  it('counts the clock down while playing', () => {
    const s = playing(levelText(30));
    const before = s.timeLeft;
    tick(s, {}, 60);
    expect(s.timeLeft).toBeCloseTo(before - 1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `yarn vitest run src/core/pickups.test.ts src/core/goal.test.ts`
Expected: FAIL (coins not collected; phase never `levelClear`).

- [ ] **Step 3: Implement**

`src/core/pickups.ts`:
```ts
import { addCoin } from './blocks';
import { overlaps } from './physics';
import type { GameState } from './types';

export function collectCoins(s: GameState): void {
  s.coinPickups = s.coinPickups.filter((cell) => {
    const rect = { x: cell.col + 0.25, y: cell.row + 0.25, w: 0.5, h: 0.5 };
    if (!overlaps(s.player, rect)) return true;
    addCoin(s);
    return false;
  });
}
```

`src/core/goal.ts`:
```ts
import { DT, LEVEL_CLEAR_TIME, POINTS } from './constants';
import { emit } from './events';
import { overlaps } from './physics';
import { loadLevel } from './state';
import type { GameState } from './types';

export function checkGoal(s: GameState): void {
  if (!overlaps(s.player, s.flag)) return;
  s.phase = 'levelClear';
  s.phaseTimer = LEVEL_CLEAR_TIME;
  s.score += Math.floor(s.timeLeft) * POINTS.timeBonus;
  s.player.vx = 0;
  emit(s, 'flag');
}

export function stepLevelClear(s: GameState): void {
  s.phaseTimer -= DT;
  if (s.phaseTimer > 0) return;
  const next = s.levelIndex + 1;
  if (next < s.levels.length) {
    loadLevel(s, next, s.player.size);
    s.phase = 'playing';
  } else {
    s.phase = 'won';
  }
}
```

In `src/core/game.ts`: add imports `import { checkGoal, stepLevelClear } from './goal';` and `import { collectCoins } from './pickups';`. Change `stepPlaying` to:
```ts
function stepPlaying(s: GameState, input: Input): void {
  s.timeLeft = Math.max(0, s.timeLeft - DT);
  updatePlayer(s, input);
  updateEnemies(s);
  updateMushrooms(s);
  resolvePlayerEnemies(s);
  collectMushrooms(s);
  collectCoins(s);
  if (s.phase === 'playing' && s.player.y > s.height) killPlayer(s);
  if (s.phase === 'playing') checkGoal(s);
  updateCamera(s);
}
```
and in the `switch` of `step`, add:
```ts
    case 'levelClear':
      stepLevelClear(s);
      break;
```
and change the `'gameOver'` case to cover both end phases:
```ts
    case 'gameOver':
    case 'won':
      if (jumpPressed) resetGame(s);
      break;
```

- [ ] **Step 4: Run all tests and typecheck**

Run: `yarn test && yarn typecheck`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/core
git commit -m "Add coin pickups, the goal flag and level progression

Completes the loop from start to finish: collect, reach the flag, advance, win."
```

---

### Task 9: Shell enemy

**Files:**
- Modify: `src/core/combat.ts`, `src/core/game.ts`
- Test: `src/core/shell.test.ts`

**Interfaces:**
- Consumes: existing `Enemy.mode` (`'walking' | 'stunned' | 'sliding'`), `KICK_GRACE`, `POINTS.shellKill`.
- Produces: `resolveShellHits(s: GameState): void` in `combat.ts`. Updated `stomp` handles shells; new internal `kick`.

Rules: stomping a walking or sliding shell enemy stuns it (stationary, still present, +200). Touching a stunned shell kicks it into a slide away from the player (no damage, brief grace so it cannot hit the kicker). A sliding shell hurts the player (after its grace) and defeats any other enemy it touches (+100 each).

- [ ] **Step 1: Write failing tests**

`src/core/shell.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { collect, levelText, playing, tick } from '../testing/helpers';

const KOOPA = levelText(30, [[5, 4, 'k']]);

describe('shell enemy', () => {
  it('is stunned, not destroyed, when stomped', () => {
    const s = playing(KOOPA);
    tick(s, {}, 3);
    Object.assign(s.player, { x: 5.2, y: 3, vy: 8, onGround: false, coyote: 0 });
    collect(s, {}, 5);
    expect(s.enemies).toHaveLength(1);
    expect(s.enemies[0].mode).toBe('stunned');
    expect(s.enemies[0].vx).toBe(0);
    expect(s.score).toBe(200);
    expect(s.phase).toBe('playing');
  });

  it('is kicked away from the player when a stunned shell is touched', () => {
    const s = playing(KOOPA);
    tick(s, {}, 3);
    s.enemies[0].mode = 'stunned';
    s.player.x = 4.6;
    const events = collect(s, {}, 1);
    expect(s.enemies[0].mode).toBe('sliding');
    expect(s.enemies[0].dir).toBe(1);
    expect(s.phase).toBe('playing');
    expect(events).toContain('kick');
  });

  it('hurts the player once it is sliding and its grace has passed', () => {
    const s = playing(KOOPA);
    tick(s, {}, 3);
    Object.assign(s.enemies[0], { mode: 'sliding', dir: 1, cooldown: 0 });
    s.player.x = 4.6;
    tick(s, {}, 1);
    expect(s.phase).toBe('dying');
  });

  it('defeats other enemies it slides into', () => {
    const s = playing(levelText(30, [[5, 4, 'k'], [7, 4, 'g']]));
    Object.assign(s.enemies[0], { mode: 'sliding', dir: 1, cooldown: 0 });
    tick(s, {}, 12);
    expect(s.enemies.map((e) => e.kind)).toEqual(['shell']);
    expect(s.score).toBe(100);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `yarn vitest run src/core/shell.test.ts`
Expected: FAIL (a stomped shell is currently removed like a walker).

- [ ] **Step 3: Implement**

In `src/core/combat.ts`, add `KICK_GRACE` to the constants import, then replace `stomp` and `resolvePlayerEnemies` and add `kick` and `resolveShellHits`:
```ts
function stomp(s: GameState, e: Enemy): void {
  s.player.vy = -STOMP_BOUNCE;
  s.score += POINTS.stomp;
  emit(s, 'stomp');
  if (e.kind === 'shell') {
    e.mode = 'stunned';
    e.vx = 0;
    e.cooldown = KICK_GRACE; // so the bouncing player doesn't instantly kick it
  } else {
    s.enemies = s.enemies.filter((other) => other !== e);
  }
}

function kick(s: GameState, e: Enemy): void {
  const p = s.player;
  e.mode = 'sliding';
  e.dir = p.x + p.w / 2 < e.x + e.w / 2 ? 1 : -1;
  e.cooldown = KICK_GRACE;
  emit(s, 'kick');
}

export function resolvePlayerEnemies(s: GameState): void {
  const p = s.player;
  for (const e of [...s.enemies]) {
    if (s.phase !== 'playing') return;
    if (!overlaps(p, e)) continue;
    const stomping = p.vy > 0 && p.y + p.h - e.y < STOMP_DEPTH;
    if (e.mode === 'stunned') {
      if (e.cooldown === 0) kick(s, e);
    } else if (stomping) stomp(s, e);
    else if (e.cooldown === 0 && p.invulnerable === 0) hurtPlayer(s);
  }
}

/** Sliding shells defeat every other enemy they touch. */
export function resolveShellHits(s: GameState): void {
  const defeated = new Set<Enemy>();
  for (const shell of s.enemies) {
    if (shell.mode !== 'sliding') continue;
    for (const other of s.enemies) {
      if (other !== shell && !defeated.has(other) && overlaps(shell, other)) defeated.add(other);
    }
  }
  if (defeated.size === 0) return;
  s.score += POINTS.shellKill * defeated.size;
  s.enemies = s.enemies.filter((e) => !defeated.has(e));
  emit(s, 'stomp');
}
```

In `src/core/game.ts`, import `resolveShellHits` alongside the other combat imports and call it right after `updateEnemies(s);` in `stepPlaying`:
```ts
  updateEnemies(s);
  resolveShellHits(s);
```

- [ ] **Step 4: Run all tests and typecheck**

Run: `yarn test && yarn typecheck`
Expected: all pass, including the earlier walker stomp tests.

- [ ] **Step 5: Commit**

```bash
git add src/core
git commit -m "Add the shell enemy

A second enemy behavior (stun, kick, slide) gives levels more than one way to be dangerous or exploited."
```

---

### Task 10: Extension seams — SaveStore and LevelSource

**Files:**
- Create: `src/save/store.ts`, `src/levels/source.ts`
- Test: `src/save/store.test.ts`, `src/levels/source.test.ts`

**Interfaces:**
- Produces:
  - `src/save/store.ts`: `interface SaveData { version: 1; highestLevel: number; bestScore: number }`; `interface SaveStore { load(): SaveData | null; save(data: SaveData): void }`; `createMemorySaveStore(): SaveStore`; `recordProgress(prev: SaveData | null, levelIndex: number, score: number): SaveData`.
  - `src/levels/source.ts`: `interface LevelSource { count(): number; get(index: number): Level }`; `fromLevels(levels: Level[]): LevelSource`.

- [ ] **Step 1: Write failing tests**

`src/save/store.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { createMemorySaveStore, recordProgress } from './store';

describe('recordProgress', () => {
  it('starts fresh when nothing was saved', () => {
    expect(recordProgress(null, 1, 500)).toEqual({ version: 1, highestLevel: 1, bestScore: 500 });
  });

  it('never lowers an existing best', () => {
    const prev = { version: 1 as const, highestLevel: 2, bestScore: 900 };
    expect(recordProgress(prev, 1, 500)).toEqual(prev);
  });

  it('raises whichever value improved', () => {
    const prev = { version: 1 as const, highestLevel: 1, bestScore: 900 };
    expect(recordProgress(prev, 2, 100)).toEqual({ version: 1, highestLevel: 2, bestScore: 900 });
  });
});

describe('createMemorySaveStore', () => {
  it('has nothing saved at first', () => {
    expect(createMemorySaveStore().load()).toBeNull();
  });

  it('returns what was saved, as a copy', () => {
    const store = createMemorySaveStore();
    const data = { version: 1 as const, highestLevel: 1, bestScore: 10 };
    store.save(data);
    const loaded = store.load();
    expect(loaded).toEqual(data);
    expect(loaded).not.toBe(data);
  });
});
```

`src/levels/source.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { levelText } from '../testing/level-text';
import { parseLevel } from './format';
import { fromLevels } from './source';

describe('fromLevels', () => {
  const levels = [parseLevel(levelText(10)), parseLevel(levelText(12))];

  it('reports how many levels it holds', () => {
    expect(fromLevels(levels).count()).toBe(2);
  });

  it('returns levels by index', () => {
    expect(fromLevels(levels).get(1).width).toBe(12);
  });

  it('rejects an index out of range', () => {
    expect(() => fromLevels(levels).get(2)).toThrow(/level 2/i);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `yarn vitest run src/save src/levels/source.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`src/save/store.ts`:
```ts
export interface SaveData {
  version: 1;
  highestLevel: number;
  bestScore: number;
}

export interface SaveStore {
  load(): SaveData | null;
  save(data: SaveData): void;
}

export function createMemorySaveStore(): SaveStore {
  let saved: SaveData | null = null;
  return {
    load: () => (saved ? { ...saved } : null),
    save: (data) => {
      saved = { ...data };
    },
  };
}

export function recordProgress(prev: SaveData | null, levelIndex: number, score: number): SaveData {
  return {
    version: 1,
    highestLevel: Math.max(prev?.highestLevel ?? 0, levelIndex),
    bestScore: Math.max(prev?.bestScore ?? 0, score),
  };
}
```

`src/levels/source.ts`:
```ts
import type { Level } from '../core/types';

export interface LevelSource {
  count(): number;
  get(index: number): Level;
}

export function fromLevels(levels: Level[]): LevelSource {
  return {
    count: () => levels.length,
    get: (index) => {
      if (index < 0 || index >= levels.length) throw new Error(`No level ${index}`);
      return levels[index];
    },
  };
}
```

- [ ] **Step 4: Run all tests and typecheck**

Run: `yarn test && yarn typecheck`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/save src/levels/source.ts src/levels/source.test.ts
git commit -m "Add LevelSource and SaveStore seams

Interfaces now, implementations later: a level editor and localStorage can plug in without touching the game loop."
```

---

### Task 11: Level builder, the three built-in levels, and a bot that beats them

**Files:**
- Create: `src/levels/builder.ts`, `src/levels/builtin.ts`, `src/testing/bot.ts`
- Test: `src/levels/builder.test.ts`, `src/levels/builtin.test.ts`

**Interfaces:**
- Consumes: `parseLevel`, `fromLevels`, `createGame`, `step`, `solidAt`.
- Produces:
  - `src/levels/builder.ts`: `class LevelBuilder` with `constructor(width: number)`, `put(col,row,glyph)`, `ground(from,to)`, `wall(col,tall)`, `blocks(col,row,glyphs)`, `enemy(col,'g'|'k')`, `coins(col,row,count)`, `start(col)`, `flag(col,row)`, `toText(): string`; constants `HEIGHT = 14`, `GROUND_ROW = 12`. All mutators return `this`.
  - `src/levels/builtin.ts`: `builtinLevelTexts: string[]`; `builtinLevels: LevelSource`.
  - `src/testing/bot.ts`: `createBot(): (s: GameState) => Input` — holds right+run, jumps over walls, gaps and enemies.

- [ ] **Step 1: Write failing builder tests**

`src/levels/builder.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { parseLevel } from './format';
import { GROUND_ROW, HEIGHT, LevelBuilder } from './builder';

describe('LevelBuilder', () => {
  const level = parseLevel(
    new LevelBuilder(10)
      .ground(0, 4)
      .ground(7, 9)
      .start(1)
      .wall(3, 2)
      .blocks(2, 8, '?B')
      .enemy(8, 'g')
      .enemy(4, 'k')
      .coins(5, 9, 2)
      .flag(9, 4)
      .toText(),
  );

  it('emits a full-height grid', () => {
    expect(level.width).toBe(10);
    expect(level.height).toBe(HEIGHT);
  });

  it('lays ground only where asked, leaving gaps', () => {
    expect(level.tiles[GROUND_ROW][0]).toBe('solid');
    expect(level.tiles[GROUND_ROW][5]).toBe('empty');
    expect(level.tiles[HEIGHT - 1][8]).toBe('solid');
  });

  it('stacks walls on the ground', () => {
    expect(level.tiles[GROUND_ROW - 1][3]).toBe('solid');
    expect(level.tiles[GROUND_ROW - 2][3]).toBe('solid');
    expect(level.tiles[GROUND_ROW - 3][3]).toBe('empty');
  });

  it('places blocks, entities and the flag', () => {
    expect(level.tiles[8][2]).toBe('coinBlock');
    expect(level.tiles[8][3]).toBe('brick');
    expect(level.spawn).toEqual({ col: 1, row: GROUND_ROW - 1 });
    expect(level.walkers).toEqual([{ col: 8, row: GROUND_ROW - 1 }]);
    expect(level.shells).toEqual([{ col: 4, row: GROUND_ROW - 1 }]);
    expect(level.coins).toEqual([{ col: 5, row: 9 }, { col: 6, row: 9 }]);
    expect(level.flag).toEqual({ col: 9, row: 4 });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `yarn vitest run src/levels/builder.test.ts`
Expected: FAIL — cannot resolve `./builder`.

- [ ] **Step 3: Implement the builder**

`src/levels/builder.ts`:
```ts
export const HEIGHT = 14;
export const GROUND_ROW = 12;

/** Authoring helper: draws a level and emits the text format `parseLevel` reads. */
export class LevelBuilder {
  private readonly cells: string[][];

  constructor(readonly width: number) {
    this.cells = Array.from({ length: HEIGHT }, () => Array<string>(width).fill('.'));
  }

  put(col: number, row: number, glyph: string): this {
    this.cells[row][col] = glyph;
    return this;
  }

  /** Solid ground on cols from..to (inclusive), from GROUND_ROW to the bottom. */
  ground(from: number, to: number): this {
    for (let col = from; col <= to; col++) {
      for (let row = GROUND_ROW; row < HEIGHT; row++) this.put(col, row, '#');
    }
    return this;
  }

  /** A column of solid tiles standing on the ground. */
  wall(col: number, tall: number): this {
    for (let i = 0; i < tall; i++) this.put(col, GROUND_ROW - 1 - i, '#');
    return this;
  }

  blocks(col: number, row: number, glyphs: string): this {
    [...glyphs].forEach((glyph, i) => this.put(col + i, row, glyph));
    return this;
  }

  enemy(col: number, glyph: 'g' | 'k'): this {
    return this.put(col, GROUND_ROW - 1, glyph);
  }

  coins(col: number, row: number, count: number): this {
    for (let i = 0; i < count; i++) this.put(col + i, row, 'c');
    return this;
  }

  start(col: number): this {
    return this.put(col, GROUND_ROW - 1, 'P');
  }

  flag(col: number, row: number): this {
    return this.put(col, row, 'F');
  }

  toText(): string {
    return this.cells.map((row) => row.join('')).join('\n');
  }
}
```

- [ ] **Step 4: Run builder tests**

Run: `yarn vitest run src/levels/builder.test.ts`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/levels/builder.ts src/levels/builder.test.ts
git commit -m "Add a level builder for authoring level text

Hand-counting 64-column rows is error-prone; the builder keeps the text format as the single output."
```

- [ ] **Step 6: Write the failing level + bot tests**

`src/levels/builtin.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { START_LIVES } from '../core/constants';
import { createGame } from '../core/state';
import { step } from '../core/game';
import { createBot } from '../testing/bot';
import { parseLevel, serializeLevel } from './format';
import { builtinLevelTexts, builtinLevels } from './builtin';

describe('built-in levels', () => {
  it('ships three levels', () => {
    expect(builtinLevels.count()).toBe(3);
  });

  it.each(builtinLevelTexts.map((text, i) => [i + 1, text] as const))(
    'level %i is valid text that round-trips',
    (_n, text) => {
      expect(serializeLevel(parseLevel(text))).toBe(text.trim());
    },
  );
});

describe('replay: every level is completable', () => {
  const MAX_TICKS = 60 * 90;

  it.each([0, 1, 2])('a simple bot beats level %i without dying', (index) => {
    const s = createGame([builtinLevels.get(index)]);
    s.phase = 'playing';
    const bot = createBot();
    while (s.phase !== 'won' && s.phase !== 'gameOver' && s.tick < MAX_TICKS) {
      step(s, bot(s));
    }
    expect({ phase: s.phase, lives: s.lives, x: Math.round(s.player.x) }).toMatchObject({
      phase: 'won',
      lives: START_LIVES,
    });
  });
});
```

- [ ] **Step 7: Run to verify failure**

Run: `yarn vitest run src/levels/builtin.test.ts`
Expected: FAIL — `./builtin` and `../testing/bot` not found.

- [ ] **Step 8: Implement the bot**

`src/testing/bot.ts`:
```ts
import { solidAt } from '../core/physics';
import type { GameState, Input } from '../core/types';

function shouldJump(s: GameState): boolean {
  const p = s.player;
  const front = (dx: number) => Math.floor(p.x + p.w + dx);
  const footRow = Math.floor(p.y + p.h - 0.5);

  const wallAhead = [0.5, 1.0, 1.5].some((dx) => solidAt(s.tiles, front(dx), footRow));
  const gapAhead = !solidAt(s.tiles, front(0.3), Math.floor(p.y + p.h + 0.5));
  const enemyAhead = s.enemies.some((e) => {
    const distance = e.x - (p.x + p.w);
    return distance > 0.5 && distance < 5 && Math.abs(e.y - p.y) < 2;
  });
  return wallAhead || gapAhead || enemyAhead;
}

/** Runs right, jumping (and holding jump while airborne) over walls, gaps and enemies. */
export function createBot(): (s: GameState) => Input {
  let held = false;
  return (s) => {
    const want = s.player.onGround && shouldJump(s);
    const jump = s.player.onGround ? want && !held : held;
    held = jump;
    return { left: false, right: true, run: true, jump };
  };
}
```

- [ ] **Step 9: Implement the built-in levels**

`src/levels/builtin.ts`:
```ts
import { fromLevels, type LevelSource } from './source';
import { parseLevel } from './format';
import { LevelBuilder } from './builder';

// Layout rules that keep every level beatable: gaps are at most 3 wide,
// walls at most 2 tall, and enemies sit at least ~8 columns past the far
// side of a gap (a jump lands about 2 columns beyond it).

function level1(): string {
  return new LevelBuilder(64)
    .ground(0, 27).ground(31, 45).ground(48, 63) // gaps at 28-30 and 46-47
    .start(2)
    .blocks(4, 8, '?BMB?')
    .wall(14, 2)
    .enemy(24, 'g').enemy(38, 'g').enemy(58, 'k')
    .coins(28, 9, 3).coins(46, 9, 2)
    .flag(61, 4)
    .toText();
}

function level2(): string {
  return new LevelBuilder(80)
    .ground(0, 19).ground(23, 39).ground(43, 58).ground(62, 79) // gaps 20-22, 40-42, 59-61
    .start(2)
    .blocks(4, 8, 'B?B')
    .enemy(16, 'g').enemy(34, 'k').enemy(52, 'g').enemy(75, 'g')
    .wall(66, 2)
    .coins(20, 9, 3).coins(40, 9, 3).coins(59, 9, 3)
    .flag(78, 4)
    .toText();
}

function level3(): string {
  return new LevelBuilder(96)
    .ground(0, 17).ground(21, 37).ground(41, 58).ground(62, 78).ground(82, 95) // four 3-wide gaps
    .start(2)
    .blocks(4, 8, '?B?')
    .enemy(12, 'g').enemy(29, 'k').enemy(47, 'g').enemy(68, 'g')
    .wall(88, 2)
    .coins(18, 9, 3).coins(38, 9, 3).coins(59, 9, 3).coins(79, 9, 3)
    .flag(94, 4)
    .toText();
}

export const builtinLevelTexts: string[] = [level1(), level2(), level3()];

export const builtinLevels: LevelSource = fromLevels(builtinLevelTexts.map(parseLevel));
```

- [ ] **Step 10: Run the tests**

Run: `yarn vitest run src/levels/builtin.test.ts`
Expected: structure tests pass. The bot tests are the real guard — they may need tuning.

If a bot test fails, print where the run ended to see why:
```bash
yarn vitest run src/levels/builtin.test.ts -t "level 1"
```
and add a temporary `console.log(s.phase, s.player.x, s.player.y, s.lives)` to the test. **Adjust the level layout** (move an enemy further from a gap/wall, shorten a gap), never the physics constants or the rules, to make the bot pass. Keep to the layout rules in the comment at the top of `builtin.ts`. Remove any temporary logging before committing.

- [ ] **Step 11: Run all tests and typecheck**

Run: `yarn test && yarn typecheck`
Expected: all pass.

- [ ] **Step 12: Commit**

```bash
git add src/levels src/testing/bot.ts
git commit -m "Add the three built-in levels with a replay guard

A bot that must clear every level without dying catches impossible layouts the moment a rule or constant changes."
```

---

### Task 12: Keyboard input source

**Files:**
- Create: `src/input/keyboard.ts`
- Test: `src/input/keyboard.test.ts`

**Interfaces:**
- Consumes: `Input` type.
- Produces: `interface InputSource { poll(): Input }`; `createKeyboardInput(target: EventTarget): InputSource`. Bindings: left = ArrowLeft/KeyA; right = ArrowRight/KeyD; jump = Space/KeyZ/ArrowUp/KeyW; run = KeyX/ShiftLeft/ShiftRight.

- [ ] **Step 1: Write the failing tests**

`src/input/keyboard.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { createKeyboardInput } from './keyboard';

function press(target: EventTarget, type: 'keydown' | 'keyup', code: string) {
  const event = Object.assign(new Event(type, { cancelable: true }), { code });
  target.dispatchEvent(event);
  return event;
}

describe('createKeyboardInput', () => {
  it('reports nothing pressed at first', () => {
    const input = createKeyboardInput(new EventTarget());
    expect(input.poll()).toEqual({ left: false, right: false, jump: false, run: false });
  });

  it('tracks held keys until released', () => {
    const target = new EventTarget();
    const input = createKeyboardInput(target);
    press(target, 'keydown', 'ArrowRight');
    press(target, 'keydown', 'KeyX');
    expect(input.poll()).toMatchObject({ right: true, run: true, left: false });
    press(target, 'keyup', 'ArrowRight');
    expect(input.poll()).toMatchObject({ right: false, run: true });
  });

  it('accepts alternate bindings', () => {
    const target = new EventTarget();
    const input = createKeyboardInput(target);
    press(target, 'keydown', 'KeyA');
    press(target, 'keydown', 'Space');
    expect(input.poll()).toMatchObject({ left: true, jump: true });
  });

  it('stops the browser from scrolling on bound keys only', () => {
    const target = new EventTarget();
    createKeyboardInput(target);
    expect(press(target, 'keydown', 'Space').defaultPrevented).toBe(true);
    expect(press(target, 'keydown', 'KeyQ').defaultPrevented).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `yarn vitest run src/input/keyboard.test.ts`
Expected: FAIL — cannot resolve `./keyboard`.

- [ ] **Step 3: Implement**

`src/input/keyboard.ts`:
```ts
import type { Input } from '../core/types';

export interface InputSource {
  poll(): Input;
}

const BINDINGS: Record<keyof Input, string[]> = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  jump: ['Space', 'KeyZ', 'ArrowUp', 'KeyW'],
  run: ['KeyX', 'ShiftLeft', 'ShiftRight'],
};

const BOUND_CODES = new Set(Object.values(BINDINGS).flat());

export function createKeyboardInput(target: EventTarget): InputSource {
  const down = new Set<string>();

  target.addEventListener('keydown', (event) => {
    const code = (event as KeyboardEvent).code;
    if (!BOUND_CODES.has(code)) return;
    event.preventDefault();
    down.add(code);
  });
  target.addEventListener('keyup', (event) => {
    down.delete((event as KeyboardEvent).code);
  });

  const held = (action: keyof Input) => BINDINGS[action].some((code) => down.has(code));
  return {
    poll: () => ({ left: held('left'), right: held('right'), jump: held('jump'), run: held('run') }),
  };
}
```

- [ ] **Step 4: Run all tests and typecheck**

Run: `yarn test && yarn typecheck`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/input
git commit -m "Add keyboard input behind an InputSource interface

Touch controls can later implement the same interface without any core change."
```

---

### Task 13: Sprites, renderer, audio, and the main loop

Rendering and audio are verified in the browser (Task 14); only the pure sprite data is unit-tested.

**Files:**
- Create: `src/render/spriteData.ts`, `src/render/sprites.ts`, `src/render/renderer.ts`, `src/audio/synth.ts`, `.claude/launch.json`
- Modify: `src/main.ts`
- Test: `src/render/spriteData.test.ts`

**Interfaces:**
- Consumes: `GameState`, `Tile`, `GameEvent`, `EventType`, `step`, `createGame`, `builtinLevels`, `createKeyboardInput`, `createMemorySaveStore`, `recordProgress`, `DT`, `VIEW_TILES_W`.
- Produces:
  - `spriteData.ts`: `PALETTE: Record<string, string>`; `SPRITES` (record of name -> `readonly string[]` rows); `type SpriteName = keyof typeof SPRITES`.
  - `sprites.ts`: `type SpriteSheet = Record<SpriteName, HTMLCanvasElement>`; `bakeSprites(): SpriteSheet`.
  - `renderer.ts`: `TILE = 16`, `VIEW_W = 256`, `VIEW_H = 224`; `render(ctx: CanvasRenderingContext2D, s: GameState, sheet: SpriteSheet): void`.
  - `synth.ts`: `createAudio(): { play(events: readonly GameEvent[]): void }`.

- [ ] **Step 1: Write the failing sprite-data test**

`src/render/spriteData.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { PALETTE, SPRITES } from './spriteData';

describe('sprite data', () => {
  const entries = Object.entries(SPRITES);

  it.each(entries)('%s is a rectangular grid of known colors', (_name, rows) => {
    expect([8, 16]).toContain(rows.length);
    for (const row of rows) {
      expect(row).toHaveLength(8);
      for (const ch of row) expect(ch === '.' || ch in PALETTE).toBe(true);
    }
  });

  it('has a big-player grid twice as tall as the small one', () => {
    expect(SPRITES.playerBigStand).toHaveLength(2 * SPRITES.playerSmallStand.length);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `yarn vitest run src/render/spriteData.test.ts`
Expected: FAIL — cannot resolve `./spriteData`.

- [ ] **Step 3: Implement sprite data**

`src/render/spriteData.ts`:
```ts
/** '.' is transparent; every other character is a PALETTE key. */
export const PALETTE: Record<string, string> = {
  r: '#d82800', // red
  s: '#fc9838', // skin
  b: '#a85800', // brown
  d: '#7c3c00', // dark brown
  k: '#000000', // black
  w: '#ffffff', // white
  y: '#fcbc3c', // yellow
  o: '#c84c0c', // orange
  g: '#58d854', // light green
  G: '#00a800', // green
  u: '#0058f8', // blue
};

export const SPRITES = {
  playerSmallStand: [
    '..rrrr..',
    '.rrrrrr.',
    '.ssksks.',
    '.ssssss.',
    '..rrrr..',
    '.rrbbrr.',
    '.rr..rr.',
    '.bb..bb.',
  ],
  playerSmallRun: [
    '..rrrr..',
    '.rrrrrr.',
    '.ssksks.',
    '.ssssss.',
    '.rrrrrr.',
    'rr.bb.rr',
    '..bbbb..',
    '.bb..bb.',
  ],
  playerBigStand: [
    '..rrrr..',
    '.rrrrrr.',
    '.rrrrrr.',
    '.ssksks.',
    '.ssssss.',
    '.sssss..',
    '..rrrr..',
    '.rrrrrr.',
    'rrbrrbrr',
    'rrbbbbrr',
    'ssbbbbss',
    '.bbbbbb.',
    '.bbbbbb.',
    '.bb..bb.',
    '.bb..bb.',
    'dd....dd',
  ],
  playerBigRun: [
    '..rrrr..',
    '.rrrrrr.',
    '.rrrrrr.',
    '.ssksks.',
    '.ssssss.',
    '.sssss..',
    '..rrrr..',
    '.rrrrrr.',
    'rrrbbrrr',
    'ss.bbb.s',
    '..bbbbb.',
    '.bbbbbb.',
    '.bbb.bbb',
    'bbb...bb',
    'bb.....b',
    'dd.....d',
  ],
  walker: [
    '..dddd..',
    '.dddddd.',
    'dddddddd',
    'dwkddkwd',
    'dddddddd',
    '.dddddd.',
    '..ssss..',
    '.kk..kk.',
  ],
  turtle: [
    '...gg...',
    '..gsg...',
    '..gggg..',
    '.GGgGgG.',
    'GgGGGGgG',
    'GGGGGGGG',
    '.yyyyyy.',
    '.yy..yy.',
  ],
  shell: [
    '........',
    '..GGGG..',
    '.GgGgGG.',
    'GgGGGGgG',
    'GGGGGGGG',
    '.wwwwww.',
    '..wwww..',
    '........',
  ],
  ground: [
    'gggggggg',
    'GGGGGGGG',
    'bbbbbbbb',
    'bdbbbbdb',
    'bbbbdbbb',
    'bbbbbbbb',
    'dbbbbbdb',
    'bbbdbbbb',
  ],
  brick: [
    'dddddddd',
    'oooodooo',
    'oooodooo',
    'dddddddd',
    'ooodoooo',
    'ooodoooo',
    'dddddddd',
    'oooodooo',
  ],
  question: [
    'dyyyyyyd',
    'ykkkkkky',
    'ykyyyyky',
    'yyyyykky',
    'yyykkyyy',
    'yyykyyyy',
    'yyyyyyyy',
    'dyyyyyyd',
  ],
  used: [
    'dddddddd',
    'dbbbbbbd',
    'dbbbbbbd',
    'dbbbbbbd',
    'dbbbbbbd',
    'dbbbbbbd',
    'dbbbbbbd',
    'dddddddd',
  ],
  mushroom: [
    '..rrrr..',
    '.rwrrwr.',
    'rrwrrwrr',
    'rrrrrrrr',
    '.wwssww.',
    '..wssw..',
    '..wssw..',
    '...ww...',
  ],
  coin: [
    '...yy...',
    '..yooy..',
    '..yooy..',
    '..yooy..',
    '..yooy..',
    '..yooy..',
    '..yooy..',
    '...yy...',
  ],
} as const satisfies Record<string, readonly string[]>;

export type SpriteName = keyof typeof SPRITES;
```

- [ ] **Step 4: Run the sprite test**

Run: `yarn vitest run src/render/spriteData.test.ts`
Expected: pass. Fix any row that is not exactly 8 characters.

- [ ] **Step 5: Implement baking and the renderer**

`src/render/sprites.ts`:
```ts
import { PALETTE, SPRITES, type SpriteName } from './spriteData';

export type SpriteSheet = Record<SpriteName, HTMLCanvasElement>;

function bake(rows: readonly string[]): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = rows[0].length;
  canvas.height = rows.length;
  const g = canvas.getContext('2d')!;
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      g.fillStyle = PALETTE[ch];
      g.fillRect(x, y, 1, 1);
    });
  });
  return canvas;
}

export function bakeSprites(): SpriteSheet {
  const entries = (Object.keys(SPRITES) as SpriteName[]).map(
    (name): [SpriteName, HTMLCanvasElement] => [name, bake(SPRITES[name])],
  );
  return Object.fromEntries(entries) as SpriteSheet;
}
```

`src/render/renderer.ts`:
```ts
import { VIEW_TILES_W } from '../core/constants';
import type { GameState, Tile } from '../core/types';
import type { SpriteName } from './spriteData';
import type { SpriteSheet } from './sprites';

export const TILE = 16;
export const VIEW_W = VIEW_TILES_W * TILE;
export const VIEW_H = 224;

const TILE_SPRITE: Record<Tile, SpriteName | null> = {
  empty: null,
  solid: 'ground',
  brick: 'brick',
  coinBlock: 'question',
  mushroomBlock: 'question',
  used: 'used',
};

function blit(
  ctx: CanvasRenderingContext2D,
  img: HTMLCanvasElement,
  x: number,
  y: number,
  w: number,
  h: number,
  flip = false,
): void {
  if (!flip) {
    ctx.drawImage(img, x, y, w, h);
    return;
  }
  ctx.save();
  ctx.translate(x + w, y);
  ctx.scale(-1, 1);
  ctx.drawImage(img, 0, 0, w, h);
  ctx.restore();
}

/** Draws a 16-px-wide sprite horizontally centered on a body and flush with its bottom. */
function blitBody(
  ctx: CanvasRenderingContext2D,
  img: HTMLCanvasElement,
  body: { x: number; y: number; w: number; h: number },
  cam: number,
  heightPx: number,
  flip: boolean,
): void {
  const x = Math.round((body.x + body.w / 2) * TILE - TILE / 2) - cam;
  const y = Math.round((body.y + body.h) * TILE - heightPx);
  blit(ctx, img, x, y, TILE, heightPx, flip);
}

function drawBackground(ctx: CanvasRenderingContext2D, cam: number): void {
  ctx.fillStyle = '#5c94fc';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  ctx.fillStyle = '#ffffff';
  const cloudOffset = -((cam * 0.25) % 160);
  for (let x = cloudOffset - 160; x < VIEW_W + 160; x += 160) {
    ctx.fillRect(x + 20, 40, 32, 8);
    ctx.fillRect(x + 28, 34, 16, 6);
    ctx.fillRect(x + 90, 64, 40, 8);
    ctx.fillRect(x + 98, 58, 20, 6);
  }

  ctx.fillStyle = '#00a800';
  const hillOffset = -((cam * 0.5) % 192);
  for (let x = hillOffset - 192; x < VIEW_W + 192; x += 192) {
    ctx.beginPath();
    ctx.arc(x + 96, 12 * TILE, 48, Math.PI, 0);
    ctx.fill();
  }
}

function drawTiles(ctx: CanvasRenderingContext2D, s: GameState, sheet: SpriteSheet, cam: number): void {
  const first = Math.max(0, Math.floor(s.cameraX));
  const last = Math.min(s.width - 1, Math.ceil(s.cameraX + VIEW_TILES_W));
  for (let row = 0; row < s.height; row++) {
    for (let col = first; col <= last; col++) {
      const name = TILE_SPRITE[s.tiles[row][col]];
      if (name) blit(ctx, sheet[name], col * TILE - cam, row * TILE, TILE, TILE);
    }
  }
}

function drawCoins(ctx: CanvasRenderingContext2D, s: GameState, sheet: SpriteSheet, cam: number): void {
  const width = Math.max(4, Math.round(TILE * Math.abs(Math.cos(s.tick / 12))));
  for (const cell of s.coinPickups) {
    blit(ctx, sheet.coin, cell.col * TILE - cam + (TILE - width) / 2, cell.row * TILE, width, TILE);
  }
}

function drawFlag(ctx: CanvasRenderingContext2D, s: GameState, cam: number): void {
  const f = s.flag;
  const x = Math.round(f.x * TILE) - cam;
  const y = Math.round(f.y * TILE);
  ctx.fillStyle = '#d8d8d8';
  ctx.fillRect(x, y, Math.round(f.w * TILE), Math.round(f.h * TILE));
  ctx.fillStyle = '#58d854';
  ctx.beginPath();
  ctx.moveTo(x, y + 2);
  ctx.lineTo(x - 12, y + 8);
  ctx.lineTo(x, y + 14);
  ctx.fill();
  ctx.fillStyle = '#fcbc3c';
  ctx.fillRect(x - 1, y - 3, 6, 4);
}

function drawMushrooms(ctx: CanvasRenderingContext2D, s: GameState, sheet: SpriteSheet, cam: number): void {
  for (const m of s.mushrooms) blitBody(ctx, sheet.mushroom, m, cam, TILE, false);
}

function drawEnemies(ctx: CanvasRenderingContext2D, s: GameState, sheet: SpriteSheet, cam: number): void {
  for (const e of s.enemies) {
    if (e.kind === 'walker') {
      blitBody(ctx, sheet.walker, e, cam, TILE, Math.floor(s.tick / 8) % 2 === 1);
    } else {
      const name = e.mode === 'walking' ? 'turtle' : 'shell';
      blitBody(ctx, sheet[name], e, cam, TILE, e.dir > 0);
    }
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, s: GameState, sheet: SpriteSheet, cam: number): void {
  const p = s.player;
  if (p.invulnerable > 0 && Math.floor(s.tick / 3) % 2 === 0) return;
  const big = p.size === 'big';
  const moving = Math.abs(p.vx) > 0.5 && p.onGround;
  const running = !p.onGround || (moving && Math.floor(s.tick / 6) % 2 === 1);
  const name = `player${big ? 'Big' : 'Small'}${running ? 'Run' : 'Stand'}` as SpriteName;
  blitBody(ctx, sheet[name], p, cam, big ? 2 * TILE : TILE, p.facing < 0);
}

function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, align: CanvasTextAlign = 'left'): void {
  ctx.textAlign = align;
  ctx.fillStyle = '#000000';
  ctx.fillText(text, x + 1, y + 1);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, x, y);
}

function drawHud(ctx: CanvasRenderingContext2D, s: GameState): void {
  ctx.font = 'bold 8px monospace';
  ctx.textBaseline = 'alphabetic';
  drawText(ctx, `SCORE ${String(s.score).padStart(6, '0')}`, 8, 12);
  drawText(ctx, `COIN x${String(s.coins).padStart(2, '0')}`, 80, 12);
  drawText(ctx, `WORLD ${s.levelIndex + 1}`, 130, 12);
  drawText(ctx, `LIVES ${Math.max(0, s.lives)}`, 178, 12);
  drawText(ctx, `T ${String(Math.floor(s.timeLeft)).padStart(3, '0')}`, 220, 12);
}

function drawOverlay(ctx: CanvasRenderingContext2D, s: GameState): void {
  const lines: Record<string, [string, string]> = {
    title: ['SUPER PLATFORMER', 'PRESS JUMP TO START'],
    levelClear: ['LEVEL CLEAR!', ''],
    gameOver: ['GAME OVER', 'PRESS JUMP'],
    won: ['YOU WIN!', `SCORE ${s.score}  -  PRESS JUMP`],
  };
  const text = lines[s.phase];
  if (!text) return;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(0, 80, VIEW_W, 64);
  ctx.font = 'bold 16px monospace';
  drawText(ctx, text[0], VIEW_W / 2, 108, 'center');
  ctx.font = 'bold 8px monospace';
  drawText(ctx, text[1], VIEW_W / 2, 128, 'center');
}

export function render(ctx: CanvasRenderingContext2D, s: GameState, sheet: SpriteSheet): void {
  ctx.imageSmoothingEnabled = false;
  const cam = Math.round(s.cameraX * TILE);
  drawBackground(ctx, cam);
  drawTiles(ctx, s, sheet, cam);
  drawCoins(ctx, s, sheet, cam);
  drawFlag(ctx, s, cam);
  drawMushrooms(ctx, s, sheet, cam);
  drawEnemies(ctx, s, sheet, cam);
  drawPlayer(ctx, s, sheet, cam);
  drawHud(ctx, s);
  drawOverlay(ctx, s);
}
```

- [ ] **Step 6: Implement audio**

`src/audio/synth.ts`:
```ts
import type { EventType, GameEvent } from '../core/types';

type Note = [frequency: number, seconds: number, wave?: OscillatorType];

const SOUNDS: Record<EventType, Note[]> = {
  jump: [[330, 0.06], [523, 0.1]],
  coin: [[988, 0.06, 'square'], [1319, 0.18, 'square']],
  stomp: [[180, 0.1, 'sawtooth']],
  kick: [[260, 0.05, 'square'], [160, 0.08, 'square']],
  sprout: [[392, 0.05], [523, 0.05], [659, 0.1]],
  powerup: [[523, 0.06, 'square'], [659, 0.06, 'square'], [784, 0.06, 'square'], [1047, 0.15, 'square']],
  shrink: [[600, 0.08], [300, 0.2]],
  bump: [[120, 0.08, 'square']],
  break: [[90, 0.12, 'sawtooth']],
  death: [[392, 0.15, 'square'], [330, 0.15, 'square'], [262, 0.4, 'square']],
  flag: [[523, 0.1, 'square'], [659, 0.1, 'square'], [784, 0.1, 'square'], [1047, 0.4, 'square']],
  oneup: [[659, 0.08, 'square'], [784, 0.08, 'square'], [1319, 0.2, 'square']],
};

export function createAudio(): { play(events: readonly GameEvent[]): void } {
  let context: AudioContext | null = null;

  return {
    play(events) {
      if (events.length === 0) return;
      // Created lazily: events only occur after a key press, which satisfies autoplay policy.
      context ??= new AudioContext();
      const audio = context;
      void audio.resume();
      for (const event of events) {
        let t = audio.currentTime;
        for (const [frequency, seconds, wave = 'triangle'] of SOUNDS[event.type]) {
          const osc = audio.createOscillator();
          const gain = audio.createGain();
          osc.type = wave;
          osc.frequency.value = frequency;
          gain.gain.setValueAtTime(0.08, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + seconds);
          osc.connect(gain).connect(audio.destination);
          osc.start(t);
          osc.stop(t + seconds);
          t += seconds;
        }
      }
    },
  };
}
```

- [ ] **Step 7: Wire the main loop**

`src/main.ts`:
```ts
import { createAudio } from './audio/synth';
import { DT } from './core/constants';
import { step } from './core/game';
import { createGame } from './core/state';
import type { Phase } from './core/types';
import { createKeyboardInput } from './input/keyboard';
import { builtinLevels } from './levels/builtin';
import { VIEW_H, VIEW_W, render } from './render/renderer';
import { bakeSprites } from './render/sprites';
import { createMemorySaveStore, recordProgress } from './save/store';

const canvas = document.getElementById('game') as HTMLCanvasElement;
canvas.width = VIEW_W;
canvas.height = VIEW_H;
const ctx = canvas.getContext('2d')!;

const levels = Array.from({ length: builtinLevels.count() }, (_, i) => builtinLevels.get(i));
const state = createGame(levels);
const input = createKeyboardInput(window);
const audio = createAudio();
const sheet = bakeSprites();
const saveStore = createMemorySaveStore();

const SAVE_PHASES = new Set<Phase>(['levelClear', 'gameOver', 'won']);
let lastPhase = state.phase;
let accumulator = 0;
let last = performance.now();

function frame(now: number): void {
  accumulator += Math.min(0.25, (now - last) / 1000);
  last = now;
  while (accumulator >= DT) {
    step(state, input.poll());
    audio.play(state.events);
    if (state.phase !== lastPhase && SAVE_PHASES.has(state.phase)) {
      saveStore.save(recordProgress(saveStore.load(), state.levelIndex, state.score));
    }
    lastPhase = state.phase;
    accumulator -= DT;
  }
  render(ctx, state, sheet);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
```

- [ ] **Step 8: Add the preview launch config**

`.claude/launch.json`:
```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "platformer",
      "runtimeExecutable": "yarn",
      "runtimeArgs": ["dev", "--port", "5173"],
      "port": 5173
    }
  ]
}
```

- [ ] **Step 9: Run all tests, typecheck, and build**

Run: `yarn test && yarn typecheck && yarn build`
Expected: all pass; `dist/` is produced.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "Add sprites, canvas renderer, audio and the main loop

Wires the tested core to a playable browser game; sprites live in code so there are no assets to manage."
```

---

### Task 14: Verify in the browser, security scan, squash

**Files:** none new (fixes only if verification finds problems)

- [ ] **Step 1: Start the dev server and open it**

Use `mcp__Claude_Browser__preview_start` with name `platformer`, then `preview_screenshot`.
Expected: the title screen over the sky/hills/ground background with "SUPER PLATFORMER". `preview_console_logs` with level `error` shows nothing.

- [ ] **Step 2: Drive the game**

Use `preview_eval` to dispatch key events on `window` (the keyboard source listens there):
```js
const key = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code, cancelable: true }));
key('keydown', 'Space'); setTimeout(() => key('keyup', 'Space'), 100);
```
Then hold `ArrowRight` + `KeyX` for a couple of seconds, jump with `Space`, and take screenshots. Check: the player and tiles are drawn with the pixel sprites; the camera scrolls; the HUD updates (score/coins); a `?` block bumped from below shows as used; a walker is stomped or hurts; falling in a pit costs a life and respawns; reaching the flag advances to WORLD 2. Report anything that looks wrong and fix it with a failing test first where the cause is in `core`.

- [ ] **Step 3: Snyk scan**

Run the `snyk_code_scan` tool on the project directory. Fix any findings in new first-party code, then rescan until clean.

- [ ] **Step 4: Final verification**

Run: `yarn test && yarn typecheck && yarn build`
Expected: all green.

- [ ] **Step 5: Squash into one meaningful commit**

The spec commit `f6b8a0b` stays separate; squash everything after it:
```bash
git reset --soft f6b8a0b
git commit -m "Build a side-scrolling platformer in TypeScript and Canvas

A deterministic fixed-step core (physics, enemies, blocks, power-ups, goal) is developed test-first and kept free of rendering, so touch input, a level editor and save data can be added at the InputSource, LevelSource and SaveStore seams. Three built-in levels are guarded by a bot replay test; pixel-art sprites are defined in code so the game needs no assets."
git log --oneline
```
Expected: two commits (the spec, then the implementation).

- [ ] **Step 6: Finish the branch**

Invoke `superpowers:finishing-a-development-branch`.
