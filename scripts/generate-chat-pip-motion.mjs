import fs from 'node:fs';
import path from 'node:path';

import { PNG } from 'pngjs';

const OUT_DIR = path.resolve('assets/pip-chat-motion');
const SIZE = 160;
const SOURCES = {
  happy: 'assets/onboarding-birds/happy-sparkles-clean.png',
  flying: 'assets/onboarding-birds/flying-wave-clean.png',
  thinking: 'assets/onboarding-birds/thinking-bubble-clean.png',
  coding: 'assets/onboarding-birds/coding-laptop-clean.png',
  walk0: 'assets/pip-anim/pip-frame-00.png',
  walk1: 'assets/pip-anim/pip-frame-01.png',
  walk2: 'assets/pip-anim/pip-frame-02.png',
  walk3: 'assets/pip-anim/pip-frame-03.png',
  fly0: 'assets/pip-anim/pip-frame-04.png',
  fly1: 'assets/pip-anim/pip-frame-05.png',
};

function readPng(filePath) {
  return PNG.sync.read(fs.readFileSync(filePath));
}

function writePng(fileName, image) {
  fs.writeFileSync(path.join(OUT_DIR, fileName), PNG.sync.write(image));
}

function pixelIndex(image, x, y) {
  return (y * image.width + x) * 4;
}

function isOpaque(image, x, y) {
  return image.data[pixelIndex(image, x, y) + 3] > 0;
}

function mainComponentBounds(image) {
  const seen = new Uint8Array(image.width * image.height);
  let best = null;

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const start = y * image.width + x;
      if (seen[start] || !isOpaque(image, x, y)) continue;

      const queue = [start];
      seen[start] = 1;
      let count = 0;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;

      for (let cursor = 0; cursor < queue.length; cursor += 1) {
        const current = queue[cursor];
        const cx = current % image.width;
        const cy = Math.floor(current / image.width);
        count += 1;
        minX = Math.min(minX, cx);
        maxX = Math.max(maxX, cx);
        minY = Math.min(minY, cy);
        maxY = Math.max(maxY, cy);

        for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
          if (nx < 0 || nx >= image.width || ny < 0 || ny >= image.height) continue;
          const next = ny * image.width + nx;
          if (seen[next] || !isOpaque(image, nx, ny)) continue;
          seen[next] = 1;
          queue.push(next);
        }
      }

      if (!best || count > best.count) {
        best = { count, minX, maxX, minY, maxY };
      }
    }
  }

  if (!best) {
    return { x: 0, y: 0, width: image.width, height: image.height };
  }

  const padding = 3;
  const x = Math.max(0, best.minX - padding);
  const y = Math.max(0, best.minY - padding);
  const right = Math.min(image.width - 1, best.maxX + padding);
  const bottom = Math.min(image.height - 1, best.maxY + padding);

  return {
    x,
    y,
    width: right - x + 1,
    height: bottom - y + 1,
  };
}

function fullBounds(image) {
  return {
    x: 0,
    y: 0,
    width: image.width,
    height: image.height,
  };
}

function fillInternalTransparentHoles(image) {
  const next = new PNG({ width: image.width, height: image.height });
  next.data.set(image.data);

  const seen = new Uint8Array(image.width * image.height);
  const queue = [];
  const enqueue = (x, y) => {
    if (x < 0 || x >= image.width || y < 0 || y >= image.height) return;
    const index = y * image.width + x;
    if (seen[index] || image.data[pixelIndex(image, x, y) + 3] !== 0) return;
    seen[index] = 1;
    queue.push(index);
  };

  for (let x = 0; x < image.width; x += 1) {
    enqueue(x, 0);
    enqueue(x, image.height - 1);
  }
  for (let y = 0; y < image.height; y += 1) {
    enqueue(0, y);
    enqueue(image.width - 1, y);
  }

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    const x = current % image.width;
    const y = Math.floor(current / image.width);
    enqueue(x + 1, y);
    enqueue(x - 1, y);
    enqueue(x, y + 1);
    enqueue(x, y - 1);
  }

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const index = y * image.width + x;
      if (image.data[pixelIndex(image, x, y) + 3] !== 0 || seen[index]) continue;
      const dataIndex = pixelIndex(next, x, y);
      next.data[dataIndex] = 255;
      next.data[dataIndex + 1] = 255;
      next.data[dataIndex + 2] = 255;
      next.data[dataIndex + 3] = 255;
    }
  }

  return next;
}

function makeCanvas() {
  return new PNG({ width: SIZE, height: SIZE });
}

