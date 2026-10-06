import { fromLevels, type LevelSource } from './source';
import { parseLevel } from './format';
import { LevelBuilder } from './builder';

// Layout rules that keep every level beatable: gaps are at most 3 wide,
// walls at most 2 tall, and enemies sit at least ~8 columns past the far
// side of a gap (a jump lands about 2 columns beyond it).

function level1(): string {
  return new LevelBuilder(64)
    .ground(0, 27).ground(31, 45).ground(48, 63) // gaps at 28-30 and 46-47
    .start(2)
    .blocks(4, 8, '?BMB?')
    .wall(14, 2)
    .enemy(24, 'g').enemy(38, 'g').enemy(58, 'k')
    .coins(28, 9, 3).coins(46, 9, 2)
    .flag(61, 4)
    .toText();
}

function level2(): string {
  return new LevelBuilder(80)
    .ground(0, 19).ground(23, 39).ground(43, 58).ground(62, 79) // gaps 20-22, 40-42, 59-61
    .start(2)
    .blocks(4, 8, 'B?B')
    .enemy(16, 'g').enemy(34, 'k').enemy(52, 'g').enemy(75, 'g')
    .wall(66, 2)
    .coins(20, 9, 3).coins(40, 9, 3).coins(59, 9, 3)
    .flag(78, 4)
    .toText();
}

function level3(): string {
  return new LevelBuilder(96)
    .ground(0, 17).ground(21, 37).ground(41, 58).ground(62, 78).ground(82, 95) // four 3-wide gaps
    .start(2)
    .blocks(4, 8, '?B?')
    .enemy(12, 'g').enemy(29, 'k').enemy(47, 'g').enemy(68, 'g')
    .wall(88, 2)
    .coins(18, 9, 3).coins(38, 9, 3).coins(59, 9, 3).coins(79, 9, 3)
    .flag(94, 4)
    .toText();
}

export const builtinLevelTexts: string[] = [level1(), level2(), level3()];

export const builtinLevels: LevelSource = fromLevels(builtinLevelTexts.map(parseLevel));
