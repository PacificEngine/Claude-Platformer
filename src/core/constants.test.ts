import { describe, expect, it } from 'vitest';
import { DT } from './constants';

describe('constants', () => {
  it('simulates at a fixed 60 ticks per second', () => {
    expect(DT).toBeCloseTo(1 / 60);
  });
});
