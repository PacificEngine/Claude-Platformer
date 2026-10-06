export type TrackId = 'level1' | 'level2' | 'level3' | 'bonus' | 'levelClear' | 'gameOver' | 'won';
export type VoiceWave = 'square' | 'triangle' | 'sawtooth' | 'noise';

/** [startBeat, midiNote, lengthInBeats]; midiNote is 0 for noise hits. */
export type MusicNote = [start: number, midi: number, length: number];

export interface Voice {
  wave: VoiceWave;
  gain: number;
  notes: MusicNote[];
  /** Total beats of the pattern, including rests. */
  length: number;
}

export interface Track {
  bpm: number;
  beats: number;
  loop: boolean;
  voices: Voice[];
}

const SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function parseNote(name: string): number {
  const match = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!match) throw new Error(`Bad note '${name}'`);
  const accidental = match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0;
  return 12 * (Number(match[3]) + 1) + SEMITONES[match[1]] + accidental;
}

export function midiToFreq(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** Parses 'C4:1 R:0.5 x:0.25' — name:beats, with R a rest and x a noise hit. */
export function parsePattern(pattern: string): { notes: MusicNote[]; length: number } {
  const notes: MusicNote[] = [];
  let beat = 0;
  for (const token of pattern.trim().split(/\s+/)) {
    const [name, lengthText] = token.split(':');
    const length = Number(lengthText);
    if (!(length > 0)) throw new Error(`Bad length in '${token}'`);
    if (name === 'x') notes.push([beat, 0, length]);
    else if (name !== 'R') notes.push([beat, parseNote(name), length]);
    beat += length;
  }
  return { notes, length: beat };
}

function voice(wave: VoiceWave, gain: number, pattern: string): Voice {
  const { notes, length } = parsePattern(pattern);
  return { wave, gain, notes, length };
}

const repeat = (pattern: string, times: number): string => Array<string>(times).fill(pattern).join(' ');

export const TRACKS: Record<TrackId, Track> = {
  // Grassland: bright and bouncy, C major.
  level1: {
    bpm: 140,
    beats: 16,
    loop: true,
    voices: [
      voice(
        'square',
        1,
        'E5:0.5 E5:0.5 R:0.5 G5:0.5 E5:1 C5:1  D5:0.5 D5:0.5 R:0.5 F5:0.5 D5:1 B4:1  ' +
          'C5:0.5 E5:0.5 G5:0.5 C6:0.5 B5:1 G5:1  A5:0.5 G5:0.5 E5:0.5 D5:0.5 C5:2',
      ),
      voice('triangle', 0.8, 'C3:1 G3:1 C3:1 G3:1  G2:1 D3:1 G2:1 D3:1  C3:1 G3:1 C3:1 G3:1  F2:1 C3:1 G2:2'),
      voice('noise', 0.3, repeat('x:0.25 R:0.75', 16)),
    ],
  },
  // Pits and platforms: a little tenser, A minor.
  level2: {
    bpm: 150,
    beats: 16,
    loop: true,
    voices: [
      voice(
        'square',
        1,
        'A4:0.5 C5:0.5 E5:0.5 A5:0.5 G5:1 E5:1  F5:0.5 A5:0.5 C6:0.5 A5:0.5 G5:1 E5:1  ' +
          'D5:0.5 F5:0.5 A5:0.5 F5:0.5 E5:1 C5:1  B4:0.5 D5:0.5 E5:0.5 G#4:0.5 A4:2',
      ),
      voice('triangle', 0.8, 'A2:1 E3:1 A2:1 E3:1  F2:1 C3:1 F2:1 C3:1  D2:1 A2:1 D2:1 A2:1  E2:1 B2:1 E2:2'),
      voice('noise', 0.3, repeat('x:0.25 R:0.25', 32)),
    ],
  },
  // Gauntlet: driving, D minor.
  level3: {
    bpm: 165,
    beats: 16,
    loop: true,
    voices: [
      voice(
        'sawtooth',
        0.7,
        'D5:0.5 D5:0.5 F5:0.5 D5:0.5 A5:1 G5:1  F5:0.5 F5:0.5 A5:0.5 F5:0.5 C6:1 A5:1  ' +
          'G5:0.5 G5:0.5 Bb5:0.5 G5:0.5 D6:1 Bb5:1  A5:0.5 G5:0.5 F5:0.5 E5:0.5 D5:2',
      ),
      voice(
        'square',
        0.5,
        `${repeat('D2:0.5', 8)} ${repeat('F2:0.5', 8)} ${repeat('G2:0.5', 8)} ${repeat('A2:0.5', 4)} ${repeat('D2:0.5', 4)}`,
      ),
      voice('noise', 0.35, repeat('x:0.25 R:0.25', 32)),
    ],
  },
  // Bonus room: calm, C major pentatonic.
  bonus: {
    bpm: 100,
    beats: 16,
    loop: true,
    voices: [
      voice('triangle', 1, 'E5:1 G5:1 A5:2  G5:1 E5:1 D5:2  C5:1 D5:1 E5:2  D5:1 C5:1 A4:2'),
      voice(
        'square',
        0.35,
        'C4:0.5 E4:0.5 G4:0.5 E4:0.5 C4:0.5 E4:0.5 G4:0.5 E4:0.5  ' +
          'G3:0.5 B3:0.5 D4:0.5 B3:0.5 G3:0.5 B3:0.5 D4:0.5 B3:0.5  ' +
          'A3:0.5 C4:0.5 E4:0.5 C4:0.5 A3:0.5 C4:0.5 E4:0.5 C4:0.5  ' +
          'F3:0.5 A3:0.5 C4:0.5 A3:0.5 G3:0.5 B3:0.5 D4:0.5 B3:0.5',
      ),
    ],
  },
  levelClear: {
    bpm: 150,
    beats: 5,
    loop: false,
    voices: [
      voice('square', 1, 'C5:0.5 E5:0.5 G5:0.5 C6:0.5 E6:1 C6:0.25 E6:0.25 G6:0.75'),
      voice('triangle', 0.8, 'C3:1 G3:1 C3:1 G3:1 C3:0.75'),
    ],
  },
  gameOver: {
    bpm: 90,
    beats: 8,
    loop: false,
    voices: [voice('triangle', 1, 'G4:1 E4:1 C4:1 A3:1 G3:3 R:1')],
  },
  won: {
    bpm: 140,
    beats: 12,
    loop: false,
    voices: [
      voice('square', 1, 'C5:0.5 C5:0.5 C5:0.5 C5:1 G4:1 A4:1 C5:0.5 A4:0.5 C5:3'),
      voice('triangle', 0.8, 'C3:2 F3:2 C3:2 G3:2 C3:4'),
    ],
  },
};
