# Platformer — Design

A classic side-scrolling platformer for the browser. TypeScript + HTML5 Canvas, no game engine. Vite, Vitest, yarn.

## Goals

- Tight, forgiving platforming feel (acceleration, run, variable jump, coyote time, jump buffering).
- Enemies with stomping, power-ups, blocks, coins/score/lives, and 3 levels with a goal.
- Pixel-art look with no image assets: sprites are character grids in code.
- Logic is pure and deterministic so it can be developed test-first.
- Room to add touch controls, a level editor, and local save data later without reworking the core.

## Non-goals (v1)

Touch controls, level editor, persistent save data, moving platforms, hazards beyond the listed enemies. Seams for these are specified under "Extension seams".

## Architecture

Pure-logic core plus thin edges.

```
src/
  core/      simulation: state, step(), physics, collision, entities, rules (no DOM, no audio)
  levels/    level text format: parse, serialize, built-in levels, LevelSource
  input/     InputSource interface, keyboard implementation
  render/    canvas renderer, sprites (pixel grids), camera, HUD
  audio/     WebAudio synth; plays core events
  save/      SaveStore interface, SaveData type, in-memory implementation
  main.ts    fixed-timestep loop wiring everything together
```

Dependency rule: `core` imports nothing from `render`, `audio`, `input`, or `save`. Edges depend on `core`, never the reverse.

### Core model

- `GameState` is plain serializable data (no class instances or functions): phase, level tiles, entities, camera, score, coins, lives, tick, and a queue of events.
- Phases: `title | playing | dying | levelClear | gameOver | won`.
- `step(state, input): GameState` advances one fixed 1/60 s tick. Deterministic: same state + input sequence gives same result.
- `Input` is `{ left, right, jump, run }` booleans; jump press/release edges are derived inside the core from the previous tick.
- Core emits events (`{ type: 'jump' | 'coin' | 'stomp' | 'powerup' | 'death' | ... }`) which the audio layer consumes.
- Physics: axis-separated AABB against the tile grid (resolve X, then Y). Positions in tile units with sub-tile precision.

### Entities and rules

- **Player**: `small | big`. Acceleration/friction, run button raises speed cap. Variable jump height (early release cuts upward velocity). Coyote time ~100 ms, jump buffer ~100 ms. Hit while big: shrink + brief invulnerability. Hit while small: die.
- **Walker**: patrols, turns at walls and ledges. Stomp (player falling onto it from above) defeats it, bounces player, awards points. Side contact hurts the player.
- **Shell enemy**: stomp turns it into a stationary shell; touching the shell kicks it into a slide that defeats other enemies.
- **Blocks**: `?` blocks hit from below release a coin or mushroom and become inert. Bricks break when the player is big, bump when small.
- **Mushroom**: emerges from a block, walks, grows the player on pickup.
- **Coins**: 100 points each; 100 coins grants an extra life.
- **Goal flag**: ends the level with a time bonus; next level loads; after the last level phase becomes `won`.
- **Death**: enemy contact when small, or falling out of the world. Short death animation, then respawn at level start with one fewer life; at 0 lives, `gameOver`.

### Levels

Text grids. Legend: `#` ground/solid, `B` brick, `?` question block (coin), `M` question block (mushroom), `g` walker, `k` shell enemy, `c` coin, `P` player start, `F` flag.

- `parseLevel(text)` returns tiles + spawns; rejects malformed levels (no `P`, no `F`, ragged rows, unknown glyphs) with descriptive errors.
- `serializeLevel(level)` is the inverse; round-trip `parse -> serialize` reproduces the original text.
- `LevelSource` interface (`count()`, `get(index)`); v1 provides only the built-in source with 3 hand-authored levels of rising difficulty. Core does not assume a fixed level count.

### Rendering, input, audio

- Canvas 256x224 logical, scaled up with image smoothing disabled. Layout is resolution-independent so on-screen controls can later sit outside the game area.
- `sprites.ts`: pixel art as rows of characters plus a palette; baked to offscreen canvases once at startup. Covers player (small/big, idle/run/jump), both enemies, tiles, mushroom, coin, flag. Animation is driven by `state.tick`.
- Camera follows the player horizontally, never scrolls backward. HUD: score, coins, lives, world. Simple parallax hills/clouds.
- `InputSource` interface returns the `Input` object each tick. v1: keyboard (arrows/WASD move, Z/Space jump, X/Shift run).
- Audio: WebAudio synthesized blips triggered from core events. Core never imports audio.
- `main.ts`: `requestAnimationFrame` loop with fixed-timestep accumulator.

## Extension seams (not built in v1)

- **Touch controls**: a second `InputSource` implementation; no core change.
- **Level editor**: text format + `serializeLevel` + `LevelSource` let an editor produce and load user levels without touching the game loop.
- **Save data**: `SaveStore` interface (`load()`, `save()`) with versioned serializable `SaveData` (e.g. highest level reached, best score). v1 ships in-memory only; a `localStorage` store can be added later. `GameState` being plain data also allows mid-level saves in future.

## Testing

TDD throughout (red, green, refactor; commit each cycle).

- Vitest unit tests for core: tile collision, jump arc and variable height, coyote time, jump buffering, stomp vs. side hit, block hits, mushroom growth, shrink + invulnerability, shell kicking, coin/extra life, death/respawn/game over, level clear and win.
- Level parser/serializer tests, including error cases and round-trip.
- Replay tests: each shipped level is completable by a recorded input sequence (guards against impossible levels).
- Renderer/audio are not unit-tested; verified by running the game in the browser and screenshots.

## Workflow

Work on branch `feature/platformer`; commit after each red-green-refactor cycle; squash into a single meaningful commit before finishing.
