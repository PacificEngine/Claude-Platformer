import { updateCamera } from './camera';
import { resolvePlayerEnemies, resolveShellHits, killPlayer } from './combat';
import { DT, GRAVITY, MAX_FALL } from './constants';
import { updateEnemies } from './enemies';
import { checkGoal, stepLevelClear } from './goal';
import { collectMushrooms, updateMushrooms } from './mushrooms';
import { collectCoins } from './pickups';
import { updatePlayer } from './player';
import { loadLevel, resetGame } from './state';
import type { GameState, Input } from './types';
import { stepWarping, tryStartWarp } from './warp';

function stepPlaying(s: GameState, input: Input): void {
  if (tryStartWarp(s, input)) return;
  s.timeLeft = Math.max(0, s.timeLeft - DT);
  updatePlayer(s, input);
  updateEnemies(s);
  resolveShellHits(s);
  updateMushrooms(s);
  resolvePlayerEnemies(s);
  if (s.phase === 'playing') {
    collectMushrooms(s);
    collectCoins(s);
  }
  if (s.phase === 'playing' && s.player.y > s.height) killPlayer(s);
  if (s.phase === 'playing') checkGoal(s);
  updateCamera(s);
}

function stepDying(s: GameState): void {
  const p = s.player;
  p.vy = Math.min(p.vy + GRAVITY * DT, MAX_FALL);
  p.y += p.vy * DT;
  s.phaseTimer -= DT;
  if (s.phaseTimer > 0) return;
  if (s.lives <= 0) {
    s.phase = 'gameOver';
  } else {
    loadLevel(s, s.levelIndex, 'small');
    s.phase = 'playing';
  }
}

/** Advances the simulation by one fixed tick. Mutates and returns `s`. */
export function step(s: GameState, input: Input): GameState {
  s.events = [];
  const jumpPressed = input.jump && !s.prevJump;
  switch (s.phase) {
    case 'title':
      if (jumpPressed) s.phase = 'playing';
      break;
    case 'playing':
      stepPlaying(s, input);
      break;
    case 'dying':
      stepDying(s);
      break;
    case 'levelClear':
      stepLevelClear(s);
      break;
    case 'warping':
      stepWarping(s);
      break;
    case 'gameOver':
    case 'won':
      if (jumpPressed) resetGame(s);
      break;
  }
  s.prevJump = input.jump;
  s.prevDown = input.down;
  s.tick += 1;
  return s;
}
