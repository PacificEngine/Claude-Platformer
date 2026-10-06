import { createAudio } from './audio/synth';
import { DT } from './core/constants';
import { step } from './core/game';
import { createGame } from './core/state';
import type { Phase } from './core/types';
import { createKeyboardInput } from './input/keyboard';
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
const input = createKeyboardInput(window);
const audio = createAudio();
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
  render(ctx, state, sheet);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
