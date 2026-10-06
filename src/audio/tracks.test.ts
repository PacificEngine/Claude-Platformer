import { describe, expect, it } from 'vitest';
import { LEVEL_CLEAR_TIME } from '../core/constants';
import { midiToFreq, parseNote, parsePattern, TRACKS, type TrackId } from './tracks';

describe('parseNote', () => {
  it('maps note names to MIDI numbers', () => {
    expect(parseNote('C4')).toBe(60);
    expect(parseNote('A4')).toBe(69);
    expect(parseNote('C#5')).toBe(73);
    expect(parseNote('Bb4')).toBe(70);
  });

  it('rejects bad names', () => {
    expect(() => parseNote('H4')).toThrow(/Bad note/);
    expect(() => parseNote('C')).toThrow(/Bad note/);
  });
});

describe('midiToFreq', () => {
  it('uses A4 = 440 Hz', () => {
    expect(midiToFreq(69)).toBeCloseTo(440);
    expect(midiToFreq(81)).toBeCloseTo(880);
  });
});

describe('parsePattern', () => {
  it('turns tokens into timed notes and adds up rests', () => {
    expect(parsePattern('C4:1 R:0.5 E4:2')).toEqual({
      notes: [[0, 60, 1], [1.5, 64, 2]],
      length: 3.5,
    });
  });

  it('reads x as a noise hit with midi 0', () => {
    expect(parsePattern('x:0.25 R:0.75')).toEqual({ notes: [[0, 0, 0.25]], length: 1 });
  });

  it('rejects a token with no positive length', () => {
    expect(() => parsePattern('C4')).toThrow(/Bad length/);
    expect(() => parsePattern('C4:0')).toThrow(/Bad length/);
  });
});

describe('TRACKS', () => {
  const entries = Object.entries(TRACKS) as [TrackId, (typeof TRACKS)[TrackId]][];

  it('has all seven tracks', () => {
    expect(Object.keys(TRACKS).sort()).toEqual(
      ['bonus', 'gameOver', 'level1', 'level2', 'level3', 'levelClear', 'won'].sort(),
    );
  });

  it.each(entries)('%s is well-formed', (_id, track) => {
    expect(track.bpm).toBeGreaterThan(0);
    expect(track.beats).toBeGreaterThan(0);
    expect(track.voices.length).toBeGreaterThan(0);
    for (const voice of track.voices) {
      expect(voice.gain).toBeGreaterThan(0);
      expect(voice.gain).toBeLessThanOrEqual(1);
      expect(voice.length).toBeLessThanOrEqual(track.beats);
      for (const [start, midi, length] of voice.notes) {
        expect(start).toBeGreaterThanOrEqual(0);
        expect(length).toBeGreaterThan(0);
        expect(start + length).toBeLessThanOrEqual(track.beats);
        if (voice.wave !== 'noise') {
          expect(midi).toBeGreaterThanOrEqual(21);
          expect(midi).toBeLessThanOrEqual(108);
        }
      }
    }
  });

  it.each(entries.filter(([, track]) => track.loop))('%s loops cleanly: every voice fills the loop exactly', (_id, track) => {
    for (const voice of track.voices) expect(voice.length).toBe(track.beats);
  });

  it('loops the level and bonus themes and plays the stingers once', () => {
    for (const id of ['level1', 'level2', 'level3', 'bonus'] as const) expect(TRACKS[id].loop).toBe(true);
    for (const id of ['levelClear', 'gameOver', 'won'] as const) expect(TRACKS[id].loop).toBe(false);
  });

  it('the level-clear stinger fits inside the level-clear phase', () => {
    const seconds = (TRACKS.levelClear.beats * 60) / TRACKS.levelClear.bpm;
    expect(seconds).toBeLessThanOrEqual(LEVEL_CLEAR_TIME);
  });
});
