# Secrets, Warp Pipes, Higher Jump and Richer Levels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise the jump, add hidden blocks and warp pipes (in-level teleports and bonus rooms), and redesign the three levels to use them.

**Architecture:** Extends the existing pure-core game. Bonus rooms are walled-off rectangles in the same wide grid, reached by a new `warping` phase that teleports the player and snaps the camera. Hidden blocks are tiles that are solid only to a player's upward head bump. The level text format gains pipe/hidden glyphs and a `---` footer for warps, secret links and dark (room) column ranges.

**Tech Stack:** TypeScript, HTML5 Canvas, Vite, Vitest, yarn (unchanged).

**Spec:** `docs/superpowers/specs/2026-10-06-secrets-warps-design.md` (extends `2026-10-06-platformer-design.md`)

## Global Constraints

- Package manager is `yarn` only. Never npm/pnpm/bun.
- Dependency rule: `src/core` imports nothing from `render`, `audio`, `input`, `save`, or `levels`. Test support (`src/testing`) may import core and levels.
- `GameState` stays plain serializable data; `step(state, input)` stays deterministic at a fixed 1/60 s tick.
- TDD: failing test, see it fail, minimal code, see it pass, commit. One commit per red-green cycle. Never refactor and change behavior in the same step.
- Commit messages explain *why*; never add a Claude signature or Co-Authored-By line.
- Work on branch `feature/secrets-and-warps` (already created, off `main`).
- Level text legend additions: `<` `>` `(` `)` pipe pieces; `1`-`9` pipe top-left with mouth id; `h` `u` `m` `w` hidden coin / 1-up / power-up / warp block. Footer after a line `---`: `warp A -> B`, `secret N -> B`, `dark FROM-TO`. The old level text (no footer) parses unchanged.
- Design limits: gaps at most 4 wide; walls and pipes at most 3 tall (stairs/platforms excepted); every level beatable by the bot without using any secret or warp.
- Constants: `JUMP_VELOCITY` 22 (apex 4.4 tiles with `GRAVITY` 55); `WARP_SINK_TIME` 0.4 s and `WARP_EMERGE_TIME` 0.4 s.
- Logical canvas stays 256x224 (16x14 tiles of 16 px).

## Test-level conventions (unchanged)

`levelText(width, edits, rows = 6, footer = [])` builds a level: ground on row 5, `P` at (1, 4), `F` at (width-1, 4). Standing on the ground the player's `y` is 4; a block "directly above the head" is on row 3. A pipe made by `pipeEdits(col, mouth)` has its mouth on row 3 and body on row 4, so a player standing on it has `y = 2` (feet at row 3).

## File Structure (changes)

```
src/core/types.ts          MODIFY  new Tile kinds, Mouth/Warp/SecretWarp/ColumnRange, Level fields, Input.down, Mushroom.kind, EventType 'warp', Phase 'warping', GameState.warp/prevDown
src/core/constants.ts      MODIFY  JUMP_VELOCITY 22; WARP_SINK_TIME, WARP_EMERGE_TIME
src/core/physics.ts        MODIFY  hidden tiles non-solid; moveBody option bumpHidden
src/core/player.ts         MODIFY  pass bumpHidden to moveBody
src/core/blocks.ts         MODIFY  hidden block reveals
src/core/mushrooms.ts      MODIFY  Mushroom kind, 1-up collection
src/core/state.ts          MODIFY  new GameState fields
src/core/warp.ts           CREATE  tryStartWarp, stepWarping
src/core/camera.ts         CREATE  updateCamera, activeDarkRange, clampToDarkRange
src/core/game.ts           MODIFY  warping phase wiring, prevDown, camera import
src/levels/format.ts       MODIFY  glyphs, pipe validation, footer, serialize
src/levels/builder.ts      MODIFY  pipe/stairs/platform/hidden/warp/secret/dark/room
src/levels/builtin.ts      MODIFY  the three redesigned levels
src/input/keyboard.ts      MODIFY  Down/S binding
src/render/spriteData.ts   MODIFY  pipe, warpBlock, mushroomOneUp sprites
src/render/renderer.ts     MODIFY  tile sprites, dark rooms, warp draw order, 1-up sprite
src/audio/synth.ts         MODIFY  'warp' sound
src/testing/level-text.ts  MODIFY  footer param, pipeEdits
src/testing/helpers.ts     MODIFY  NONE.down, re-exports
src/testing/bot.ts         MODIFY  down:false, longer wall lookahead
```

---

### Task 1: Higher jump

**Files:**
- Modify: `src/core/constants.ts`
- Test: `src/core/player.test.ts` (append one test)
- Possibly modify: `src/testing/bot.ts` / `src/levels/builtin.ts` only if the existing replay tests break (see Step 4)

**Interfaces:**
- Produces: `JUMP_VELOCITY = 22` (was 19).

- [ ] **Step 1: Write the failing test**

Append inside the `describe('player jumping', ...)` block of `src/core/player.test.ts`:
```ts
  it('reaches about four tiles at the top of a held jump', () => {
    const s = playing(FLAT);
    tick(s, {}, 5);
    let top = s.player.y;
    for (let i = 0; i < 100; i++) {
      step(s, { ...NONE, jump: true });
      top = Math.min(top, s.player.y);
    }
    expect(4 - top).toBeGreaterThan(4.0);
    expect(4 - top).toBeLessThan(4.6);
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn vitest run src/core/player.test.ts -t "four tiles"`
Expected: FAIL (apex is about 3.1 with the current velocity).

- [ ] **Step 3: Change the constant**

In `src/core/constants.ts` change `export const JUMP_VELOCITY = 19;` to `export const JUMP_VELOCITY = 22;`.

- [ ] **Step 4: Run the whole suite**

Run: `yarn test && yarn typecheck`
Expected: the new test passes. If the bot replay tests (`src/levels/builtin.test.ts`) now fail because the taller jump changes landing spots, make the **smallest** fix to get them green again: first try adding `2.0` to the bot's wall lookahead list in `src/testing/bot.ts` (`[0.5, 1.0, 1.5, 2.0]`), then, only if still failing, nudge an enemy/wall in `src/levels/builtin.ts` by a few columns. These levels are redesigned in Task 11, so do not invest more than that. Never weaken the replay assertions.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Raise the jump to about four tiles

