# Secrets, Warp Pipes, Higher Jump and Richer Levels — Design

Extends `2026-10-06-platformer-design.md`. Everything there still holds (pure deterministic core, plain-data `GameState`, fixed 1/60 s tick, `src/core` imports nothing from the edges, TDD, yarn).

## Goals

- Raise the jump so it feels right (full jump reaches about 4.4 tiles instead of about 3.3).
- Add secret (hidden) blocks: coin, 1-up, power-up, and hidden pipe entrance.
- Add warp pipes that teleport within a level and lead to bonus rooms.
- Rework the three levels with more varied terrain, pipes, secrets and bonus rooms.

## Non-goals

Moving platforms, vines, fire flowers, vertical camera scrolling, save-data wiring changes, touch controls (only the `down` input is added so they can use it later).

## Jump

- `JUMP_VELOCITY` 19 -> 22 (apex = v^2 / 2g = 4.4 tiles with `GRAVITY` 55). All other jump rules (coyote, buffer, variable height cut) are unchanged.
- Level-design limits that follow: gaps at most 4 tiles wide, walls at most 3 tiles tall (stairs and platforms excepted).
- The bot used by replay tests is retuned to match (wall lookahead longer so it clears 3-tall walls).

## Architecture

Approach: **one wide grid**. A bonus room is a walled-off rectangle inside the same level grid, placed to the right of the flag. A warp teleports the player and snaps the camera. No per-area state: block hits, defeated enemies and respawn all work as they do now. Rooms are asleep (enemies are asleep until the camera nears them) until the player arrives.

### Input

`Input` gains `down: boolean`. Keyboard binds `ArrowDown` and `KeyS`. `NONE` in test helpers and the bot add `down: false`.

### New tiles (`Tile` union)

- Pipe pieces (solid): `pipeTL`, `pipeTR`, `pipeL`, `pipeR`.
- Hidden blocks: `hiddenCoin`, `hiddenOneUp`, `hiddenMushroom`, `hiddenWarp`.
- `warpBlock`: the revealed form of `hiddenWarp` (a solid one-tile pipe). Runtime only: no level glyph; `serializeLevel` rejects it like `used`.

### Level text format

New glyphs:

| Glyph | Meaning |
|---|---|
| `<` `>` | pipe top-left / top-right (a plain pipe mouth with no id) |
| `(` `)` | pipe body-left / body-right |
| `1`-`9` | pipe top-left with a mouth id (its right neighbour must be `>`) |
| `h` `u` `m` | hidden coin / hidden 1-up / hidden power-up block |
| `w` | hidden warp block (reveals a one-tile pipe) |

A pipe is 2 wide and at least 2 tall: a top row (`<` or a digit, then `>`) and one or more body rows (`(` `)`) directly beneath.

Footer: after a line containing only `---`, optional lines, in any order:

- `warp A -> B`: standing on mouth A and pressing Down emerges from mouth B. A and B are mouth ids. Mouths that appear in no `warp A` line are exit-only.
- `secret N -> B`: the N-th (1-based, row-major reading order) `w` block, once revealed, enters mouth B.
- `dark FROM-TO`: columns FROM..TO inclusive are drawn with the underground look.

`Level` gains: `mouths: { id: number; col: number; row: number }[]`, `warps: { from: number; to: number }[]`, `secretWarps: { col: number; row: number; to: number }[]`, `dark: { from: number; to: number }[]`.

`parseLevel` rejects: duplicate mouth ids; a mouth/`<` whose right neighbour is not `>`; `>` without a matching left piece; warp/secret ids that name no mouth; `secret N` with N out of range, or a `w` with no `secret` line; a malformed footer line. `serializeLevel(parseLevel(x))` reproduces the text (footer lines in a canonical order: warps, secrets by N, dark ranges). The old level text (no footer) parses unchanged.

### Hidden-block collision (physics)

Hidden tiles are non-solid to everything, except a body moving upward whose head started the tick at or below the tile's bottom edge. For that body only, the tile acts as solid for the vertical move and is reported as a `bonk`. Enemies and mushrooms ignore hidden tiles entirely. Moving sideways or downward through a hidden tile does nothing.

`moveBody` gains an option (default off) that enables hidden-tile bumping; only the player update passes it.

### Revealing (blocks)

`hitBlock` additions:

- `hiddenCoin` -> `used`, `addCoin`.
- `hiddenOneUp` -> `used`, spawns a 1-up mushroom (event `sprout`).
- `hiddenMushroom` -> `used`, spawns a normal mushroom (event `sprout`).
- `hiddenWarp` -> `warpBlock`, event `sprout`. It is then solid and enterable from above with Down.

`Mushroom` gains `kind: 'grow' | 'oneUp'`. `makeMushroom(col, row, kind = 'grow')`. Collecting a `oneUp` mushroom adds a life (event `oneup`), does not grow the player, and scores nothing.