function blendPixel(image, x, y, rgba) {
  if (x < 0 || x >= image.width || y < 0 || y >= image.height) return;
  const index = pixelIndex(image, Math.round(x), Math.round(y));
  const srcA = rgba[3] / 255;
  const dstA = image.data[index + 3] / 255;
  const outA = srcA + dstA * (1 - srcA);
  if (outA <= 0) return;

  image.data[index] = Math.round((rgba[0] * srcA + image.data[index] * dstA * (1 - srcA)) / outA);
  image.data[index + 1] = Math.round((rgba[1] * srcA + image.data[index + 1] * dstA * (1 - srcA)) / outA);
  image.data[index + 2] = Math.round((rgba[2] * srcA + image.data[index + 2] * dstA * (1 - srcA)) / outA);
  image.data[index + 3] = Math.round(outA * 255);
}

function fillRect(image, x, y, width, height, rgba) {
  for (let py = Math.round(y); py < Math.round(y + height); py += 1) {
    for (let px = Math.round(x); px < Math.round(x + width); px += 1) {
      blendPixel(image, px, py, rgba);
    }
  }
}

function clearThinkingBubbleArtifacts(image) {
  for (let y = 0; y < 58; y += 1) {
    for (let x = 0; x < 48; x += 1) {
      const index = pixelIndex(image, x, y);
      image.data[index] = 0;
      image.data[index + 1] = 0;
      image.data[index + 2] = 0;
      image.data[index + 3] = 0;
    }
  }

  for (let y = 0; y < 34; y += 1) {
    for (let x = 0; x < 82; x += 1) {
      const index = pixelIndex(image, x, y);
      const red = image.data[index];
      const green = image.data[index + 1];
      const blue = image.data[index + 2];
      const alpha = image.data[index + 3];
      const isBubblePixel = red > 220 && green > 220 && blue > 220;
      const isBubbleOutline = red < 80 && green < 80 && blue < 80;
      if (alpha > 0 && (isBubblePixel || isBubbleOutline)) {
        image.data[index] = 0;
        image.data[index + 1] = 0;
        image.data[index + 2] = 0;
        image.data[index + 3] = 0;
      }
    }
  }
}

function fillPolygon(image, points, rgba) {
  const minY = Math.floor(Math.min(...points.map((point) => point[1])));
  const maxY = Math.ceil(Math.max(...points.map((point) => point[1])));

  for (let y = minY; y <= maxY; y += 1) {
    const intersections = [];
    for (let i = 0; i < points.length; i += 1) {
      const [x1, y1] = points[i];
      const [x2, y2] = points[(i + 1) % points.length];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
        intersections.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
      }
    }
    intersections.sort((a, b) => a - b);
    for (let i = 0; i < intersections.length; i += 2) {
      for (let x = Math.floor(intersections[i]); x <= Math.ceil(intersections[i + 1]); x += 1) {
        blendPixel(image, x, y, rgba);
      }
    }
  }
}

function drawOpeningLaptop(image, progress) {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const outline = [38, 45, 65, 255];
  const screen = [126, 130, 148, 255];
  const screenLight = [182, 185, 200, 255];
  const keyboard = [79, 75, 86, 255];
  const keyboardLight = [137, 132, 145, 255];
  const logo = [245, 247, 252, 255];

  const baseY = 121;
  const left = 43;
  const right = 109;
  const height = 4 + clampedProgress * 38;
  const tilt = clampedProgress * 8;
  const topY = baseY - height;

  fillPolygon(image, [[left - 4, baseY + 1], [right + 7, baseY + 1], [124, 132], [35, 132]], outline);
  fillPolygon(image, [[left, baseY + 3], [right + 3, baseY + 3], [117, 128], [43, 128]], keyboard);
  fillRect(image, 55, 124, 28, 2, keyboardLight);

  if (clampedProgress <= 0.05) {
    fillRect(image, left, baseY - 4, right - left + 7, 6, outline);
    fillRect(image, left + 3, baseY - 3, right - left + 1, 3, screenLight);
    return;
  }

  fillPolygon(image, [[left - 4, topY + tilt - 2], [right + 5, topY - 2], [right + 6, baseY + 2], [left - 6, baseY + 2]], outline);
  fillPolygon(image, [[left, topY + tilt + 2], [right + 1, topY + 1], [right + 1, baseY - 2], [left, baseY - 1]], screen);
  fillPolygon(image, [[left + 5, topY + tilt + 7], [right - 4, topY + 5], [right - 4, baseY - 7], [left + 5, baseY - 6]], screenLight);
  fillRect(image, 73, baseY - 19 * clampedProgress, 7, 7, logo);
}

