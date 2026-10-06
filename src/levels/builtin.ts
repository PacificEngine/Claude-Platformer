import { LevelBuilder } from './builder';
import { parseLevel } from './format';
import { fromLevels, type LevelSource } from './source';

// Rules that keep every level beatable by the replay bot (and playable by people):
// - gaps are at most 4 wide; walls and pipes at most 3 tall;
// - enemies sit at least ~8 columns past the far side of a gap or obstacle
//   (a running jump travels ~6 columns);
// - floating platforms and blocks only above flat stretches where the bot never
//   jumps (its jump head reaches ~4.4 tiles, so lower ones would be bumped);
// - bonus rooms are sealed, 16 wide, and lie to the right of the flag.

/** Grassland: a gentle intro with a pyramid, a shortcut pipe, a hidden coin and a coin room. */
function level1(): string {
  return new LevelBuilder(96)
    .ground(0, 53).ground(58, 79) // pit at 54-57
    .start(2)
    .blocks(5, 8, '?B?B?')
    .hidden(11, 8, 'coin')
    .stairs(20, 3).wall(23, 3).stairs(26, 3, -1) // a pyramid at 20-26
    .enemy(38, 'g')
    .pipe(31, 2)
    .enemy(46, 'g')
    .pipe(52, 3, 1) // shortcut: warps to the exit pipe at 70, over the pit
    .coins(54, 9, 4)
    .enemy(66, 'g')
    .pipe(70, 2, 2)
    .pipe(74, 2, 3) // bonus room entrance
    .warp(1, 2).warp(3, 4).warp(4, 3)
    .flag(77, 4)
    .room(80, 95).pipe(90, 2, 4).coins(84, 9, 5)
    .toText();
}

/** Pits and platforms: wider gaps, shells, a hidden 1-up, a high ledge and a room with a secret power-up. */
function level2(): string {
  return new LevelBuilder(128)
    .ground(0, 29).ground(34, 59).ground(64, 85).ground(90, 111) // pits at 30-33, 60-63, 86-89
    .start(2)
    .blocks(5, 8, '?M?')
    .hidden(11, 8, 'oneUp')
    .enemy(24, 'g')
    .coins(30, 9, 4)
    .enemy(44, 'k')
    .coins(60, 9, 4)
    .pipe(68, 3, 1) // shortcut: warps to 96, skipping the last pit and the walker
    .enemy(72, 'g')
    .enemy(52, 'k')
    .platform(79, 8, 5).coins(79, 7, 5)
    .coins(86, 9, 4)
    .pipe(96, 2, 2)
    .pipe(102, 2, 3) // bonus room entrance
    .wall(106, 3)
    .warp(1, 2).warp(3, 4).warp(4, 3)
    .flag(110, 4)
    .room(112, 127).pipe(122, 2, 4).coins(116, 9, 6).hidden(118, 7, 'mushroom')
    .toText();
}

/** Gauntlet: four pits, mixed enemies, a hidden warp block to a secret room, a stair climb to the flag. */
function level3(): string {
  return new LevelBuilder(160)
    .ground(0, 19).ground(24, 45).ground(50, 71).ground(76, 127) // pits at 20-23, 46-49, 72-75
    .start(2)
    .blocks(6, 8, '?B?')
    .hidden(12, 8, 'mushroom')
    .coins(20, 9, 4)
    .enemy(37, 'k')
    .enemy(43, 'g')
    .hidden(40, 8, 'warp') // secret: leads to the room at 144-159
    .pipe(28, 2, 7) // where the secret room returns you
    .coins(46, 9, 4)
    .pipe(58, 3, 1) // shortcut: warps to 104
    .coins(72, 9, 4)
    .enemy(86, 'g')
    .enemy(84, 'k')
    .enemy(124, 'g')
    .enemy(92, 'k')
    .pipe(98, 2, 3) // bonus room entrance
    .pipe(104, 2, 2)
    .stairs(110, 3).wall(113, 3)
    .secret(1, 6)
    .warp(1, 2).warp(3, 4).warp(4, 3).warp(6, 7)
    .flag(120, 4)
    .room(128, 143).pipe(138, 2, 4).coins(132, 9, 6)
    .room(144, 159).pipe(154, 2, 6).coins(148, 9, 8).hidden(150, 7, 'coin')
    .toText();
}

export const builtinLevelTexts: string[] = [level1(), level2(), level3()];

export const builtinLevels: LevelSource = fromLevels(builtinLevelTexts.map(parseLevel));
