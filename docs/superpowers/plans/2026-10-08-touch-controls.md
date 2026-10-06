# Touch Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add always-visible on-screen touch controls (D-pad with Left/Right/Down, big Jump, a Run toggle, and a mute button) that work alongside the keyboard.

**Architecture:** A pure `PointerTracker` maps each finger to at most one held action. `createTouchInput` is a second `InputSource` that listens for pointer events, finds the button under each finger, and drives the tracker. `combineInputs` ORs several input sources, so `main.ts` uses keyboard + touch together. The buttons are static HTML/CSS in `index.html`. `src/core` is untouched.

**Tech Stack:** TypeScript, DOM Pointer Events, Vitest, yarn (unchanged).

**Design:** approved in chat (no spec file). Branch `feature/touch`.

## Global Constraints

- Package manager is `yarn` only. Never npm/pnpm/bun.
- `src/core` is not modified. Input is delivered only through the existing `InputSource` interface (`poll(): Input`).
- Controls are always visible (user decision), classic layout: D-pad bottom-left (Left, Right, Down), a large Jump and a smaller Run toggle bottom-right, a small mute (♪) button top-right. Run is a **toggle** (tap on/off, lit while on); Jump and the D-pad are hold-to-press.
- Several fingers must work at once (e.g. D-pad + Jump); sliding a finger across the D-pad switches direction; nothing may stay stuck on pointer cancel, window blur, or the tab becoming hidden.
- The mute button toggles only the music (same as the M key); it is not part of the game `Input`.
- TDD for the pure parts (tracker, combine); the DOM wiring is verified in the browser. One commit per red-green cycle; never refactor and change behavior in the same step.
- Commit messages explain *why*; never add a Claude signature or Co-Authored-By line. Snyk is not required.

## File Structure

```
src/input/pointers.ts   CREATE  PointerTracker (pure)
src/input/combine.ts    CREATE  combineInputs
src/input/touch.ts      CREATE  createTouchInput (DOM wiring)
index.html              MODIFY  viewport meta, control markup, CSS
src/main.ts             MODIFY  combine keyboard + touch; mute button
README.md               MODIFY  mention touch controls
```

---

### Task 1: Pointer tracker

**Files:**
- Create: `src/input/pointers.ts`
- Test: `src/input/pointers.test.ts`

**Interfaces:**
- Produces: `type PointerAction = 'left' | 'right' | 'down' | 'jump'`; `interface PointerTracker { track(pointerId: number, action: PointerAction | null): void; release(pointerId: number): void; releaseAll(): void; isHeld(action: PointerAction): boolean }`; `createPointerTracker(): PointerTracker`.

`track(id, action)` records which action a finger is on (replacing its previous action, so sliding works); `track(id, null)` means the finger is on no button.

- [ ] **Step 1: Write the failing tests**

`src/input/pointers.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { createPointerTracker, type PointerAction } from './pointers';

const ACTIONS: PointerAction[] = ['left', 'right', 'down', 'jump'];

describe('createPointerTracker', () => {
  it('holds nothing at first', () => {
    const tracker = createPointerTracker();
    for (const action of ACTIONS) expect(tracker.isHeld(action)).toBe(false);
  });

  it('holds an action while a finger is on it, then lets go', () => {
    const tracker = createPointerTracker();
    tracker.track(1, 'jump');
    expect(tracker.isHeld('jump')).toBe(true);
    tracker.release(1);
    expect(tracker.isHeld('jump')).toBe(false);
  });

  it('moves a finger from one button to another', () => {
    const tracker = createPointerTracker();
    tracker.track(1, 'left');
    tracker.track(1, 'right');
    expect(tracker.isHeld('left')).toBe(false);
    expect(tracker.isHeld('right')).toBe(true);
  });

  it('lets a finger slide off every button', () => {
    const tracker = createPointerTracker();
    tracker.track(1, 'down');
    tracker.track(1, null);
    expect(tracker.isHeld('down')).toBe(false);
  });

  it('tracks several fingers at once', () => {
    const tracker = createPointerTracker();
    tracker.track(1, 'right');
    tracker.track(2, 'jump');
    expect(tracker.isHeld('right')).toBe(true);
    expect(tracker.isHeld('jump')).toBe(true);
    tracker.release(2);
    expect(tracker.isHeld('right')).toBe(true);
    expect(tracker.isHeld('jump')).toBe(false);
  });

  it('keeps an action held while another finger is still on it', () => {
    const tracker = createPointerTracker();
    tracker.track(1, 'jump');
    tracker.track(2, 'jump');
    tracker.release(1);
    expect(tracker.isHeld('jump')).toBe(true);
    tracker.release(2);
    expect(tracker.isHeld('jump')).toBe(false);
  });

  it('releases everything at once', () => {
    const tracker = createPointerTracker();
    tracker.track(1, 'left');
    tracker.track(2, 'jump');
    tracker.releaseAll();
    for (const action of ACTIONS) expect(tracker.isHeld(action)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `yarn vitest run src/input/pointers.test.ts`
Expected: FAIL — cannot resolve `./pointers`.

- [ ] **Step 3: Implement**

`src/input/pointers.ts`:
```ts
export type PointerAction = 'left' | 'right' | 'down' | 'jump';

