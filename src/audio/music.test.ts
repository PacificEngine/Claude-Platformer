import { describe, expect, it } from 'vitest';
import type { Phase } from '../core/types';
import { levelText, playing } from '../testing/helpers';
import { createMusic, notesInWindow, trackFor } from './music';
import type { Track } from './tracks';

describe('trackFor', () => {
  const four = () => playing(...Array.from({ length: 4 }, () => levelText(30)));

  it('plays each level its own theme', () => {
    const s = four();
    for (const [index, id] of [[0, 'level1'], [1, 'level2'], [2, 'level3']] as const) {
      s.levelIndex = index;
      expect(trackFor(s)).toBe(id);
    }
  });

  it('wraps the themes for levels past the third', () => {
    const s = four();
    s.levelIndex = 3;
    expect(trackFor(s)).toBe('level1');
  });

  it('keeps the level theme through a warp', () => {
    const s = playing(levelText(30));
    s.phase = 'warping';
    expect(trackFor(s)).toBe('level1');
  });

  it('plays the bonus track while the player is inside a dark room', () => {
    const s = playing(levelText(30, [], 6, ['dark 20-29']));
    expect(trackFor(s)).toBe('level1');
    s.player.x = 25;
    expect(trackFor(s)).toBe('bonus');
  });

  it('plays a stinger for each ending phase', () => {
    const s = playing(levelText(30));
    const expected: [Phase, string | null][] = [
      ['levelClear', 'levelClear'],
      ['gameOver', 'gameOver'],
      ['won', 'won'],
    ];
    for (const [phase, id] of expected) {
      s.phase = phase;
      expect(trackFor(s)).toBe(id);
    }
  });

  it('is silent on the title screen and while dying', () => {
    const s = playing(levelText(30));
    for (const phase of ['title', 'dying'] as const) {
      s.phase = phase;
      expect(trackFor(s)).toBeNull();
    }
  });
});

describe('notesInWindow', () => {
  const loopTrack: Track = {
    bpm: 120,
    beats: 4,
    loop: true,
    voices: [{ wave: 'square', gain: 1, length: 4, notes: [[0, 60, 1], [2, 64, 1]] }],
  };
  const onceTrack: Track = { ...loopTrack, loop: false };
  const beats = (notes: ReturnType<typeof notesInWindow>) => notes.map((n) => n.beat);

  it('returns the notes that start inside the window, end exclusive', () => {
    expect(beats(notesInWindow(loopTrack, 0, 4))).toEqual([0, 2]);
    expect(beats(notesInWindow(loopTrack, 0, 2))).toEqual([0]);
    expect(beats(notesInWindow(loopTrack, 1, 2))).toEqual([]);
  });

  it('wraps a looping track across loop boundaries', () => {
    expect(beats(notesInWindow(loopTrack, 3, 9))).toEqual([4, 6, 8]);
  });

  it('carries the voice, midi note and length', () => {
    expect(notesInWindow(loopTrack, 2, 3)).toEqual([{ voice: 0, beat: 2, midi: 64, beats: 1 }]);
  });

  it('plays a one-shot track only once', () => {
    expect(beats(notesInWindow(onceTrack, 0, 9))).toEqual([0, 2]);
    expect(notesInWindow(onceTrack, 4, 9)).toEqual([]);
  });
});

describe('createMusic', () => {
  it('starts unmuted and toggles', () => {
    const music = createMusic();
    expect(music.isMuted()).toBe(false);
    expect(music.toggleMute()).toBe(true);
    expect(music.isMuted()).toBe(true);
    expect(music.toggleMute()).toBe(false);
    expect(music.isMuted()).toBe(false);
  });

  it('does nothing, and needs no audio context, on the title screen', () => {
    const s = playing(levelText(30));
    s.phase = 'title';
    expect(() => createMusic().update(s)).not.toThrow();
  });
});