A 3.3-tile apex felt stunted; 4.4 tiles (velocity 22) matches the classic feel and lets levels ask for wider gaps and taller walls."
```

---

### Task 2: Down input

**Files:**
- Modify: `src/core/types.ts` (`Input` only), `src/input/keyboard.ts`, `src/testing/helpers.ts`, `src/testing/bot.ts`
- Test: `src/input/keyboard.test.ts`

**Interfaces:**
- Produces: `Input.down: boolean`; keyboard binds `ArrowDown` and `KeyS` to `down`.

- [ ] **Step 1: Write the failing tests**

In `src/input/keyboard.test.ts`: change both existing `toEqual({ left: false, right: false, jump: false, run: false })` assertions to `toEqual({ left: false, right: false, jump: false, run: false, down: false })`, and add this test inside the `describe`:
```ts
  it('binds Down and S to down', () => {
    const target = new EventTarget();
    const input = createKeyboardInput(target);
    press(target, 'keydown', 'ArrowDown');
    expect(input.poll().down).toBe(true);
    press(target, 'keyup', 'ArrowDown');
    press(target, 'keydown', 'KeyS');
    expect(input.poll().down).toBe(true);
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `yarn vitest run src/input/keyboard.test.ts`
Expected: FAIL (no `down` in the poll result).

- [ ] **Step 3: Implement**

In `src/core/types.ts`, change the `Input` interface to:
```ts
export interface Input {
  left: boolean;
  right: boolean;
  jump: boolean;
  run: boolean;
  down: boolean;
}
```
In `src/input/keyboard.ts` add to `BINDINGS`: `down: ['ArrowDown', 'KeyS'],` and change the `poll` line to:
```ts
    poll: () => ({
      left: held('left'),
      right: held('right'),
      jump: held('jump'),
      run: held('run'),
      down: held('down'),
    }),
```
In `src/testing/helpers.ts` change `NONE` to `{ left: false, right: false, jump: false, run: false, down: false }`. In `src/testing/bot.ts` change the returned object to `{ left: false, right: true, run: true, jump, down: false }`.

- [ ] **Step 4: Run all tests and typecheck**

Run: `yarn test && yarn typecheck`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add a Down input

Pipes are entered by pressing Down; touch controls can map to the same flag later."
```

---

### Task 3: New sprites

**Files:**
- Modify: `src/render/spriteData.ts`
- Test: `src/render/spriteData.test.ts`

**Interfaces:**
- Produces sprite names: `pipeTL`, `pipeTR`, `pipeL`, `pipeR`, `warpBlock`, `mushroomOneUp` (all 8x8).

- [ ] **Step 1: Write the failing test**

Append inside the `describe('sprite data', ...)` of `src/render/spriteData.test.ts`:
```ts
  it('has pipe, warp block and 1-up sprites', () => {
    for (const name of ['pipeTL', 'pipeTR', 'pipeL', 'pipeR', 'warpBlock', 'mushroomOneUp'] as const) {
      expect(SPRITES[name]).toHaveLength(8);
    }
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `yarn vitest run src/render/spriteData.test.ts`
Expected: FAIL (TypeError / type error: names missing).

- [ ] **Step 3: Add the sprites**

In `src/render/spriteData.ts`, add these entries to the `SPRITES` object (before the closing `} as const satisfies ...`):
```ts
  pipeTL: [
    'kkkkkkkk',
    'kggGGGGG',
    'kggGGGGG',
    'kkkkkkkk',
    '.kggGGGG',
    '.kggGGGG',
    '.kggGGGG',
    '.kggGGGG',
  ],
  pipeTR: [
    'kkkkkkkk',
    'GGGGGGGk',
    'GGGGGGGk',
    'kkkkkkkk',
    'GGGGGGk.',
    'GGGGGGk.',
    'GGGGGGk.',
    'GGGGGGk.',
  ],
  pipeL: [
    '.kggGGGG',
    '.kggGGGG',
    '.kggGGGG',
    '.kggGGGG',
    '.kggGGGG',
    '.kggGGGG',
    '.kggGGGG',
    '.kggGGGG',
  ],
  pipeR: [
    'GGGGGGk.',
    'GGGGGGk.',
    'GGGGGGk.',
    'GGGGGGk.',
    'GGGGGGk.',
    'GGGGGGk.',
    'GGGGGGk.',
    'GGGGGGk.',
  ],
  warpBlock: [
    'kkkkkkkk',
    'kggGGGGk',
    'kggGGGGk',
    'kkkkkkkk',
    'kggGGGGk',
    'kggGGGGk',
    'kGGGGGGk',
    'kkkkkkkk',
  ],
  mushroomOneUp: [
    '..GGGG..',
    '.GwGGwG.',
    'GGwGGwGG',
    'GGGGGGGG',
    '.wwssww.',
    '..wssw..',
    '..wssw..',
    '...ww...',
  ],
```

- [ ] **Step 4: Run all tests and typecheck**

Run: `yarn test && yarn typecheck`
Expected: pass (the generic "rectangular grid of known colors" test now also covers the new sprites).

- [ ] **Step 5: Commit**

```bash
git add src/render
git commit -m "Add pipe, warp block and 1-up sprites

Art lands first so tile and entity types can reference real sprites as they are introduced."
```

---

### Task 4: Type groundwork (no behavior change)

All the type additions the feature needs, plus the mechanical edits that keep the project compiling. No new behavior: the existing suite is the check.

**Files:**
- Modify: `src/core/types.ts` (full replacement), `src/core/state.ts`, `src/core/mushrooms.ts`, `src/core/mushrooms.test.ts`, `src/levels/format.ts`, `src/audio/synth.ts`, `src/render/renderer.ts`

**Interfaces:**
- Produces: `Tile` gains `pipeTL | pipeTR | pipeL | pipeR | hiddenCoin | hiddenOneUp | hiddenMushroom | hiddenWarp | warpBlock`; `Mouth`, `Warp`, `SecretWarp`, `ColumnRange`; `Level.mouths/warps/secretWarps/dark`; `Mushroom.kind: 'grow' | 'oneUp'`; `EventType` gains `'warp'`; `Phase` gains `'warping'`; `GameState.prevDown: boolean` and `GameState.warp: { to: number; teleported: boolean } | null`; `makeMushroom(col, row, kind = 'grow')`.

- [ ] **Step 1: Replace `src/core/types.ts`**

```ts
export type Tile =
  | 'empty' | 'solid' | 'brick' | 'coinBlock' | 'mushroomBlock' | 'used'
  | 'pipeTL' | 'pipeTR' | 'pipeL' | 'pipeR'
  | 'hiddenCoin' | 'hiddenOneUp' | 'hiddenMushroom' | 'hiddenWarp' | 'warpBlock';

export interface Cell {
  col: number;
  row: number;
}

/** A labelled pipe mouth: the top-left cell of a pipe. */
export interface Mouth {
  id: number;
  col: number;
  row: number;
}

export interface Warp {
  from: number;
  to: number;
}

/** A hidden warp block at (col, row) that, once revealed, enters mouth `to`. */
export interface SecretWarp {
  col: number;
  row: number;
  to: number;
}

export interface ColumnRange {
  from: number;
  to: number;
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
  mouths: Mouth[];
  warps: Warp[];
  secretWarps: SecretWarp[];
  dark: ColumnRange[];
}

export interface Input {
  left: boolean;
  right: boolean;
  jump: boolean;
  run: boolean;
  down: boolean;
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
  kind: 'grow' | 'oneUp';
  dir: 1 | -1;
  onGround: boolean;
}

export type EventType =
  | 'jump' | 'coin' | 'stomp' | 'kick' | 'sprout' | 'powerup'
  | 'shrink' | 'bump' | 'break' | 'death' | 'flag' | 'oneup' | 'warp';

export interface GameEvent {
  type: EventType;
}

export type Phase = 'title' | 'playing' | 'dying' | 'levelClear' | 'gameOver' | 'won' | 'warping';

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
  prevDown: boolean;
  warp: { to: number; teleported: boolean } | null;
  events: GameEvent[];
}
```

- [ ] **Step 2: Fix the compile errors this causes**

`src/core/state.ts`: in `createGame`'s state literal, directly after `prevJump: false,` add:
```ts
    prevDown: false,
    warp: null,
```
and in `loadLevel`, directly after `s.cameraX = 0;` add `s.warp = null;`.

`src/core/mushrooms.ts`: replace `makeMushroom` with:
```ts
/** A mushroom resting on top of block cell (col, row), heading right. */
export function makeMushroom(col: number, row: number, kind: Mushroom['kind'] = 'grow'): Mushroom {
  return { x: col + 0.1, y: row - 0.8, w: 0.8, h: 0.8, vx: MUSHROOM_SPEED, vy: 0, kind, dir: 1, onGround: false };
}
```
`src/core/mushrooms.test.ts`: in the `overlapping` helper change the pushed literal to include `kind: 'grow'`:
```ts
    s.mushrooms.push({ x: 1.1, y: 4.2, w: 0.8, h: 0.8, vx: 0, vy: 0, kind: 'grow', dir: 1, onGround: true });
```
`src/levels/format.ts`: in the `level: Level = { ... }` literal inside `parseLevel`, after `coins: [],` add `mouths: [], warps: [], secretWarps: [], dark: [],`.

`src/audio/synth.ts`: add to `SOUNDS` after the `oneup` line:
```ts
  warp: [[392, 0.06, 'square'], [330, 0.06, 'square'], [262, 0.06, 'square'], [196, 0.14, 'square']],
```
`src/render/renderer.ts`: replace the `TILE_SPRITE` constant with:
```ts
const TILE_SPRITE: Record<Tile, SpriteName | null> = {
  empty: null,
  solid: 'ground',
  brick: 'brick',
  coinBlock: 'question',
  mushroomBlock: 'question',
  used: 'used',
  pipeTL: 'pipeTL',
  pipeTR: 'pipeTR',
  pipeL: 'pipeL',
  pipeR: 'pipeR',
  hiddenCoin: null,
  hiddenOneUp: null,
  hiddenMushroom: null,
  hiddenWarp: null,
  warpBlock: 'warpBlock',
};
```

- [ ] **Step 3: Run all tests and typecheck**

Run: `yarn test && yarn typecheck`
Expected: all pass, typecheck clean. (Pipe and hidden tiles cannot appear in any level yet.)

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Add the types the secrets and warps feature needs

Landing all type changes in one behavior-free step keeps later red-green cycles about behavior, not compile fallout."
```

---

### Task 5: Level format — pipes, hidden blocks, footer

**Files:**
- Modify: `src/levels/format.ts` (full replacement), `src/testing/level-text.ts`, `src/testing/helpers.ts`
- Test: `src/levels/format.test.ts` (append)

**Interfaces:**
- Consumes: types from Task 4.
- Produces: `parseLevel` / `serializeLevel` with the new glyphs and footer; `levelText(width, edits, rows, footer)`; `pipeEdits(col, mouth, top = 3): Edit[]` (re-exported from helpers along with `type Edit`).

- [ ] **Step 1: Write the failing tests**

Append to `src/levels/format.test.ts` (add `import { levelText, pipeEdits } from '../testing/level-text';` at the top):
```ts
describe('pipes and warps', () => {
  const PIPES = levelText(20, [...pipeEdits(3, '1'), ...pipeEdits(10, '2')], 6, ['warp 1 -> 2']);

  it('reads pipe pieces, mouth ids and warps', () => {
    const level = parseLevel(PIPES);
    expect(level.tiles[3][3]).toBe('pipeTL');
    expect(level.tiles[3][4]).toBe('pipeTR');
    expect(level.tiles[4][3]).toBe('pipeL');
    expect(level.tiles[4][4]).toBe('pipeR');
    expect(level.mouths).toEqual([{ id: 1, col: 3, row: 3 }, { id: 2, col: 10, row: 3 }]);
    expect(level.warps).toEqual([{ from: 1, to: 2 }]);
  });

  it('treats a plain < pipe as a mouth with no id', () => {
    const level = parseLevel(levelText(12, pipeEdits(3, '<')));
    expect(level.tiles[3][3]).toBe('pipeTL');
    expect(level.mouths).toEqual([]);
  });

  it('round-trips pipes, mouths and warps', () => {
    expect(serializeLevel(parseLevel(PIPES))).toBe(PIPES);
  });

  it('rejects a pipe top without its right half', () => {
    expect(() => parseLevel(levelText(12, [[3, 3, '<']]))).toThrow(/Malformed pipe/);
  });

  it('rejects pipe body with no top above it', () => {
    expect(() => parseLevel(levelText(12, [[3, 4, '('], [4, 4, ')']]))).toThrow(/Malformed pipe/);
  });

  it('rejects duplicate mouth ids', () => {
    const edits = [...pipeEdits(3, '1'), ...pipeEdits(8, '1')];
    expect(() => parseLevel(levelText(14, edits))).toThrow(/Duplicate mouth id 1/);
  });

  it('rejects a warp naming an unknown mouth', () => {
    const text = levelText(12, pipeEdits(3, '1'), 6, ['warp 1 -> 9']);
    expect(() => parseLevel(text)).toThrow(/unknown mouth 9/);
  });

  it('rejects an unknown footer line', () => {
    expect(() => parseLevel(levelText(12, [], 6, ['bogus']))).toThrow(/Unknown footer line/);
  });
});

describe('hidden blocks and secrets', () => {
  it('reads hidden block glyphs and round-trips them', () => {
    const text = levelText(12, [[3, 3, 'h'], [4, 3, 'u'], [5, 3, 'm']]);
    const level = parseLevel(text);
    expect(level.tiles[3].slice(3, 6)).toEqual(['hiddenCoin', 'hiddenOneUp', 'hiddenMushroom']);
    expect(serializeLevel(level)).toBe(text);
  });

  it('links a hidden warp block to a mouth through a secret line', () => {
    const text = levelText(30, [[5, 3, 'w'], ...pipeEdits(20, '2')], 6, ['secret 1 -> 2']);
    const level = parseLevel(text);
    expect(level.tiles[3][5]).toBe('hiddenWarp');
    expect(level.secretWarps).toEqual([{ col: 5, row: 3, to: 2 }]);
    expect(serializeLevel(level)).toBe(text);
  });

  it('numbers secret lines in reading order', () => {
    const text = levelText(
      30,
      [[5, 2, 'w'], [9, 3, 'w'], ...pipeEdits(20, '2'), ...pipeEdits(24, '3')],
      6,
      ['secret 1 -> 3', 'secret 2 -> 2'],
    );
    expect(parseLevel(text).secretWarps).toEqual([
      { col: 5, row: 2, to: 3 },
      { col: 9, row: 3, to: 2 },
    ]);
  });

  it('rejects a hidden warp block with no secret line', () => {
    expect(() => parseLevel(levelText(12, [[5, 3, 'w']]))).toThrow(/needs a 'secret 1' line/);
  });

  it('rejects a secret line with no hidden warp block', () => {
    const text = levelText(12, pipeEdits(3, '2'), 6, ['secret 1 -> 2']);
    expect(() => parseLevel(text)).toThrow(/no matching hidden warp/);
  });
});

describe('dark ranges', () => {
  it('reads and round-trips dark column ranges', () => {
    const text = levelText(30, [], 6, ['dark 20-29']);
    const level = parseLevel(text);
    expect(level.dark).toEqual([{ from: 20, to: 29 }]);
    expect(serializeLevel(level)).toBe(text);
  });

  it('rejects a range outside the level', () => {
    expect(() => parseLevel(levelText(12, [], 6, ['dark 5-99']))).toThrow(/outside the level/);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `yarn vitest run src/levels/format.test.ts`
Expected: FAIL (`pipeEdits` missing, glyphs unknown).

- [ ] **Step 3: Update the test-level helpers**

Replace `src/testing/level-text.ts` with:
```ts
export type Edit = [col: number, row: number, glyph: string];

/**
 * Builds level text: `rows` rows (default 6), ground on the last row,
 * `P` at (1, rows-2), `F` at (width-1, rows-2). Edits are applied last.
 * `footer` lines (warp/secret/dark) are appended after a `---` line.
 */
export function levelText(width: number, edits: Edit[] = [], rows = 6, footer: string[] = []): string {
  const grid = Array.from({ length: rows }, () => Array<string>(width).fill('.'));
  grid[rows - 1].fill('#');
  grid[rows - 2][1] = 'P';
  grid[rows - 2][width - 1] = 'F';
  for (const [col, row, glyph] of edits) grid[row][col] = glyph;
  const body = grid.map((row) => row.join('')).join('\n');
  return footer.length > 0 ? `${body}\n---\n${footer.join('\n')}` : body;
}

/** Edits that set glyph on cols from..to (inclusive) of one row. */
export function span(from: number, to: number, row: number, glyph: string): Edit[] {
  return Array.from({ length: to - from + 1 }, (_, i): Edit => [from + i, row, glyph]);
}

/**
 * Edits for a 2-wide, 2-tall pipe: mouth (`<` or a digit id) on row `top`
 * (default 3) and body on the row below. On the default ground a player
 * standing on it has y = 2.
 */
export function pipeEdits(col: number, mouth: string, top = 3): Edit[] {
  return [
    [col, top, mouth],
    [col + 1, top, '>'],
    [col, top + 1, '('],
    [col + 1, top + 1, ')'],
  ];
}
```
In `src/testing/helpers.ts` change the re-export line to:
```ts
export { levelText, pipeEdits, span, type Edit } from './level-text';
```

- [ ] **Step 4: Replace `src/levels/format.ts`**

```ts
import type { Cell, Level, Tile } from '../core/types';

const GLYPH_TO_TILE: Record<string, Tile> = {
  '.': 'empty',
  '#': 'solid',
  B: 'brick',
  '?': 'coinBlock',
  M: 'mushroomBlock',
  '<': 'pipeTL',
  '>': 'pipeTR',
  '(': 'pipeL',
  ')': 'pipeR',
  h: 'hiddenCoin',
  u: 'hiddenOneUp',
  m: 'hiddenMushroom',
  w: 'hiddenWarp',
};

const TILE_TO_GLYPH: Partial<Record<Tile, string>> = {
  empty: '.',
  solid: '#',
  brick: 'B',
  coinBlock: '?',
  mushroomBlock: 'M',
  pipeTL: '<',
  pipeTR: '>',
  pipeL: '(',
  pipeR: ')',
  hiddenCoin: 'h',
  hiddenOneUp: 'u',
  hiddenMushroom: 'm',
  hiddenWarp: 'w',
};

const MOUTH_GLYPH = /^[1-9]$/;

function validatePipes(tiles: Tile[][]): void {
  const at = (col: number, row: number): Tile | undefined => tiles[row]?.[col];
  tiles.forEach((tileRow, row) => {
    tileRow.forEach((tile, col) => {
      const above = at(col, row - 1);
      const ok =
        tile === 'pipeTL' ? at(col + 1, row) === 'pipeTR'
        : tile === 'pipeTR' ? at(col - 1, row) === 'pipeTL'
        : tile === 'pipeL' ? (above === 'pipeTL' || above === 'pipeL') && at(col + 1, row) === 'pipeR'
        : tile === 'pipeR' ? (above === 'pipeTR' || above === 'pipeR') && at(col - 1, row) === 'pipeL'
        : true;
      if (!ok) throw new Error(`Malformed pipe at row ${row}, col ${col}`);
    });
  });
}

function parseFooter(level: Level, footer: string[], hiddenWarps: Cell[]): void {
  const mouthIds = new Set(level.mouths.map((mouth) => mouth.id));
  const secrets = new Map<number, number>();

  for (const line of footer) {
    let match: RegExpMatchArray | null;
    if ((match = line.match(/^warp (\d+) -> (\d+)$/))) {
      const from = Number(match[1]);
      const to = Number(match[2]);
      for (const id of [from, to]) {
        if (!mouthIds.has(id)) throw new Error(`warp references unknown mouth ${id}`);
      }
      level.warps.push({ from, to });
    } else if ((match = line.match(/^secret (\d+) -> (\d+)$/))) {
      const n = Number(match[1]);
      const to = Number(match[2]);
      if (n < 1 || n > hiddenWarps.length) throw new Error(`secret ${n} has no matching hidden warp block`);
      if (secrets.has(n)) throw new Error(`secret ${n} is declared twice`);
      if (!mouthIds.has(to)) throw new Error(`secret ${n} references unknown mouth ${to}`);
      secrets.set(n, to);
    } else if ((match = line.match(/^dark (\d+)-(\d+)$/))) {
      const from = Number(match[1]);
      const to = Number(match[2]);
      if (from > to || to >= level.width) throw new Error(`dark range ${from}-${to} is outside the level`);
      level.dark.push({ from, to });
    } else {
      throw new Error(`Unknown footer line: ${line}`);
    }
  }

  hiddenWarps.forEach((cell, i) => {
    const to = secrets.get(i + 1);
    if (to === undefined) {
      throw new Error(`Hidden warp block at row ${cell.row}, col ${cell.col} needs a 'secret ${i + 1}' line`);
    }
    level.secretWarps.push({ col: cell.col, row: cell.row, to });
  });
}

export function parseLevel(text: string): Level {
  const lines = text.split('\n').map((line) => line.trimEnd());
  const separator = lines.indexOf('---');
  const rows = (separator === -1 ? lines : lines.slice(0, separator)).filter((row) => row.length > 0);
  const footer = (separator === -1 ? [] : lines.slice(separator + 1)).filter((line) => line.length > 0);
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
    mouths: [],
    warps: [],
    secretWarps: [],
    dark: [],
  };
  const hiddenWarps: Cell[] = [];
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
      if (MOUTH_GLYPH.test(glyph)) {
        const id = Number(glyph);
        if (level.mouths.some((mouth) => mouth.id === id)) throw new Error(`Duplicate mouth id ${id}`);
        level.mouths.push({ id, col, row });
        tileRow.push('pipeTL');
        return;
      }
      const tile = GLYPH_TO_TILE[glyph];
      if (tile === undefined) {
        throw new Error(`Unknown glyph '${glyph}' at row ${row}, col ${col}`);
      }
      if (tile === 'hiddenWarp') hiddenWarps.push(cell);
      tileRow.push(tile);
    });
    level.tiles.push(tileRow);
  });

  if (starts !== 1) throw new Error(`Level needs exactly one P (found ${starts})`);
  if (flags !== 1) throw new Error(`Level needs exactly one F (found ${flags})`);
  validatePipes(level.tiles);
  parseFooter(level, footer, hiddenWarps);
  return level;
}

export function serializeLevel(level: Level): string {
  const mouthIds = new Map(level.mouths.map((mouth) => [`${mouth.col},${mouth.row}`, mouth.id]));
  const grid = level.tiles.map((row, r) =>
    row.map((tile, c) => {
      const mouthId = tile === 'pipeTL' ? mouthIds.get(`${c},${r}`) : undefined;
      if (mouthId !== undefined) return String(mouthId);
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

  const footer = [
    ...[...level.warps]
      .sort((a, b) => a.from - b.from || a.to - b.to)
      .map((warp) => `warp ${warp.from} -> ${warp.to}`),
    ...level.secretWarps.map((secret, i) => `secret ${i + 1} -> ${secret.to}`),
    ...[...level.dark].sort((a, b) => a.from - b.from).map((range) => `dark ${range.from}-${range.to}`),
  ];
  const body = grid.map((row) => row.join('')).join('\n');
  return footer.length > 0 ? `${body}\n---\n${footer.join('\n')}` : body;
}
```

- [ ] **Step 5: Run all tests and typecheck**

Run: `yarn test && yarn typecheck`
Expected: all pass, including the original format tests (old levels parse unchanged).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Teach the level format pipes, hidden blocks and a link footer

Warps, secret links and dark rooms live in the same plain text so levels stay editable and round-trippable."
```

---

### Task 6: Hidden-tile collision

**Files:**
- Modify: `src/core/physics.ts` (full replacement), `src/core/player.ts` (one line)
- Test: `src/core/physics.test.ts` (append), `src/core/player.test.ts` (append)

**Interfaces:**
- Consumes: hidden `Tile` kinds.
- Produces: `moveBody(b: Body, tiles: Tile[][], options?: MoveOptions): MoveResult` with `interface MoveOptions { bumpHidden?: boolean }`. `solidAt` treats hidden tiles as not solid. With `bumpHidden`, a body moving up whose head began the tick at or below a hidden tile's bottom edge is stopped under it and the tile is reported as `bonk`.

- [ ] **Step 1: Write the failing tests**

Append to `src/core/physics.test.ts`:
```ts
describe('hidden tiles', () => {
  const hidden = () => tilesOf(levelText(10, [[5, 3, 'h']]));

  it('are not solid to sideways movement', () => {
    const tiles = tilesOf(levelText(10, [[5, 4, 'h']]));
    const b = body({ x: 3, y: 4 });
    let hit = false;
    for (let i = 0; i < 40; i++) {
      b.vx = 8;
      hit ||= moveBody(b, tiles).hitX;
    }
    expect(hit).toBe(false);
    expect(b.x).toBeGreaterThan(6);
  });

  it('are not solid to a falling body', () => {
    const b = body({ x: 5.1, y: 1, vy: 10 });
    let landed = false;
    for (let i = 0; i < 80 && !landed; i++) landed = moveBody(b, hidden()).landed;
    expect(landed).toBe(true);
    expect(b.y).toBeCloseTo(4);
  });

  it('are bumped from below when bumpHidden is on', () => {
    const b = body({ x: 5.1, y: 4, vy: -10 });
    const result = moveBody(b, hidden(), { bumpHidden: true });
    expect(result.bonk).toEqual({ col: 5, row: 3 });
    expect(b.y).toBeCloseTo(4);
    expect(b.vy).toBe(0);
  });

  it('are passed through from below when bumpHidden is off', () => {
    const b = body({ x: 5.1, y: 4, vy: -10 });
    const result = moveBody(b, hidden());
    expect(result.bonk).toBeNull();
    expect(b.y).toBeLessThan(4);
  });

  it('are ignored when the head is already inside the tile', () => {
    const b = body({ x: 5.1, y: 3.5, vy: -1 });
    const result = moveBody(b, hidden(), { bumpHidden: true });
    expect(result.bonk).toBeNull();
  });
});
```
Append to `src/core/player.test.ts` (inside the file, as a new describe):
```ts
describe('hidden blocks and the player', () => {
  it('lets the player walk straight through a hidden block', () => {
    const s = playing(levelText(30, [[5, 4, 'h']]));
    tick(s, { right: true, run: true }, 60);
    expect(s.player.x).toBeGreaterThan(6.5);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `yarn vitest run src/core/physics.test.ts src/core/player.test.ts`
Expected: FAIL (hidden tiles are currently solid; no `options` parameter).

- [ ] **Step 3: Replace `src/core/physics.ts`**

```ts
import { DT } from './constants';
import type { Body, Cell, Rect, Tile } from './types';

const EPS = 1e-6;

const HIDDEN: ReadonlySet<Tile> = new Set<Tile>(['hiddenCoin', 'hiddenOneUp', 'hiddenMushroom', 'hiddenWarp']);

export interface MoveResult {
  hitX: boolean;
  landed: boolean;
  bonk: Cell | null;
}

export interface MoveOptions {
  /** Let an upward-moving head bump hidden tiles from below (the player only). */
  bumpHidden?: boolean;
}

export function solidAt(tiles: Tile[][], col: number, row: number): boolean {
  if (col < 0 || col >= tiles[0].length) return true;
  if (row < 0 || row >= tiles.length) return false;
  const tile = tiles[row][col];
  return tile !== 'empty' && !HIDDEN.has(tile);
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

/** The hidden tile the head just rose into from below, if any. */
function hiddenBumpCell(b: Body, previousY: number, tiles: Tile[][]): Cell | null {
  const row = Math.floor(b.y);
  if (row < 0 || row >= tiles.length) return null;
  if (previousY < row + 1 - EPS) return null; // the head started inside the tile
  const center = b.x + b.w / 2;
  let best: Cell | null = null;
  let bestDistance = Infinity;
  for (let col = Math.floor(b.x); col <= Math.floor(b.x + b.w - EPS); col++) {
    const tile = tiles[row]?.[col];
    if (tile === undefined || !HIDDEN.has(tile)) continue;
    const distance = Math.abs(col + 0.5 - center);
    if (distance < bestDistance) {
      best = { col, row };
      bestDistance = distance;
    }
  }
  return best;
}

/** Moves one tick: X axis first, then Y. Mutates the body. */
export function moveBody(b: Body, tiles: Tile[][], options: MoveOptions = {}): MoveResult {
  const result: MoveResult = { hitX: false, landed: false, bonk: null };

  b.x += b.vx * DT;
  if (b.vx !== 0 && overlapsSolid(b, tiles)) {
    b.x = b.vx > 0 ? Math.floor(b.x + b.w - EPS) - b.w : Math.floor(b.x) + 1;
    b.vx = 0;
    result.hitX = true;
  }

  const previousY = b.y;
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
  } else if (options.bumpHidden && b.vy < 0) {
    const cell = hiddenBumpCell(b, previousY, tiles);
    if (cell) {
      result.bonk = cell;
      b.y = cell.row + 1;
      b.vy = 0;
    }
  }
  return result;
}

export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
```
In `src/core/player.ts` change `const result = moveBody(p, s.tiles);` to `const result = moveBody(p, s.tiles, { bumpHidden: true });`.

- [ ] **Step 4: Run all tests and typecheck**

Run: `yarn test && yarn typecheck`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Make hidden tiles solid only to a head bump from below

Classic hidden blocks must not trap players walking or falling through them; only the player's upward bump may find them."
```

---

### Task 7: Reveal hidden blocks and the 1-up mushroom

**Files:**
- Modify: `src/core/blocks.ts` (full replacement), `src/core/mushrooms.ts` (collectMushrooms)
- Test: `src/core/blocks.test.ts` (append), `src/core/mushrooms.test.ts` (append)

**Interfaces:**
- Consumes: `bonk` from hidden bumps (Task 6); `makeMushroom(col, row, kind)`.
- Produces: `hitBlock` reveals `hiddenCoin` (-> `used`, coin), `hiddenOneUp` (-> `used`, 1-up mushroom), `hiddenMushroom` (-> `used`, grow mushroom), `hiddenWarp` (-> `warpBlock`); collecting a `oneUp` mushroom adds a life.

- [ ] **Step 1: Write the failing tests**

Append to `src/core/blocks.test.ts` (add `pipeEdits` to the helpers import at the top: `import { collect, levelText, pipeEdits, playing, tick } from '../testing/helpers';`):
```ts
describe('hidden blocks', () => {
  it('a hidden coin block pays a coin and becomes used', () => {
    const s = underBlock('h');
    const events = collect(s, { jump: true }, 3);
    expect(s.tiles[3][5]).toBe('used');
    expect(s.coins).toBe(1);
    expect(events).toContain('coin');
  });

  it('a hidden 1-up block releases a 1-up mushroom', () => {
    const s = underBlock('u');
    const events = collect(s, { jump: true }, 3);
    expect(s.tiles[3][5]).toBe('used');
    expect(s.mushrooms).toHaveLength(1);
    expect(s.mushrooms[0].kind).toBe('oneUp');
    expect(events).toContain('sprout');
  });

  it('a hidden power-up block releases a normal mushroom', () => {
    const s = underBlock('m');
    collect(s, { jump: true }, 3);
    expect(s.tiles[3][5]).toBe('used');
    expect(s.mushrooms[0].kind).toBe('grow');
  });

  it('a hidden warp block turns into a solid warp block', () => {
    const s = playing(levelText(30, [[5, 3, 'w'], ...pipeEdits(20, '2')], 6, ['secret 1 -> 2']));
    tick(s, {}, 3);
    s.player.x = 5.1;
    tick(s, {}, 3);
    const events = collect(s, { jump: true }, 3);
    expect(s.tiles[3][5]).toBe('warpBlock');
    expect(events).toContain('sprout');
  });

  it('stays hidden until bumped from below', () => {
    const s = playing(levelText(30, [[5, 3, 'h']]));
    tick(s, { right: true }, 20);
    expect(s.tiles[3][5]).toBe('hiddenCoin');
  });
});
```
Append to `src/core/mushrooms.test.ts` (add `START_LIVES` import: `import { START_LIVES } from './constants';`):
```ts
describe('the 1-up mushroom', () => {
  it('adds a life without growing the player or scoring', () => {
    const s = playing(levelText(30));
    tick(s, {}, 3);
    s.mushrooms.push({ x: 1.1, y: 4.2, w: 0.8, h: 0.8, vx: 0, vy: 0, kind: 'oneUp', dir: 1, onGround: true });
    const events = collect(s, {}, 1);
    expect(s.lives).toBe(START_LIVES + 1);
    expect(s.player.size).toBe('small');
    expect(s.score).toBe(0);
    expect(s.mushrooms).toHaveLength(0);
    expect(events).toContain('oneup');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `yarn vitest run src/core/blocks.test.ts src/core/mushrooms.test.ts`
Expected: FAIL (hidden blocks do nothing; 1-up grows/scores like a normal mushroom).

- [ ] **Step 3: Implement**

Replace `src/core/blocks.ts` with:
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
    case 'hiddenCoin':
      s.tiles[row][col] = 'used';
      addCoin(s);
      break;
    case 'mushroomBlock':
    case 'hiddenMushroom':
      s.tiles[row][col] = 'used';
      s.mushrooms.push(makeMushroom(col, row));
      emit(s, 'sprout');
      break;
    case 'hiddenOneUp':
      s.tiles[row][col] = 'used';
      s.mushrooms.push(makeMushroom(col, row, 'oneUp'));
      emit(s, 'sprout');
      break;
    case 'hiddenWarp':
      s.tiles[row][col] = 'warpBlock';
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
In `src/core/mushrooms.ts` replace `collectMushrooms` with:
```ts
export function collectMushrooms(s: GameState): void {
  const p = s.player;
  s.mushrooms = s.mushrooms.filter((m) => {
    if (!overlaps(p, m)) return true;
    if (m.kind === 'oneUp') {
      s.lives += 1;
      emit(s, 'oneup');
      return false;
    }
    s.score += POINTS.mushroom;
    growPlayer(p);
    emit(s, 'powerup');
    return false;
  });
}
```

- [ ] **Step 4: Run all tests and typecheck**

Run: `yarn test && yarn typecheck`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Reveal hidden blocks and add the 1-up mushroom

Secrets need payoffs: coins, a life, a power-up, or a one-tile pipe to a bonus room."
```

---

### Task 8: Warping

**Files:**
- Create: `src/core/warp.ts`
- Modify: `src/core/constants.ts`, `src/core/game.ts`
- Test: `src/core/warp.test.ts`

**Interfaces:**
- Consumes: `Level.mouths/warps/secretWarps`, `GameState.warp/prevDown`, `Input.down`, `pipeEdits`.
- Produces: `tryStartWarp(s: GameState, input: Input): boolean`; `stepWarping(s: GameState): void`; constants `WARP_SINK_TIME = 0.4`, `WARP_EMERGE_TIME = 0.4`.

- [ ] **Step 1: Write the failing tests**

Create `src/core/warp.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { collect, levelText, pipeEdits, playing, tick } from '../testing/helpers';
import { DT, WARP_EMERGE_TIME, WARP_SINK_TIME } from './constants';

const WARP_TICKS = Math.ceil((WARP_SINK_TIME + WARP_EMERGE_TIME) / DT) + 3;

/** 40 wide: pipe 1 at col 8 warps to pipe 2 at col 30. */
const TWO_PIPES = levelText(40, [...pipeEdits(8, '1'), ...pipeEdits(30, '2')], 6, ['warp 1 -> 2']);

/** A game with the player standing on the mouth of the pipe whose left column is `col`. */
function onPipe(text: string, col: number) {
  const s = playing(text);
  s.player.x = col + 1 - s.player.w / 2;
  s.player.y = 2;
  tick(s, {}, 3);
  return s;
}

describe('entering a pipe', () => {
  it('starts a warp on a fresh Down press while standing on a linked mouth', () => {
    const s = onPipe(TWO_PIPES, 8);
    const events = collect(s, { down: true }, 1);
    expect(s.phase).toBe('warping');
    expect(events).toContain('warp');
  });

  it('ignores Down when the player is not centred on the mouth', () => {
    const s = onPipe(TWO_PIPES, 8);
    s.player.x = 9.7; // still resting on the pipe's edge, but centred beyond it
    tick(s, {}, 3);
    expect(s.player.onGround).toBe(true);
    tick(s, { down: true }, 1);
    expect(s.phase).toBe('playing');
  });

  it('ignores Down in the air', () => {
    const s = onPipe(TWO_PIPES, 8);
    s.player.onGround = false;
    tick(s, { down: true }, 1);
    expect(s.phase).toBe('playing');
  });

  it('ignores Down on a pipe with no warp', () => {
    const s = onPipe(levelText(40, [...pipeEdits(8, '1'), ...pipeEdits(30, '2')]), 8);
    tick(s, { down: true }, 1);
    expect(s.phase).toBe('playing');
  });

  it('needs a fresh press, not a held Down', () => {
    const s = onPipe(TWO_PIPES, 8);
    s.prevDown = true;
    tick(s, { down: true }, 1);
    expect(s.phase).toBe('playing');
    tick(s, {}, 1);
    tick(s, { down: true }, 1);
    expect(s.phase).toBe('warping');
  });
});

describe('the warp itself', () => {
  it('sinks, teleports and emerges standing on the destination pipe', () => {
    const s = onPipe(TWO_PIPES, 8);
    tick(s, { down: true }, 1);
    tick(s, {}, WARP_TICKS);
    expect(s.phase).toBe('playing');
    expect(s.warp).toBeNull();
    expect(s.player.x + s.player.w / 2).toBeCloseTo(31, 1);
    expect(s.player.y + s.player.h).toBeCloseTo(3, 1);
    expect(s.player.vx).toBe(0);
  });

  it('is in the warping phase for about 0.8 seconds', () => {
    const s = onPipe(TWO_PIPES, 8);
    tick(s, { down: true }, 1);
    tick(s, {}, 20);
    expect(s.phase).toBe('warping');
    tick(s, {}, WARP_TICKS);
    expect(s.phase).toBe('playing');
  });

  it('snaps the camera back to a destination behind it', () => {
    const text = levelText(60, [...pipeEdits(50, '1'), ...pipeEdits(5, '2')], 6, ['warp 1 -> 2']);
    const s = onPipe(text, 50);
    s.cameraX = 40;
    tick(s, { down: true }, 1);
    tick(s, {}, WARP_TICKS);
    expect(s.cameraX).toBe(0);
    expect(s.player.x).toBeGreaterThanOrEqual(s.cameraX);
  });

  it('freezes enemies and the clock while warping', () => {
    const text = levelText(40, [...pipeEdits(8, '1'), ...pipeEdits(30, '2'), [14, 4, 'g']], 6, ['warp 1 -> 2']);
    const s = onPipe(text, 8);
    tick(s, { down: true }, 1);
    const enemyX = s.enemies[0].x;
    const timeLeft = s.timeLeft;
    tick(s, {}, 10);
    expect(s.phase).toBe('warping');
    expect(s.enemies[0].x).toBe(enemyX);
    expect(s.timeLeft).toBe(timeLeft);
  });
});

describe('pipes and warp blocks', () => {
  it('blocks the player like a wall', () => {
    const s = playing(levelText(20, pipeEdits(8, '<')));
    tick(s, { right: true, run: true }, 120);
    expect(s.player.x + s.player.w).toBeLessThanOrEqual(8 + 1e-6);
  });

  it('lets a revealed warp block be entered from above', () => {
    const text = levelText(30, [[8, 3, 'w'], ...pipeEdits(20, '2')], 6, ['secret 1 -> 2']);
    const s = playing(text);
    tick(s, {}, 3);
    s.player.x = 8.1;
    tick(s, {}, 3);
    tick(s, { jump: true }, 3); // bump from below: reveals the block
    expect(s.tiles[3][8]).toBe('warpBlock');
    s.player.x = 8.125;
    s.player.y = 2;
    s.player.vy = 0;
    tick(s, {}, 6);
    tick(s, { down: true }, 1);
    expect(s.phase).toBe('warping');
    tick(s, {}, WARP_TICKS);
    expect(s.player.x + s.player.w / 2).toBeCloseTo(21, 1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `yarn vitest run src/core/warp.test.ts`
Expected: FAIL (constants and phase handling missing).

- [ ] **Step 3: Implement**

Append to `src/core/constants.ts`:
```ts
export const WARP_SINK_TIME = 0.4;
export const WARP_EMERGE_TIME = 0.4;
```
Create `src/core/warp.ts`:
```ts
import { DT, VIEW_TILES_W, WARP_EMERGE_TIME, WARP_SINK_TIME } from './constants';
import { emit } from './events';
import type { GameState, Input, Level, Mouth } from './types';

const FEET_TOLERANCE = 0.05;

function currentLevel(s: GameState): Level {
  return s.levels[s.levelIndex];
}

function mouthById(s: GameState, id: number): Mouth {
  const mouth = currentLevel(s).mouths.find((m) => m.id === id);
  if (!mouth) throw new Error(`No pipe mouth ${id}`);
  return mouth;
}

/** The mouth id the player would emerge from if they entered right now, or null. */
function destination(s: GameState): number | null {
  const p = s.player;
  if (!p.onGround) return null;
  const level = currentLevel(s);
  const centerX = p.x + p.w / 2;
  const feet = p.y + p.h;

  for (const mouth of level.mouths) {
    const warp = level.warps.find((w) => w.from === mouth.id);
    if (!warp) continue;
    const centred = centerX >= mouth.col && centerX < mouth.col + 2;
    if (centred && Math.abs(feet - mouth.row) < FEET_TOLERANCE) return warp.to;
  }

  const col = Math.floor(centerX);
  const row = Math.round(feet);
  if (Math.abs(feet - row) < FEET_TOLERANCE && s.tiles[row]?.[col] === 'warpBlock') {
    const secret = level.secretWarps.find((w) => w.col === col && w.row === row);
    if (secret) return secret.to;
  }
  return null;
}

/** Starts a warp if Down was freshly pressed on an enterable pipe. Returns whether it did. */
export function tryStartWarp(s: GameState, input: Input): boolean {
  if (!input.down || s.prevDown) return false;
  const to = destination(s);
  if (to === null) return false;
  s.phase = 'warping';
  s.warp = { to, teleported: false };
  s.phaseTimer = WARP_SINK_TIME + WARP_EMERGE_TIME;
  s.player.vx = 0;
  s.player.vy = 0;
  emit(s, 'warp');
  return true;
}

function teleport(s: GameState, mouthId: number): void {
  const mouth = mouthById(s, mouthId);
  const p = s.player;
  p.x = mouth.col + 1 - p.w / 2;
  p.y = mouth.row; // top of the body level with the pipe's mouth: fully inside the pipe
  const max = Math.max(0, s.width - VIEW_TILES_W);
  s.cameraX = Math.min(max, Math.max(0, p.x + p.w / 2 - VIEW_TILES_W / 2));
}

/** One tick of the warp: sink, teleport at the halfway point, emerge. */
export function stepWarping(s: GameState): void {
  const warp = s.warp;
  if (!warp) {
    s.phase = 'playing';
    return;
  }
  const p = s.player;
  s.phaseTimer -= DT;

  if (!warp.teleported) {
    p.y += (p.h / WARP_SINK_TIME) * DT;
    if (s.phaseTimer <= WARP_EMERGE_TIME) {
      teleport(s, warp.to);
      warp.teleported = true;
    }
    return;
  }

  p.y -= (p.h / WARP_EMERGE_TIME) * DT;
  if (s.phaseTimer <= 0) {
    p.y = mouthById(s, warp.to).row - p.h;
    p.vx = 0;
    p.vy = 0;
    s.warp = null;
    s.phase = 'playing';
  }
}
```
In `src/core/game.ts`:
- add `import { stepWarping, tryStartWarp } from './warp';`
- at the very top of `stepPlaying` (before `s.timeLeft = ...`) add: `if (tryStartWarp(s, input)) return;`
- in the `switch` of `step`, add before the `'gameOver'` case:
```ts
    case 'warping':
      stepWarping(s);
      break;
```
- after `s.prevJump = input.jump;` add `s.prevDown = input.down;`

- [ ] **Step 4: Run all tests and typecheck**

Run: `yarn test && yarn typecheck`
Expected: all pass. If a timing assertion is off by a tick because of float rounding, adjust the test's tick margin, not the sink/emerge constants.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add warping through pipes and revealed warp blocks

A short sink/teleport/emerge phase freezes the world, so warps are readable and cannot be exploited mid-air or by holding Down."
```

---

### Task 9: Dark rooms — camera clamp, hidden rooms, rendering

**Files:**
- Create: `src/core/camera.ts`
- Modify: `src/core/game.ts`, `src/core/warp.ts`, `src/render/renderer.ts`
- Test: `src/core/camera.test.ts`

**Interfaces:**
- Produces: `updateCamera(s)`, `activeDarkRange(s): ColumnRange | undefined`, `clampToDarkRange(s)` in `src/core/camera.ts`.

- [ ] **Step 1: Write the failing tests**

Create `src/core/camera.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { levelText, pipeEdits, playing, tick } from '../testing/helpers';
import { DT, WARP_EMERGE_TIME, WARP_SINK_TIME } from './constants';
import { activeDarkRange } from './camera';

const WARP_TICKS = Math.ceil((WARP_SINK_TIME + WARP_EMERGE_TIME) / DT) + 3;

describe('dark rooms and the camera', () => {
  it('finds the dark range the player is in', () => {
    const s = playing(levelText(60, [], 6, ['dark 40-55']));
    expect(activeDarkRange(s)).toBeUndefined();
    s.player.x = 45;
    expect(activeDarkRange(s)).toEqual({ from: 40, to: 55 });
  });

  it('pins the camera to a room exactly as wide as the view', () => {
    const s = playing(levelText(60, [], 6, ['dark 40-55']));
    tick(s, {}, 3);
    s.player.x = 45;
    tick(s, {}, 1);
    expect(s.cameraX).toBe(40);
  });

  it('keeps the camera inside a wider room', () => {
    const s = playing(levelText(60, [], 6, ['dark 40-59']));
    tick(s, {}, 3);
    s.player.x = 57;
    tick(s, {}, 1);
    expect(s.cameraX).toBe(44);
  });

  it('puts the camera inside a room right after warping into it', () => {
    const text = levelText(60, [...pipeEdits(8, '1'), ...pipeEdits(48, '2')], 6, ['warp 1 -> 2', 'dark 44-59']);
    const s = playing(text);
    s.player.x = 8.625;
    s.player.y = 2;
    tick(s, {}, 3);
    tick(s, { down: true }, 1);
    tick(s, {}, WARP_TICKS);
    expect(s.cameraX).toBe(44);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `yarn vitest run src/core/camera.test.ts`
Expected: FAIL — cannot resolve `./camera`.

- [ ] **Step 3: Implement the core part**

Create `src/core/camera.ts`:
```ts
import { VIEW_TILES_W } from './constants';
import type { ColumnRange, GameState } from './types';

/** The dark (bonus room) column range containing the player's centre column, if any. */
export function activeDarkRange(s: GameState): ColumnRange | undefined {
  const col = Math.floor(s.player.x + s.player.w / 2);
  return s.levels[s.levelIndex].dark.find((range) => col >= range.from && col <= range.to);
}

/** Keeps the camera inside the dark room the player is in, so nothing outside it is in view. */
export function clampToDarkRange(s: GameState): void {
  const range = activeDarkRange(s);
  if (!range) return;
  const low = range.from;
  const high = Math.max(low, range.to + 1 - VIEW_TILES_W);
  s.cameraX = Math.min(high, Math.max(low, s.cameraX));
}

export function updateCamera(s: GameState): void {
  const target = s.player.x + s.player.w / 2 - VIEW_TILES_W / 2;
  const max = Math.max(0, s.width - VIEW_TILES_W);
  s.cameraX = Math.min(max, Math.max(s.cameraX, target));
  clampToDarkRange(s);
}
```
In `src/core/game.ts`: delete the local `updateCamera` function and the now-unused `VIEW_TILES_W` import, and add `import { updateCamera } from './camera';`.
In `src/core/warp.ts`: add `import { clampToDarkRange } from './camera';` and, at the end of `teleport` (after the `s.cameraX = ...` line) add `clampToDarkRange(s);`.

- [ ] **Step 4: Run all tests and typecheck**

Run: `yarn test && yarn typecheck`
Expected: all pass.

- [ ] **Step 5: Commit the core change**

```bash
git add -A
git commit -m "Keep the camera inside bonus rooms

A room is meant to be a sealed space; clamping the camera stops it from revealing the level outside."
```

- [ ] **Step 6: Renderer changes (verified in the browser in Task 12; no unit test)**

In `src/render/renderer.ts`:

a) Add import: `import { activeDarkRange } from '../core/camera';`

b) Add this helper below `blitBody`:
```ts
/** Columns of a dark room are drawn only while the player is inside that same room. */
function colVisible(s: GameState, col: number): boolean {
  const inDark = s.levels[s.levelIndex].dark.some((range) => col >= range.from && col <= range.to);
  if (!inDark) return true;
  const active = activeDarkRange(s);
  return active !== undefined && col >= active.from && col <= active.to;
}
```

c) Change `drawBackground` to take a flag: replace its signature and first lines with
```ts
function drawBackground(ctx: CanvasRenderingContext2D, cam: number, dark: boolean): void {
  if (dark) {
    ctx.fillStyle = '#0a0a1e';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    return;
  }
  ctx.fillStyle = '#5c94fc';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
```
(leave the clouds and hills code that follows unchanged).

d) In `drawTiles`, inside the inner loop, add as the first line: `if (!colVisible(s, col)) continue;`

e) In `drawCoins`, change the loop body so hidden-room coins are skipped: start the loop with `for (const cell of s.coinPickups) { if (!colVisible(s, cell.col)) continue;` (keep the existing `blit` call).

f) Replace `drawMushrooms` and `drawEnemies` with:
```ts
function drawMushrooms(ctx: CanvasRenderingContext2D, s: GameState, sheet: SpriteSheet, cam: number): void {
  for (const m of s.mushrooms) {
    if (!colVisible(s, Math.floor(m.x))) continue;
    blitBody(ctx, sheet[m.kind === 'oneUp' ? 'mushroomOneUp' : 'mushroom'], m, cam, TILE, false);
  }
}

function drawEnemies(ctx: CanvasRenderingContext2D, s: GameState, sheet: SpriteSheet, cam: number): void {
  for (const e of s.enemies) {
    if (!colVisible(s, Math.floor(e.x))) continue;
    if (e.kind === 'walker') {
      blitBody(ctx, sheet.walker, e, cam, TILE, Math.floor(s.tick / 8) % 2 === 1);
    } else {
      const name = e.mode === 'walking' ? 'turtle' : 'shell';
      blitBody(ctx, sheet[name], e, cam, TILE, e.dir > 0);
    }
  }
}
```

g) Replace `render` with:
```ts
export function render(ctx: CanvasRenderingContext2D, s: GameState, sheet: SpriteSheet): void {
  ctx.imageSmoothingEnabled = false;
  const cam = Math.round(s.cameraX * TILE);
  drawBackground(ctx, cam, activeDarkRange(s) !== undefined);
  // While warping, the player is drawn first so the pipe tiles cover them.
  if (s.phase === 'warping') drawPlayer(ctx, s, sheet, cam);
  drawTiles(ctx, s, sheet, cam);
  drawCoins(ctx, s, sheet, cam);
  drawFlag(ctx, s, cam);
  drawMushrooms(ctx, s, sheet, cam);
  drawEnemies(ctx, s, sheet, cam);
  if (s.phase !== 'warping') drawPlayer(ctx, s, sheet, cam);
  drawHud(ctx, s);
  drawOverlay(ctx, s);
}
```

- [ ] **Step 7: Verify and commit**

Run: `yarn test && yarn typecheck && yarn build`
Expected: all pass, build ok.
```bash
git add -A
git commit -m "Render bonus rooms, pipes and warps

Rooms get a dark look and stay invisible from outside; the pipe covers the player as they sink and emerge."
```

---

### Task 10: Level builder helpers

**Files:**
- Modify: `src/levels/builder.ts` (full replacement)
- Test: `src/levels/builder.test.ts` (append)

**Interfaces:**
- Produces on `LevelBuilder` (all return `this`): `pipe(col, tall, id?)`, `stairs(col, steps, dir = 1)`, `platform(col, row, length, glyph = '#')`, `hidden(col, row, kind)` with `kind` in `'coin' | 'oneUp' | 'mushroom' | 'warp'`, `warp(from, to)`, `secret(n, to)`, `dark(from, to)`, `room(from, to)`. `toText()` emits the canonical footer (warps by `from`, secrets by `n`, dark by `from`). Existing methods unchanged.

Geometry: `pipe` stands on the ground: the mouth is on row `GROUND_ROW - tall`, body below; the mouth glyph is the digit `id` or `<`. `stairs(col, steps, 1)` makes heights 1..steps on cols `col..col+steps-1`; with `-1` the heights fall to the right (col `col` height 1, `col-1` height 2, ...). `room(from, to)` draws a sealed room: ceiling on rows 0-3, walls on cols `from` and `to` (all rows), floor via `ground(from, to)`, and registers `dark(from, to)`.

- [ ] **Step 1: Write the failing tests**

Append to `src/levels/builder.test.ts`:
```ts
describe('LevelBuilder: pipes, rooms and secrets', () => {
  const text = new LevelBuilder(40)
    .ground(0, 23)
    .start(1)
    .flag(22, 4)
    .pipe(5, 3, 1)
    .pipe(10, 2, 2)
    .warp(1, 2)
    .stairs(14, 3)
    .platform(16, 8, 2)
    .hidden(18, 8, 'coin')
    .room(24, 39)
    .toText();
  const level = parseLevel(text);

  it('builds pipes with labelled mouths standing on the ground', () => {
    expect(level.mouths).toEqual([{ id: 1, col: 5, row: 9 }, { id: 2, col: 10, row: 10 }]);
    expect(level.tiles[9][5]).toBe('pipeTL');
    expect(level.tiles[9][6]).toBe('pipeTR');
    expect(level.tiles[10][5]).toBe('pipeL');
    expect(level.tiles[11][6]).toBe('pipeR');
    expect(level.warps).toEqual([{ from: 1, to: 2 }]);
  });

  it('builds ascending stairs', () => {
    expect(level.tiles[11][14]).toBe('solid');
    expect(level.tiles[10][14]).toBe('empty');
    expect(level.tiles[10][15]).toBe('solid');
    expect(level.tiles[9][15]).toBe('empty');
    expect(level.tiles[9][16]).toBe('solid');
  });

  it('builds descending stairs with dir -1', () => {
    const down = parseLevel(new LevelBuilder(10).ground(0, 9).start(0).flag(9, 4).stairs(6, 3, -1).toText());
    expect(down.tiles[11][6]).toBe('solid');
    expect(down.tiles[10][6]).toBe('empty');
    expect(down.tiles[10][5]).toBe('solid');
    expect(down.tiles[9][4]).toBe('solid');
  });

  it('places platforms and hidden blocks', () => {
    expect(level.tiles[8][16]).toBe('solid');
    expect(level.tiles[8][17]).toBe('solid');
    expect(level.tiles[8][18]).toBe('hiddenCoin');
  });

  it('seals a bonus room and marks it dark', () => {
    expect(level.dark).toEqual([{ from: 24, to: 39 }]);
    expect(level.tiles[0][30]).toBe('solid'); // ceiling
    expect(level.tiles[8][24]).toBe('solid'); // left wall
    expect(level.tiles[8][39]).toBe('solid'); // right wall
    expect(level.tiles[12][30]).toBe('solid'); // floor
    expect(level.tiles[8][30]).toBe('empty'); // interior
  });

  it('round-trips through the canonical footer', () => {
    expect(serializeLevel(level)).toBe(text);
  });

  it('numbers secret links in the footer', () => {
    const secretText = new LevelBuilder(30)
      .ground(0, 29)
      .start(1)
      .flag(28, 4)
      .hidden(5, 8, 'warp')
      .pipe(10, 2, 3)
      .secret(1, 3)
      .toText();
    expect(parseLevel(secretText).secretWarps).toEqual([{ col: 5, row: 8, to: 3 }]);
  });
});
```
Add `serializeLevel` to the import: `import { parseLevel, serializeLevel } from './format';`.

- [ ] **Step 2: Run to verify failure**

Run: `yarn vitest run src/levels/builder.test.ts`
Expected: FAIL (methods missing).

- [ ] **Step 3: Replace `src/levels/builder.ts`**

```ts
export const HEIGHT = 14;
export const GROUND_ROW = 12;

const ROOM_CEILING_LAST_ROW = 3;

const HIDDEN_GLYPH = { coin: 'h', oneUp: 'u', mushroom: 'm', warp: 'w' } as const;
export type HiddenKind = keyof typeof HIDDEN_GLYPH;

/** Authoring helper: draws a level and emits the text format `parseLevel` reads. */
export class LevelBuilder {
  private readonly cells: string[][];
  private readonly warps: Array<[from: number, to: number]> = [];
  private readonly secrets: Array<[n: number, to: number]> = [];
  private readonly darkRanges: Array<[from: number, to: number]> = [];

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

  /** Stairs of `steps` columns: heights 1..steps rising to the right (dir 1) or falling to the right (dir -1). */
  stairs(col: number, steps: number, dir: 1 | -1 = 1): this {
    for (let i = 0; i < steps; i++) this.wall(col + dir * i, i + 1);
    return this;
  }

  /** A floating run of `length` tiles on `row`. */
  platform(col: number, row: number, length: number, glyph = '#'): this {
    for (let i = 0; i < length; i++) this.put(col + i, row, glyph);
    return this;
  }

  blocks(col: number, row: number, glyphs: string): this {
    [...glyphs].forEach((glyph, i) => this.put(col + i, row, glyph));
    return this;
  }

  hidden(col: number, row: number, kind: HiddenKind): this {
    return this.put(col, row, HIDDEN_GLYPH[kind]);
  }

  /** A 2-wide pipe standing on the ground; its mouth is labelled `id` (or plain `<` without one). */
  pipe(col: number, tall: number, id?: number): this {
    const top = GROUND_ROW - tall;
    this.put(col, top, id === undefined ? '<' : String(id));
    this.put(col + 1, top, '>');
    for (let row = top + 1; row < GROUND_ROW; row++) {
      this.put(col, row, '(');
      this.put(col + 1, row, ')');
    }
    return this;
  }

  warp(from: number, to: number): this {
    this.warps.push([from, to]);
    return this;
  }

  /** Link the n-th hidden warp block (reading order) to mouth `to`. */
  secret(n: number, to: number): this {
    this.secrets.push([n, to]);
    return this;
  }

  dark(from: number, to: number): this {
    this.darkRanges.push([from, to]);
    return this;
  }

  /** A sealed bonus room on cols from..to: ceiling, both walls, floor, and a dark look. */
  room(from: number, to: number): this {
    for (let col = from; col <= to; col++) {
      for (let row = 0; row <= ROOM_CEILING_LAST_ROW; row++) this.put(col, row, '#');
    }
    for (let row = 0; row < HEIGHT; row++) {
      this.put(from, row, '#');
      this.put(to, row, '#');
    }
    this.ground(from, to);
    return this.dark(from, to);
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
    const body = this.cells.map((row) => row.join('')).join('\n');
    const footer = [
      ...[...this.warps].sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(([from, to]) => `warp ${from} -> ${to}`),
      ...[...this.secrets].sort((a, b) => a[0] - b[0]).map(([n, to]) => `secret ${n} -> ${to}`),
      ...[...this.darkRanges].sort((a, b) => a[0] - b[0]).map(([from, to]) => `dark ${from}-${to}`),
    ];
    return footer.length > 0 ? `${body}\n---\n${footer.join('\n')}` : body;
  }
}
```

- [ ] **Step 4: Run all tests and typecheck**

Run: `yarn test && yarn typecheck`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Give the level builder pipes, stairs, platforms, secrets and rooms

Hand-counting columns for these shapes is how layouts go wrong; the builder keeps the text format as the one output."
```

---

### Task 11: Redesigned levels, bot retune, and replay guards

**Files:**
- Modify: `src/levels/builtin.ts` (full replacement), `src/testing/bot.ts`
- Test: `src/levels/builtin.test.ts` (extend)

**Interfaces:**
- Consumes: `LevelBuilder` from Task 10, `parseLevel`, `serializeLevel`, `fromLevels`.
- Produces: `builtinLevelTexts: string[]` (3 level texts), `builtinLevels: LevelSource`.

The layouts below are **first drafts reasoned on paper and never run**. The replay test is the guard. If it fails, diagnose why and adjust the level layout (move an enemy further from a pit/wall/pipe, shorten a gap, remove an obstacle) and, if clearly flawed, the bot, keeping every rule in the design-limits comment and the feature checklist below. Never change physics constants or core rules, and never weaken the assertions (each level must be won with no lives lost). Remove temporary logging before committing.

Rules the bot relies on (put them in a comment at the top of `builtin.ts`): gaps at most 4 wide; walls and pipes at most 3 tall; enemies sit at least ~8 columns past the far side of a gap or obstacle (a jump travels ~6 columns); floating platforms and blocks only above flat stretches where the bot never jumps (the bot's jump head reaches ~4.4 tiles, so anything lower than row 7 above a jumping spot would be bumped).

Feature checklist the tests enforce: all four hidden kinds appear somewhere across the three levels; every level has at least one in-level warp (both mouths left of the flag) and at least one warp into a bonus room (destination right of the flag); bonus rooms lie to the right of the flag.

- [ ] **Step 1: Write the failing tests**

Replace `src/levels/builtin.test.ts` with:
```ts
import { describe, expect, it } from 'vitest';
import { START_LIVES } from '../core/constants';
import { step } from '../core/game';
import { createGame } from '../core/state';
import type { GameState, Level, Tile } from '../core/types';
import { createBot } from '../testing/bot';
import { tick } from '../testing/helpers';
import { parseLevel, serializeLevel } from './format';
import { builtinLevelTexts, builtinLevels } from './builtin';

const allLevels = (): Level[] => [0, 1, 2].map((i) => builtinLevels.get(i));

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

describe('level design rules', () => {
  const GROUND_ROW = 12;

  it.each([0, 1, 2])('level %i has gaps of at most 4 and walls of at most 3', (index) => {
    const level = builtinLevels.get(index);
    let run = 0;
    for (let col = 0; col <= level.flag.col; col++) {
      run = level.tiles[GROUND_ROW][col] === 'empty' ? run + 1 : 0;
      expect(run).toBeLessThanOrEqual(4);

      let tall = 0;
      for (let row = GROUND_ROW - 1; row >= 0 && level.tiles[row][col] !== 'empty'; row--) tall += 1;
      expect(tall).toBeLessThanOrEqual(3);
    }
  });

  it.each([0, 1, 2])('level %i has its bonus rooms to the right of the flag', (index) => {
    const level = builtinLevels.get(index);
    expect(level.dark.length).toBeGreaterThan(0);
    for (const range of level.dark) expect(range.from).toBeGreaterThan(level.flag.col);
  });
});

describe('level features', () => {
  const count = (kind: Tile) => allLevels().flatMap((l) => l.tiles.flat()).filter((t) => t === kind).length;

  it.each(['hiddenCoin', 'hiddenOneUp', 'hiddenMushroom', 'hiddenWarp'] as const)(
    'contains a %s somewhere',
    (kind) => {
      expect(count(kind)).toBeGreaterThan(0);
    },
  );

  it.each([0, 1, 2])('level %i has an in-level warp and a bonus-room warp', (index) => {
    const level = builtinLevels.get(index);
    const col = (id: number) => level.mouths.find((m) => m.id === id)!.col;
    expect(level.warps.some((w) => col(w.from) <= level.flag.col && col(w.to) <= level.flag.col)).toBe(true);
    expect(level.warps.some((w) => col(w.to) > level.flag.col)).toBe(true);
  });
});

describe('scripted warps', () => {
  function standOnMouth(index: number, id: number): GameState {
    const level = builtinLevels.get(index);
    const s = createGame([level]);
    s.phase = 'playing';
    const mouth = level.mouths.find((m) => m.id === id)!;
    s.player.x = mouth.col + 1 - s.player.w / 2;
    s.player.y = mouth.row - s.player.h;
    s.cameraX = Math.max(0, mouth.col - 8);
    tick(s, {}, 3);
    return s;
  }

  it('the level 1 shortcut pipe leads to its exit pipe', () => {
    const s = standOnMouth(0, 1);
    const exit = builtinLevels.get(0).mouths.find((m) => m.id === 2)!;
    tick(s, { down: true }, 1);
    tick(s, {}, 60);
    expect(s.phase).toBe('playing');
    expect(s.player.x + s.player.w / 2).toBeCloseTo(exit.col + 1, 1);
  });

  it('a bonus room round trip returns to the entrance pipe', () => {
    const level = builtinLevels.get(0);
    const entrance = level.mouths.find((m) => m.id === 3)!;
    const s = standOnMouth(0, 3);
    tick(s, { down: true }, 1);
    tick(s, {}, 60);
    expect(s.player.x).toBeGreaterThan(level.dark[0].from);
    expect(s.cameraX).toBe(level.dark[0].from);
    tick(s, {}, 1);
    tick(s, { down: true }, 1);
    tick(s, {}, 60);
    expect(s.phase).toBe('playing');
    expect(s.player.x + s.player.w / 2).toBeCloseTo(entrance.col + 1, 1);
  });
});

describe('replay: every level is completable', () => {
  const MAX_TICKS = 60 * 120;

  it.each([0, 1, 2])('a simple bot beats level %i without dying', (index) => {
    const s = createGame([builtinLevels.get(index)]);
    s.phase = 'playing';
    const bot = createBot();
    while (s.phase !== ('won' as GameState['phase']) && s.phase !== ('gameOver' as GameState['phase']) && s.tick < MAX_TICKS) {
      step(s, bot(s));
    }
    expect({ phase: s.phase, lives: s.lives, x: Math.round(s.player.x) }).toMatchObject({
      phase: 'won',
      lives: START_LIVES,
    });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `yarn vitest run src/levels/builtin.test.ts`
Expected: FAIL (the current levels have no pipes, secrets or rooms).

- [ ] **Step 3: Replace the bot's wall lookahead**

In `src/testing/bot.ts`, change `[0.5, 1.0, 1.5]` to `[0.5, 1.0, 1.5, 2.0]` if Task 1 did not already.

- [ ] **Step 4: Replace `src/levels/builtin.ts`**

```ts
import { LevelBuilder } from './builder';
import { parseLevel } from './format';
import { fromLevels, type LevelSource } from './source';

// Rules that keep every level beatable by the replay bot (and playable by people):
// - gaps are at most 4 wide; walls and pipes at most 3 tall;
// - enemies sit at least ~8 columns past the far side of a gap or obstacle
//   (a running jump travels ~6 columns);
// - floating platforms and blocks only above flat stretches where the bot never
//   jumps (its jump head reaches ~4.4 tiles, so lower ones would be bumped);
// - bonus rooms are sealed, 16 wide, and lie to the right of the flag.

/** Grassland: a gentle intro with a pyramid, a shortcut pipe, a hidden coin and a coin room. */
function level1(): string {
  return new LevelBuilder(96)
    .ground(0, 53).ground(58, 79) // pit at 54-57
    .start(2)
    .blocks(5, 8, '?B?B?')
    .hidden(11, 8, 'coin')
    .stairs(20, 3).wall(23, 3).stairs(26, 3, -1) // a pyramid at 20-26
    .enemy(34, 'g')
    .pipe(38, 2)
    .enemy(44, 'g')
    .pipe(48, 3, 1) // shortcut: warps to the exit pipe at 70, over the pit
    .coins(54, 9, 4)
    .enemy(62, 'g')
    .pipe(70, 2, 2)
    .pipe(74, 2, 3) // bonus room entrance
    .warp(1, 2).warp(3, 4).warp(4, 3)
    .flag(77, 4)
    .room(80, 95).pipe(90, 2, 4).coins(84, 9, 5)
    .toText();
}

/** Pits and platforms: wider gaps, shells, a hidden 1-up, a high ledge and a room with a secret power-up. */
function level2(): string {
  return new LevelBuilder(128)
    .ground(0, 29).ground(34, 59).ground(64, 85).ground(90, 111) // pits at 30-33, 60-63, 86-89
    .start(2)
    .blocks(5, 8, '?M?')
    .hidden(11, 8, 'oneUp')
    .enemy(24, 'g')
    .coins(30, 9, 4)
    .enemy(44, 'k')
    .coins(60, 9, 4)
    .pipe(68, 3, 1) // shortcut: warps to 96, skipping the last pit and the walker
    .enemy(76, 'g')
    .coins(86, 9, 4)
    .pipe(96, 2, 2)
    .platform(99, 8, 5).coins(99, 7, 5)
    .pipe(102, 2, 3) // bonus room entrance
    .wall(106, 3)
    .warp(1, 2).warp(3, 4).warp(4, 3)
    .flag(110, 4)
    .room(112, 127).pipe(122, 2, 4).coins(116, 9, 6).hidden(118, 7, 'mushroom')
    .toText();
}

/** Gauntlet: four pits, mixed enemies, a hidden warp block to a secret room, a stair climb to the flag. */
function level3(): string {
  return new LevelBuilder(160)
    .ground(0, 19).ground(24, 45).ground(50, 71).ground(76, 127) // pits at 20-23, 46-49, 72-75
    .start(2)
    .blocks(6, 8, '?B?')
    .hidden(12, 8, 'mushroom')
    .coins(20, 9, 4)
    .enemy(34, 'k')
    .hidden(40, 8, 'warp') // secret: leads to the room at 144-159
    .pipe(44, 2, 7) // where the secret room returns you
    .coins(46, 9, 4)
    .enemy(58, 'g')
    .pipe(64, 3, 1) // shortcut: warps to 104
    .coins(72, 9, 4)
    .enemy(86, 'g')
    .enemy(92, 'k')
    .pipe(98, 2, 3) // bonus room entrance
    .pipe(104, 2, 2)
    .stairs(110, 3).wall(113, 3)
    .secret(1, 6)
    .warp(1, 2).warp(3, 4).warp(4, 3).warp(6, 7)
    .flag(120, 4)
    .room(128, 143).pipe(138, 2, 4).coins(132, 9, 6)
    .room(144, 159).pipe(154, 2, 6).coins(148, 9, 8).hidden(150, 7, 'coin')
    .toText();
}

export const builtinLevelTexts: string[] = [level1(), level2(), level3()];

export const builtinLevels: LevelSource = fromLevels(builtinLevelTexts.map(parseLevel));
```

- [ ] **Step 5: Run the tests and tune**

Run: `yarn vitest run src/levels/builtin.test.ts`
Expected: structure, rules, features and scripted-warp tests pass; the bot replay may fail. Follow the tuning rule in this task's introduction. If the *rules* test fails (a wall or gap exceeds the limits), fix the layout. If a scripted-warp test fails because a pipe id or position changed while tuning, keep the ids used by the tests (level 1: mouth 1 -> 2 is the shortcut, mouth 3 <-> 4 is the room).

- [ ] **Step 6: Run everything**

Run: `yarn test && yarn typecheck && yarn build`
Expected: all pass, build ok.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Redesign the three levels around pipes, secrets and bonus rooms

The replay bot still has to beat every level, so richer layouts cannot silently become impossible."
```

---

### Task 12: Browser verification, security scan, squash

**Files:** none new (fixes only if verification finds problems)

- [ ] **Step 1: Start the dev server and look**

Use `mcp__Claude_Browser__preview_start` with name `platformer`, then screenshots. Verify with `preview_eval` key events dispatched on `window` (see the earlier `key(type, code)` pattern): the title screen; jumping feels taller; walking up the level-1 pyramid; a pipe renders with its mouth; pressing Down on pipe `1` (hold Right until standing on it, then tap `ArrowDown`) sinks the player, scrolls, and emerges from pipe `2`; the bonus room (pipe `3`) is dark with no outside visible, coins collectable, and its exit pipe returns to the entrance; a hidden coin block at level 1 col 11 appears only when bumped from below; no console errors.

- [ ] **Step 2: Final verification** (no Snyk scan: the user has said it is not required for this project)

Run: `yarn test && yarn typecheck && yarn build`
Expected: all green.

- [ ] **Step 3: Squash into one meaningful commit**

The spec commit (`013fc34`) stays separate; squash everything after it:
```bash
git reset --soft 013fc34
git commit -m "Add hidden blocks, warp pipes, bonus rooms and a higher jump

Secrets, pipes and sealed rooms make levels worth exploring; the jump rises to about four tiles for a better feel. Hidden blocks are solid only to a head bump from below, warps run in a short frozen phase, and rooms live in the same wide grid so existing mechanics (blocks, enemies, respawn) just work. The three levels are redesigned and still guarded by a replay bot."
git log --oneline
```
Expected: two commits (spec, then implementation) on top of `main`.

- [ ] **Step 4: Finish the branch**

Invoke `superpowers:finishing-a-development-branch`.