function drawSource(target, source, crop, options = {}) {
  const scale = options.scale ?? 1;
  const opacity = options.opacity ?? 1;
  const drawWidth = Math.round(crop.width * scale);
  const drawHeight = Math.round(crop.height * scale);
  const offsetX = options.offsetX ?? 0;
  const offsetY = options.offsetY ?? 0;
  const destX = Math.round((SIZE - drawWidth) / 2 + offsetX);
  const destY = Math.round(SIZE - drawHeight - 14 + offsetY);

  for (let y = 0; y < drawHeight; y += 1) {
    for (let x = 0; x < drawWidth; x += 1) {
      const sx = crop.x + Math.min(crop.width - 1, Math.floor((x / drawWidth) * crop.width));
      const sy = crop.y + Math.min(crop.height - 1, Math.floor((y / drawHeight) * crop.height));
      const dx = destX + x;
      const dy = destY + y;
      if (dx < 0 || dx >= SIZE || dy < 0 || dy >= SIZE) continue;

      const srcIndex = pixelIndex(source, sx, sy);
      const alpha = Math.round(source.data[srcIndex + 3] * opacity);
      if (alpha === 0) continue;

      blendPixel(target, dx, dy, [
        source.data[srcIndex],
        source.data[srcIndex + 1],
        source.data[srcIndex + 2],
        alpha,
      ]);
    }
  }
}

function render(fileName, sourceName, options) {
  const image = makeCanvas();
  drawSource(image, sources[sourceName].image, sources[sourceName].crop, options);
  writePng(fileName, image);
}

function renderOpeningTransition(fileName, progress, options = {}) {
  const image = makeCanvas();
  const sourceName = options.sourceName ?? 'coding';
  drawSource(image, sources[sourceName].image, sources[sourceName].crop, {
    scale: 0.5,
    offsetX: options.offsetX ?? 0,
    offsetY: options.offsetY ?? 1,
  });
  if (sourceName === 'thinking') {
    clearThinkingBubbleArtifacts(image);
  }
  drawOpeningLaptop(image, progress);
  writePng(fileName, image);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const sources = Object.fromEntries(
  Object.entries(SOURCES).map(([name, filePath]) => {
    const rawImage = readPng(filePath);
    const isLegacyMotionFrame = name.startsWith('walk') || name.startsWith('fly');
    const image = isLegacyMotionFrame ? fillInternalTransparentHoles(rawImage) : rawImage;
    return [name, { image, crop: isLegacyMotionFrame ? fullBounds(image) : mainComponentBounds(image) }];
  }),
);

render('pip-chat-happy.png', 'happy', { scale: 0.5 });
render('pip-chat-thinking.png', 'thinking', { scale: 0.5 });
render('pip-chat-idle-00.png', 'happy', { scale: 0.5, offsetY: 0 });
renderOpeningTransition('pip-chat-idle-01.png', 0.08);
renderOpeningTransition('pip-chat-idle-02.png', 0.45);
renderOpeningTransition('pip-chat-idle-03.png', 0.85);
render('pip-chat-idle-04.png', 'coding', { scale: 0.5, offsetX: 0, offsetY: 1 });
render('pip-chat-idle-05.png', 'coding', { scale: 0.5, offsetX: 0, offsetY: 1 });
render('pip-chat-idle-06.png', 'coding', { scale: 0.5, offsetX: -1, offsetY: 1 });
render('pip-chat-idle-07.png', 'coding', { scale: 0.5, offsetX: 1, offsetY: 0 });
render('pip-chat-idle-08.png', 'coding', { scale: 0.5, offsetX: 0, offsetY: 1 });
renderOpeningTransition('pip-chat-idle-09.png', 0.7);
renderOpeningTransition('pip-chat-idle-10.png', 0.18);
render('pip-chat-idle-11.png', 'happy', { scale: 0.5, offsetY: 0 });
render('pip-chat-walk-00.png', 'walk0', { scale: 0.44, offsetY: 0 });
render('pip-chat-walk-01.png', 'walk1', { scale: 0.44, offsetY: 0 });
render('pip-chat-walk-02.png', 'walk2', { scale: 0.44, offsetY: 0 });
render('pip-chat-walk-03.png', 'walk3', { scale: 0.44, offsetY: 0 });
render('pip-chat-flight-00.png', 'fly0', { scale: 0.44, offsetY: 0 });
render('pip-chat-flight-01.png', 'fly1', { scale: 0.44, offsetY: 0 });
render('pip-chat-flight-02.png', 'fly0', { scale: 0.44, offsetY: -2 });
render('pip-chat-flight-03.png', 'fly1', { scale: 0.44, offsetY: 1 });
render('pip-chat-jump-00.png', 'happy', { scale: 0.5, offsetY: 4 });
render('pip-chat-land-00.png', 'happy', { scale: 0.5, offsetY: 4 });
render('pip-chat-clap-00.png', 'happy', { scale: 0.5, offsetY: 0 });
render('pip-chat-clap-01.png', 'happy', { scale: 0.5, offsetY: -4 });
render('pip-chat-wave-00.png', 'flying', { scale: 0.47, offsetY: 0 });
render('pip-chat-wave-01.png', 'flying', { scale: 0.47, offsetY: -5 });
