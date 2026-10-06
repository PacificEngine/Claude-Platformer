import { describe, expect, it } from 'vitest';
import { levelText, pipeEdits, playing, tick } from '../testing/helpers';
import { DT, WARP_EMERGE_TIME, WARP_SINK_TIME } from './constants';
import { activeDarkRange } from './camera';

const WARP_TICKS = Math.ceil((WARP_SINK_TIME + WARP_EMERGE_TIME) / DT) + 3;

describe('dark rooms and the camera', () => {
  it('finds the dark range the player is in', () => {
    const s = playing(levelText(60, [], 6, ['dark 40-55']));
    expect(activeDarkRange(s)).toBeUndefined();
    s.player.x = 45;
    expect(activeDarkRange(s)).toEqual({ from: 40, to: 55 });
  });

  it('pins the camera to a room exactly as wide as the view', () => {
    const s = playing(levelText(60, [], 6, ['dark 40-55']));
    tick(s, {}, 3);
    s.player.x = 45;
    tick(s, {}, 1);
    expect(s.cameraX).toBe(40);
  });

  it('keeps the camera inside a wider room', () => {
    const s = playing(levelText(60, [], 6, ['dark 40-59']));
    tick(s, {}, 3);
    s.player.x = 57;
    tick(s, {}, 1);
    expect(s.cameraX).toBe(44);
  });

  it('puts the camera inside a room right after warping into it', () => {
    const text = levelText(60, [...pipeEdits(8, '1'), ...pipeEdits(48, '2')], 6, ['warp 1 -> 2', 'dark 44-59']);
    const s = playing(text);
    s.player.x = 8.625;
    s.player.y = 2;
    tick(s, {}, 3);
    tick(s, { down: true }, 1);
    tick(s, {}, WARP_TICKS);
    expect(s.cameraX).toBe(44);
  });
});
