# Platformer

A side-scrolling platformer in TypeScript and HTML5 Canvas. No game engine and no image assets: the pixel art is defined as character grids in code, and the sounds are synthesized with WebAudio.

## Features

- **Movement:** acceleration and friction, a run button, variable-height jumps (a full jump reaches about four tiles), coyote time and jump buffering.
- **Enemies:** walkers and shell enemies. Stomp them, or kick a stunned shell to knock out other enemies.
- **Blocks and power-ups:** `?` blocks, bricks, a growth mushroom (a hit shrinks you instead of ending the run) and a 1-up mushroom.
- **Secrets:** invisible blocks that only appear when you bump them from below: hidden coins, a 1-up, a power-up, and a hidden pipe entrance.
- **Warp pipes:** teleport to another spot in the level, or drop into a sealed bonus room with its own exit pipe.
- **Music:** original chiptune synthesized in code: a theme for each level, a calmer bonus-room track, and short stingers for level clear, game over and winning. Press **M** to mute the music; sound effects stay on.
- **Touch controls:** an on-screen D-pad, Jump and Run buttons, and a mute button, so it plays on phones and tablets.
- **Game flow:** score, coins, lives, a time bonus, three levels, a title screen and a game-over screen.

## Play locally

```bash
yarn install
yarn dev
```

| Action | Keys |
|---|---|
| Move | Left / Right or A / D |
| Jump (hold for a higher jump) | Z, Space, Up or W |
| Run | X or Shift |
| Mute / unmute the music | M |
| Enter a pipe | Down or S, while standing centred on top of it |

On touch screens, use the on-screen buttons: the pad moves (and Down enters pipes), JUMP jumps, RUN toggles running, and the note button mutes the music.

Bump blocks from below. Look for blocks that are not there: some secrets are invisible until you jump into them.

## Develop

```bash
yarn test        # unit tests (Vitest)
yarn typecheck
yarn build       # production build into dist/
```

The game is developed test-first. The simulation lives in `src/core` as plain data stepped at a fixed 60 ticks per second, and it imports nothing from the browser-facing code, so it is fully unit-testable and deterministic.

```
src/core      simulation: physics, player, enemies, blocks, warps, camera
src/levels    level text format, builder helpers, the built-in levels
src/input     keyboard input (behind an InputSource interface)
src/render    canvas renderer and sprite data
src/audio     synthesized sound effects and background music
src/save      save-store interface (in-memory for now)
src/testing   test helpers and the replay bot
```

A replay bot plays every built-in level in the tests, so a change that makes a level impossible fails the build.

## Level format

Levels are plain text, one character per tile.

| Glyph | Meaning |
|---|---|
| `.` `#` | empty, solid |
| `B` `?` `M` | brick, coin block, mushroom block |
| `h` `u` `m` `w` | hidden coin, 1-up, power-up, and warp block |
| `< > ( )` | pipe pieces: top-left, top-right, body-left, body-right |
| `1`-`9` | pipe top-left with a numbered mouth |
| `g` `k` `c` | walker, shell enemy, coin |
| `P` `F` | player start, flag (exactly one of each) |

After a line containing only `---`, optional lines link things together:

```
warp 1 -> 2        standing on mouth 1 and pressing Down emerges from mouth 2
secret 1 -> 5      the first hidden warp block (reading order) enters mouth 5
dark 80-95         columns 80 to 95 are a bonus room, drawn dark and hidden from outside
```

Bonus rooms are sealed rectangles in the same grid, placed to the right of the flag. `src/levels/builder.ts` has helpers (`pipe`, `stairs`, `platform`, `hidden`, `warp`, `secret`, `room`) that draw a level and emit this text.

## Deploy to GitHub Pages

`.github/workflows/deploy.yml` runs the tests, builds, and publishes `dist/` on every push to `main`. In the repository settings, **Pages → Source** must be set to **GitHub Actions**. Assets use relative paths, so the site works from any sub-path.
