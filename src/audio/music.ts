import { activeDarkRange } from '../core/camera';
import type { GameState } from '../core/types';
import { getAudioContext } from './context';
import { midiToFreq, TRACKS, type Track, type TrackId, type Voice } from './tracks';

const LEVEL_TRACKS: TrackId[] = ['level1', 'level2', 'level3'];

/** Which track should be playing for this game state, or null for silence. */
export function trackFor(s: GameState): TrackId | null {
  switch (s.phase) {
    case 'playing':
    case 'warping':
      return activeDarkRange(s) ? 'bonus' : LEVEL_TRACKS[s.levelIndex % LEVEL_TRACKS.length];
    case 'levelClear':
      return 'levelClear';
    case 'gameOver':
      return 'gameOver';
    case 'won':
      return 'won';
    default:
      return null; // title and dying are silent
  }
}

export interface ScheduledNote {
  voice: number;
  /** Absolute start beat since the track began (loops keep counting up). */
  beat: number;
  midi: number;
  beats: number;
}

/** The notes whose start falls in [fromBeat, toBeat). Loops wrap; one-shot tracks play once. */
export function notesInWindow(track: Track, fromBeat: number, toBeat: number): ScheduledNote[] {
  const out: ScheduledNote[] = [];
  const firstLoop = Math.floor(fromBeat / track.beats);
  const lastLoop = track.loop ? Math.floor(toBeat / track.beats) : 0;
  for (let loop = firstLoop; loop <= lastLoop; loop++) {
    track.voices.forEach((voice, index) => {
      for (const [start, midi, length] of voice.notes) {
        const beat = loop * track.beats + start;
        if (beat >= fromBeat && beat < toBeat) out.push({ voice: index, beat, midi, beats: length });
      }
    });
  }
  return out;
}

const MUSIC_VOLUME = 0.06;
const LOOKAHEAD_SECONDS = 0.3;
const START_DELAY_SECONDS = 0.05;

export interface Music {
  /** Call once per frame: switches tracks and schedules the next few notes. */
  update(s: GameState): void;
  /** Toggles the music (not the sound effects). Returns the new muted state. */
  toggleMute(): boolean;
  isMuted(): boolean;
}

export function createMusic(): Music {
  let currentId: TrackId | null = null;
  let track: Track | null = null;
  let startTime = 0; // audio-clock time of beat 0 of the current track
  let scheduledTo = 0; // beats already scheduled
  let muted = false;
  let master: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  const active = new Set<AudioScheduledSourceNode>();

  const masterGain = (audio: AudioContext): GainNode => {
    if (!master) {
      master = audio.createGain();
      master.gain.value = muted ? 0 : MUSIC_VOLUME;
      master.connect(audio.destination);
    }
    return master;
  };

  const noiseBuffer = (audio: AudioContext): AudioBuffer => {
    if (!noise) {
      noise = audio.createBuffer(1, audio.sampleRate, audio.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    return noise;
  };

  const startNote = (audio: AudioContext, voice: Voice, midi: number, time: number, length: number): void => {
    const gain = audio.createGain();
    gain.gain.setValueAtTime(voice.gain, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + length);

    let source: AudioScheduledSourceNode;
    if (voice.wave === 'noise') {
      const hit = audio.createBufferSource();
      hit.buffer = noiseBuffer(audio);
      source = hit;
    } else {
      const osc = audio.createOscillator();
      osc.type = voice.wave;
      osc.frequency.value = midiToFreq(midi);
      source = osc;
    }
    source.connect(gain).connect(masterGain(audio));
    source.start(time);
    source.stop(time + length);
    active.add(source);
    source.onended = () => active.delete(source);
  };

  const switchTo = (id: TrackId | null): void => {
    for (const source of active) {
      try {
        source.stop();
      } catch {
        // already stopped
      }
    }
    active.clear();
    currentId = id;
    track = id ? TRACKS[id] : null;
    if (id) {
      startTime = getAudioContext().currentTime + START_DELAY_SECONDS;
      scheduledTo = 0;
    }
  };

  return {
    update(s) {
      const wanted = trackFor(s);
      if (wanted !== currentId) switchTo(wanted);
      if (!track) return;

      const audio = getAudioContext();
      const secondsPerBeat = 60 / track.bpm;
      const nowBeat = (audio.currentTime - startTime) / secondsPerBeat;
      const target = nowBeat + LOOKAHEAD_SECONDS / secondsPerBeat;
      if (target <= scheduledTo) return;

      // Skip notes that are already in the past (e.g. after a stalled tab).
      const from = Math.max(scheduledTo, nowBeat);
      for (const note of notesInWindow(track, from, target)) {
        const voice = track.voices[note.voice];
        startNote(audio, voice, note.midi, startTime + note.beat * secondsPerBeat, note.beats * secondsPerBeat);
      }
      scheduledTo = target;
    },

    toggleMute() {
      muted = !muted;
      if (master) master.gain.setTargetAtTime(muted ? 0 : MUSIC_VOLUME, master.context.currentTime, 0.02);
      return muted;
    },

    isMuted: () => muted,
  };
}
