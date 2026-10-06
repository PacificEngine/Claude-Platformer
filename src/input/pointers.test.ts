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