export interface PointerTracker {
  /** Record which action (or none) a finger is on; replaces its previous action. */
  track(pointerId: number, action: PointerAction | null): void;
  /** Forget a finger that lifted or was cancelled. */
  release(pointerId: number): void;
  releaseAll(): void;
  isHeld(action: PointerAction): boolean;
}

export function createPointerTracker(): PointerTracker {
  const fingers = new Map<number, PointerAction>();
  return {
    track(pointerId, action) {
      if (action === null) fingers.delete(pointerId);
      else fingers.set(pointerId, action);
    },
    release(pointerId) {
      fingers.delete(pointerId);
    },
    releaseAll() {
      fingers.clear();
    },
    isHeld(action) {
      return [...fingers.values()].includes(action);
    },
  };
}
```

- [ ] **Step 4: Run all tests and typecheck**

Run: `yarn test && yarn typecheck`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/input/pointers.ts src/input/pointers.test.ts
git commit -m "Add a pointer tracker for touch input

Mapping each finger to one action in pure code keeps multi-touch and sliding behaviour testable without a browser."
```

---

### Task 2: Combine input sources

**Files:**
- Create: `src/input/combine.ts`
- Test: `src/input/combine.test.ts`

**Interfaces:**
- Consumes: `InputSource` from `src/input/keyboard.ts`, `Input` from `src/core/types`.
- Produces: `combineInputs(...sources: InputSource[]): InputSource` — each field is true if it is true on any source.

- [ ] **Step 1: Write the failing tests**

`src/input/combine.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { Input } from '../core/types';
import { combineInputs } from './combine';

const NONE: Input = { left: false, right: false, jump: false, run: false, down: false };
const source = (held: Partial<Input>) => ({ poll: (): Input => ({ ...NONE, ...held }) });

describe('combineInputs', () => {
  it('reports nothing pressed with no sources', () => {
    expect(combineInputs().poll()).toEqual(NONE);
  });

  it('reports what a single source reports', () => {
    expect(combineInputs(source({ left: true, jump: true })).poll()).toEqual({ ...NONE, left: true, jump: true });
  });

  it('presses a field if any source presses it', () => {
    const combined = combineInputs(source({ right: true }), source({ jump: true }), source({ right: true, run: true }));
    expect(combined.poll()).toEqual({ ...NONE, right: true, jump: true, run: true });
  });

  it('keeps fields independent', () => {
    expect(combineInputs(source({ down: true }), source({})).poll()).toEqual({ ...NONE, down: true });
  });

  it('reads the sources fresh on every poll', () => {
    let held = false;
    const live = { poll: (): Input => ({ ...NONE, jump: held }) };
    const combined = combineInputs(live);
    expect(combined.poll().jump).toBe(false);
    held = true;
    expect(combined.poll().jump).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `yarn vitest run src/input/combine.test.ts`
Expected: FAIL — cannot resolve `./combine`.

- [ ] **Step 3: Implement**

`src/input/combine.ts`:
```ts
import type { Input } from '../core/types';
import type { InputSource } from './keyboard';

/** An input source that presses a field whenever any of the given sources does. */
export function combineInputs(...sources: InputSource[]): InputSource {
  return {
    poll(): Input {
      const all: Input = { left: false, right: false, jump: false, run: false, down: false };
      for (const source of sources) {
        const next = source.poll();
        all.left ||= next.left;
        all.right ||= next.right;
        all.jump ||= next.jump;
        all.run ||= next.run;
        all.down ||= next.down;
      }
      return all;
    },
  };
}
```

- [ ] **Step 4: Run all tests and typecheck**

Run: `yarn test && yarn typecheck`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/input/combine.ts src/input/combine.test.ts
git commit -m "Add a combiner for input sources

Keyboard and touch must both work at once, so the loop reads one merged source."
```

---

### Task 3: Touch controls (markup, styling, wiring)

**Files:**
- Create: `src/input/touch.ts`
- Modify: `index.html` (full replacement), `src/main.ts`

