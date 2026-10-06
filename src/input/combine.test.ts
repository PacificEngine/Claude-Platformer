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
