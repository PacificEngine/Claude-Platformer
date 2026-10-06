import type { EventType, GameEvent } from '../core/types';

type Note = [frequency: number, seconds: number, wave?: OscillatorType];

const SOUNDS: Record<EventType, Note[]> = {
  jump: [[330, 0.06], [523, 0.1]],
  coin: [[988, 0.06, 'square'], [1319, 0.18, 'square']],
  stomp: [[180, 0.1, 'sawtooth']],
  kick: [[260, 0.05, 'square'], [160, 0.08, 'square']],
  sprout: [[392, 0.05], [523, 0.05], [659, 0.1]],
  powerup: [[523, 0.06, 'square'], [659, 0.06, 'square'], [784, 0.06, 'square'], [1047, 0.15, 'square']],
  shrink: [[600, 0.08], [300, 0.2]],
  bump: [[120, 0.08, 'square']],
  break: [[90, 0.12, 'sawtooth']],
  death: [[392, 0.15, 'square'], [330, 0.15, 'square'], [262, 0.4, 'square']],
  flag: [[523, 0.1, 'square'], [659, 0.1, 'square'], [784, 0.1, 'square'], [1047, 0.4, 'square']],
  oneup: [[659, 0.08, 'square'], [784, 0.08, 'square'], [1319, 0.2, 'square']],
  warp: [[392, 0.06, 'square'], [330, 0.06, 'square'], [262, 0.06, 'square'], [196, 0.14, 'square']],
};

export function createAudio(): { play(events: readonly GameEvent[]): void } {
  let context: AudioContext | null = null;

  return {
    play(events) {
      if (events.length === 0) return;
      // Created lazily: events only occur after a key press, which satisfies autoplay policy.
      context ??= new AudioContext();
      const audio = context;
      void audio.resume();
      for (const event of events) {
        let t = audio.currentTime;
        for (const [frequency, seconds, wave = 'triangle'] of SOUNDS[event.type]) {
          const osc = audio.createOscillator();
          const gain = audio.createGain();
          osc.type = wave;
          osc.frequency.value = frequency;
          gain.gain.setValueAtTime(0.08, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + seconds);
          osc.connect(gain).connect(audio.destination);
          osc.start(t);
          osc.stop(t + seconds);
          t += seconds;
        }
      }
    },
  };
}
