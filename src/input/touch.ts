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
    if (event.pointerType === 'mouse' && event.button !== 0) return;
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
  document.addEventListener('gesturestart', (event) => event.preventDefault());
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