**Interfaces:**
- Consumes: `createPointerTracker`, `PointerAction` (Task 1); `combineInputs` (Task 2); `InputSource`; the existing `music.toggleMute(): boolean`.
- Produces: `createTouchInput(root: HTMLElement, options: { onMute: () => boolean }): InputSource`.

The DOM layer is verified in the browser by the controller (Task 4), not unit-tested; here the checks are `yarn test && yarn typecheck && yarn build`.

- [ ] **Step 1: Replace `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <title>Platformer</title>
    <style>
      :root { --btn: clamp(52px, 15vmin, 88px); }
      html, body {
        margin: 0; height: 100%; background: #111; display: flex; align-items: center; justify-content: center;
        overscroll-behavior: none; touch-action: none;
        -webkit-user-select: none; user-select: none; -webkit-touch-callout: none;
      }
      canvas { image-rendering: pixelated; width: min(100vw, calc(100vh * 256 / 224)); aspect-ratio: 256 / 224; }

      #touch-controls { position: fixed; inset: 0; pointer-events: none; touch-action: none; }
      #touch-controls button {
        pointer-events: auto; touch-action: none; padding: 0; margin: 0; cursor: pointer;
        color: #fff; font: bold calc(var(--btn) * 0.34) sans-serif;
        background: rgba(255, 255, 255, 0.16); border: 2px solid rgba(255, 255, 255, 0.5); border-radius: 16px;
        -webkit-tap-highlight-color: transparent;
      }
      #touch-controls button.pressed, #touch-controls button.on { background: rgba(255, 255, 255, 0.5); }

      .dpad {
        position: absolute; left: 2vmin; bottom: 2vmin; display: grid; gap: 6px;
        grid-template-columns: repeat(3, var(--btn)); grid-template-rows: repeat(2, var(--btn));
      }
      .dpad [data-action='left'] { grid-column: 1; grid-row: 1; }
      .dpad [data-action='right'] { grid-column: 3; grid-row: 1; }
      .dpad [data-action='down'] { grid-column: 2; grid-row: 2; }

      .actions { position: absolute; right: 2vmin; bottom: 2vmin; display: flex; align-items: flex-end; gap: 12px; }
      .actions [data-action='jump'] { width: calc(var(--btn) * 1.5); height: calc(var(--btn) * 1.5); border-radius: 50%; }
      .actions [data-action='run'] { width: var(--btn); height: var(--btn); border-radius: 50%; }

      #touch-controls [data-action='mute'] {
        position: absolute; top: 2vmin; right: 2vmin;
        width: calc(var(--btn) * 0.6); height: calc(var(--btn) * 0.6); border-radius: 50%;
      }
    </style>
  </head>
  <body>
    <canvas id="game"></canvas>
    <div id="touch-controls">
      <div class="dpad">
        <button data-action="left" aria-label="Left">&#9664;</button>
        <button data-action="right" aria-label="Right">&#9654;</button>
        <button data-action="down" aria-label="Down">&#9660;</button>
      </div>
      <div class="actions">
        <button data-action="run" aria-label="Run (toggle)">RUN</button>
        <button data-action="jump" aria-label="Jump">JUMP</button>
      </div>
      <button data-action="mute" aria-label="Mute music">&#9834;</button>
    </div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 2: Create `src/input/touch.ts`**

```ts
import type { InputSource } from './keyboard';
import { createPointerTracker, type PointerAction } from './pointers';

const HELD_ACTIONS: readonly string[] = ['left', 'right', 'down', 'jump'];

const isHeldAction = (action: string | undefined): action is PointerAction =>
  action !== undefined && HELD_ACTIONS.includes(action);

/** The control button under a screen point, if any. */
function actionAt(x: number, y: number): string | undefined {
  return document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-action]')?.dataset.action;
}

/**
 * On-screen controls: buttons marked with `data-action` (left, right, down, jump are
 * hold-to-press; run is a toggle; mute calls `onMute`). Several fingers work at once and
 * a finger can slide between buttons.
 */
