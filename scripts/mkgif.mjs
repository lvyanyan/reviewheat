// 把 PNG 帧序列拼成 GIF（demo 素材用）
// 用法：npx tsx scripts/mkgif.mjs <out.gif> <帧1.png> <帧2.png> ...（每帧默认 2000ms）
import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import gifenc from 'gifenc';

const { GIFEncoder, quantize, applyPalette } = gifenc;

const [, , outPath, ...frames] = process.argv;
const DURATION_MS = 2200;

const pngs = frames.map((f) => PNG.sync.read(readFileSync(f)));
const width = Math.max(...pngs.map((p) => p.width));
const height = Math.max(...pngs.map((p) => p.height));

const gif = GIFEncoder();
for (const png of pngs) {
  // 统一画布尺寸：不足处用深色背景填充（靠右/下对齐会出现黑边，改为左上对齐并居中裁剪思路——这里直接居中贴）
  const canvas = Buffer.alloc(width * height * 4, 0);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dst = (y * width + x) * 4;
      if (y < png.height && x < png.width) {
        const src = (y * png.width + x) * 4;
        canvas[dst] = png.data[src];
        canvas[dst + 1] = png.data[src + 1];
        canvas[dst + 2] = png.data[src + 2];
        canvas[dst + 3] = 255;
      } else {
        canvas[dst] = 0x16;
        canvas[dst + 1] = 0x18;
        canvas[dst + 2] = 0x1f;
        canvas[dst + 3] = 255;
      }
    }
  }
  const palette = quantize(canvas, 256);
  const index = applyPalette(canvas, palette);
  gif.writeFrame(index, width, height, { palette, delay: DURATION_MS });
}
gif.finish();
writeFileSync(outPath, gif.bytes());
console.log(`written ${outPath} — ${frames.length} frames, ${width}x${height}`);
