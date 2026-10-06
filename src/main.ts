import { getAudioContext } from './audio/context';
import { createMusic } from './audio/music';
import { createAudio } from './audio/synth';
import { DT } from './core/constants';
import { step } from './core/game';
import { createGame } from './core/state';
import type { Phase } from './core/types';
import { combineInputs } from './input/combine';
import { createKeyboardInput } from './input/keyboard';
import { createTouchInput } from './input/touch';
import { builtinLevels } from './levels/builtin';
import { VIEW_H, VIEW_W, render } from './render/renderer';
import { bakeSprites } from './render/sprites';
import { createMemorySaveStore, recordProgress } from './save/store';

const canvas = document.getElementById('game') as HTMLCanvasElement;
canvas.width = VIEW_W;
canvas.height = VIEW_H;
const ctx = canvas.getContext('2d')!;

const levels = Array.from({ length: builtinLevels.count() }, (_, i) => builtinLevels.get(i));
const state = createGame(levels);
const audio = createAudio();
const music = createMusic();
const muteButton = document.querySelector<HTMLElement>('[data-action="mute"]');
const syncMuteButton = (): void => {
  muteButton?.classList.toggle('on', music.isMuted());
  muteButton?.setAttribute('aria-pressed', String(music.isMuted()));
};
syncMuteButton();
const input = combineInputs(
  createKeyboardInput(window),
  createTouchInput(document.getElementById('touch-controls')!, {
    onMute: () => {
      const muted = music.toggleMute();
      syncMuteButton();
      return muted;
    },
  }),
);
window.addEventListener('keydown', (event) => {
  if (event.code === 'KeyM' && !event.repeat && !event.metaKey && !event.ctrlKey && !event.altKey) {
    music.toggleMute();
    syncMuteButton();
  }
});
// Browsers (iOS especially) only let audio start inside a user-gesture handler, so touch the shared context on every gesture.
const unlockAudio = (): void => {
  getAudioContext();
};
for (const type of ['pointerdown', 'pointerup', 'touchend', 'keydown']) window.addEventListener(type, unlockAudio);
const sheet = bakeSprites();
const saveStore = createMemorySaveStore();

const SAVE_PHASES = new Set<Phase>(['levelClear', 'gameOver', 'won']);
let lastPhase = state.phase;
let accumulator = 0;
let last = performance.now();

function frame(now: number): void {
  accumulator += Math.min(0.25, (now - last) / 1000);
  last = now;
  while (accumulator >= DT) {
    step(state, input.poll());
    audio.play(state.events);
    if (state.phase !== lastPhase && SAVE_PHASES.has(state.phase)) {
      saveStore.save(recordProgress(saveStore.load(), state.levelIndex, state.score));
    }
    lastPhase = state.phase;
    accumulator -= DT;
  }
  music.update(state);
  render(ctx, state, sheet);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