### Warping

New phase `'warping'` and `GameState.warp: { to: number; teleported: boolean } | null` (`to` is the destination mouth id), as plain data, with `phaseTimer` counting the warp. The static link data (`mouths`, `warps`, `secretWarps`, `dark`) is read from `s.levels[s.levelIndex]`; a revealed `warpBlock` finds its destination through `secretWarps` by its (col, row).

- **Start:** during `playing`, if `input.down`, the player is on the ground, the player's centre x is inside a mouth's two columns (or a `warpBlock`'s one column), and the player's feet are on that pipe's top (`p.y + p.h` equals the pipe's top row within 0.05), and a warp exists for that mouth (or a revealed `secretWarps` entry), then phase becomes `warping`.
- **Sink** (first `WARP_SINK_TIME` = 0.4 s): the player moves down by their own height at constant speed; collisions, enemies and the clock are frozen. Event `warp` fires once at the start.
- **Teleport** (at the sink end): the player is placed inside the destination mouth, centred on it, top at the pipe's top row. `cameraX` is set to the destination centre minus half the view, clamped to the level; this ignores the "never scrolls backward" rule.
- **Emerge** (next `WARP_EMERGE_TIME` = 0.4 s): the player rises by their own height to stand on top of the destination pipe. Then phase returns to `playing`, with `vx = vy = 0`.
- Dying, level clear and the flag cannot occur during a warp. Respawn after a death anywhere reloads the whole level, including rooms.
- Pressing Down at the pipe a player just emerged from does not re-warp until Down is released and pressed again (edge-triggered).

### Camera

`updateCamera` is unchanged for normal play. The warp teleport sets `cameraX` directly.

### Rendering and audio

- New sprites (8x8 grids): `pipeTL`, `pipeTR`, `pipeL`, `pipeR`, `mushroomOneUp` (green), `warpBlock`. Hidden blocks are not drawn; revealed ones are `used` or `warpBlock`.
- During `warping` the player is drawn before the tiles so the pipe covers them while sinking and emerging.
- Dark regions: when the camera's centre column lies in a `dark` range the sky, clouds and hills are replaced by a dark background; tiles are drawn as usual.
- Audio: new event type `warp` with its own tone; 1-up reuses `oneup`.

### Level builder

`LevelBuilder` gains helpers: `pipe(col, tall, id?)`, `stairs(col, steps, dir)`, `platform(col, row, length, glyph?)`, `hidden(col, row, kind)`, `warp(from, to)`, `secret(n, to)`, `dark(from, to)`, and `room(from, to)` which draws an enclosed bonus room (floor, ceiling, left and right walls). `toText()` emits the footer when anything was declared.

## Levels

Three redesigned levels (each 14 rows; widths may grow to include rooms):

1. **Grassland** — gentle intro: stairs, a floating `?`/brick row, a first pipe cluster, a teleport shortcut pipe, one bonus room full of coins, a hidden coin block.
2. **Pits and platforms** — floating platform runs over pits, a hidden 1-up, a shortcut warp skipping a hard stretch, a bonus room, shell enemies.
3. **Gauntlet** — dense: stair climbs to the flag, mixed enemies, a hidden power-up, and a hidden pipe entrance leading to a secret bonus room.

Rules: gaps at most 4 wide; walls at most 3 tall; pipes at most 3 tall; the flag and its approach are in the main region; bonus rooms are to the right of the flag, fully walled; every level beatable without using any secret or warp (the bot never uses them); across the three levels every secret type and both warp styles (in-level teleport, bonus room) appear at least once.

## Testing

TDD in the core; commits per red-green cycle.

- Parser/serializer: new glyphs, footer, each rejection, round-trip, old-format levels unchanged.
- Physics: hidden tiles non-solid sideways/down, solid and bonked only when approached from below; enemies ignore them.
- Blocks: each hidden kind reveals and pays out once; `hiddenWarp` becomes `warpBlock`.
- Mushrooms: 1-up adds a life and does not grow.
- Warping: enter conditions (down + grounded + centred + on top; each missing one blocks it), sink, teleport placement, camera snap (including snapping backward), emerge, return to `playing`, no re-warp without a fresh press, secret warp via a revealed block, pipes are solid.
- Jump: apex height of a held jump is about 4.4 tiles; existing jump-feel tests remain.
- Determinism/serialization test still passes with the new state fields (`GameState` stays JSON-serializable).
- Replay: the bot still beats each redesigned level without dying; a scripted-input test warps through one in-level pipe and one bonus-room round trip.
- Rendering/audio verified in the browser.

## Workflow

Branch `feature/secrets-and-warps` off `main`. One red-green commit per behavior; squash into a single meaningful commit before finishing. The open GitHub Pages PR is independent.
