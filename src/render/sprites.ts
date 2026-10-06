import { PALETTE, SPRITES, type SpriteName } from './spriteData';

export type SpriteSheet = Record<SpriteName, HTMLCanvasElement>;

function bake(rows: readonly string[]): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = rows[0].length;
  canvas.height = rows.length;
  const g = canvas.getContext('2d')!;
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      g.fillStyle = PALETTE[ch];
      g.fillRect(x, y, 1, 1);
    });
  });
  return canvas;
}

export function bakeSprites(): SpriteSheet {
  const entries = (Object.keys(SPRITES) as SpriteName[]).map(
    (name): [SpriteName, HTMLCanvasElement] => [name, bake(SPRITES[name])],
  );
  return Object.fromEntries(entries) as SpriteSheet;
}
