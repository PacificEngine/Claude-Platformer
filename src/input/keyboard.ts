import type { Input } from '../core/types';

export interface InputSource {
  poll(): Input;
}

const BINDINGS: Record<keyof Input, string[]> = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  jump: ['Space', 'KeyZ', 'ArrowUp', 'KeyW'],
  run: ['KeyX', 'ShiftLeft', 'ShiftRight'],
  down: ['ArrowDown', 'KeyS'],
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
  target.addEventListener('blur', () => down.clear());

  const held = (action: keyof Input) => BINDINGS[action].some((code) => down.has(code));
  return {
    poll: () => ({ left: held('left'), right: held('right'), jump: held('jump'), run: held('run'), down: held('down') }),
  };
}
