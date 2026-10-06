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

  it('releases every key when the window loses focus', () => {
    const target = new EventTarget();
    const input = createKeyboardInput(target);
    press(target, 'keydown', 'ArrowRight');
    press(target, 'keydown', 'KeyX');
    target.dispatchEvent(new Event('blur'));
    expect(input.poll()).toEqual({ left: false, right: false, jump: false, run: false });
  });
});