export function createTouchInput(root: HTMLElement, options: { onMute: () => boolean }): InputSource {
  const tracker = createPointerTracker();
  const buttons = [...root.querySelectorAll<HTMLElement>('[data-action]')];
  const owned = new Set<number>(); // fingers that started on a hold button
  let run = false;

  const refresh = (): void => {
    for (const button of buttons) {
      const action = button.dataset.action;
      if (isHeldAction(action)) button.classList.toggle('pressed', tracker.isHeld(action));
    }
  };

  const releaseAll = (): void => {
    owned.clear();
    tracker.releaseAll();
    refresh();
  };

  root.addEventListener('pointerdown', (event) => {
    const action = actionAt(event.clientX, event.clientY);
    if (!action) return;
    event.preventDefault();
    if (isHeldAction(action)) {
      owned.add(event.pointerId);
      tracker.track(event.pointerId, action);
    } else if (action === 'run') {
      run = !run;
      buttons.find((b) => b.dataset.action === 'run')?.classList.toggle('on', run);
    } else if (action === 'mute') {
      const muted = options.onMute();
      buttons.find((b) => b.dataset.action === 'mute')?.classList.toggle('on', muted);
    }
    refresh();
  });

  window.addEventListener('pointermove', (event) => {
    if (!owned.has(event.pointerId)) return;
    const action = actionAt(event.clientX, event.clientY);
    tracker.track(event.pointerId, isHeldAction(action) ? action : null);
    refresh();
  });

  const lift = (event: PointerEvent): void => {
    owned.delete(event.pointerId);
    tracker.release(event.pointerId);
    refresh();
  };
  window.addEventListener('pointerup', lift);
  window.addEventListener('pointercancel', lift);
  window.addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) releaseAll();
  });
  root.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    poll: () => ({
      left: tracker.isHeld('left'),
      right: tracker.isHeld('right'),
      down: tracker.isHeld('down'),
      jump: tracker.isHeld('jump'),
      run,
    }),
  };
}
```

- [ ] **Step 3: Wire `src/main.ts`**

Add imports next to the keyboard import:
```ts
import { combineInputs } from './input/combine';
import { createTouchInput } from './input/touch';
```
Replace these existing lines:
```ts
const input = createKeyboardInput(window);
const audio = createAudio();
const music = createMusic();
```
with:
```ts
const audio = createAudio();
const music = createMusic();
const input = combineInputs(
  createKeyboardInput(window),
  createTouchInput(document.getElementById('touch-controls')!, { onMute: () => music.toggleMute() }),
);
```
(The `window.addEventListener('keydown', ...)` M-key block that follows `const music` stays as is.)

- [ ] **Step 4: Verify**

Run: `yarn test && yarn typecheck && yarn build`
Expected: all pass. If `closest<HTMLElement>(...)` or `dataset` typing complains, make the smallest type-level fix and report it.

- [ ] **Step 5: Commit**

```bash
git add index.html src/input/touch.ts src/main.ts
git commit -m "Add on-screen touch controls

A D-pad, Jump, a Run toggle and a mute button make the game playable on phones; keyboard and touch are merged so both keep working."
```

---

### Task 4: README, browser verification, final review, squash

**Files:** `README.md`

- [ ] **Step 1: README**

In `README.md` add to the Features list: `- **Touch controls:** an on-screen D-pad, Jump and Run buttons, and a mute button, so it plays on phones and tablets.` and add below the controls table: `On touch screens, use the on-screen buttons: the pad moves (and Down enters pipes), JUMP jumps, RUN toggles running, and the note button mutes the music.`

- [ ] **Step 2: Browser verification (controller)**

Start the dev server with `mcp__Claude_Browser__preview_start` (name `platformer`). Use `preview_resize` to check portrait (375x812, preset mobile) and landscape (812x375) layouts with screenshots: controls visible, the D-pad bottom-left, Jump/Run bottom-right, ♪ top-right, canvas not covered in landscape. Using `preview_eval`, dispatch pointer events at button centres (`new PointerEvent('pointerdown', {bubbles: true, pointerId: 1, clientX, clientY, pointerType: 'touch'})` on the button; then `pointerup` on `window`) and confirm via screenshots/`classList` that: tapping JUMP starts the game from the title; holding the right button moves the player; sliding from right to left switches direction; Run toggles `.on`; two simultaneous pointers (right + jump) both register; the ♪ button toggles its `.on` class; releasing clears `.pressed`; no console errors. State clearly that real-thumb feel could not be tested.

- [ ] **Step 3: Final checks**

Run: `yarn test && yarn typecheck && yarn build`
Expected: all green.

- [ ] **Step 4: Squash into one meaningful commit**

Squash the implementation commits after the plan-doc commit:
```bash
git log --oneline | head -8
git reset --soft <the plan-doc commit>
git commit -m "Add on-screen touch controls

A D-pad (left, right, down for pipes), a Jump button, a Run toggle and a mute button make the game playable on phones and tablets. A pure pointer tracker maps fingers to actions so multi-touch and sliding are tested, a combiner merges touch with the keyboard, and the core is untouched."
```

- [ ] **Step 5: Finish the branch**

Invoke `superpowers:finishing-a-development-branch`.
