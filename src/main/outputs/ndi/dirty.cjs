const {Buffer} = require('node:buffer');

const straight = Buffer.alloc(256 * 256);
for (let a = 1; a < 255; a++) {
  for (let c = 0; c < 256; c++) {
    straight[a * 256 + c] = Math.min(255, Math.round((c * 255) / a));
  }
}

/** Applies premultiplied BGRA dirty pixels to a persistent straight-alpha frame. */
function applyDirty(frame, region, {width, height}) {
  const {x, y, width: w, height: h, data} = region;
  if (
    ![x, y, w, h].every(Number.isInteger) ||
    x < 0 ||
    y < 0 ||
    w <= 0 ||
    h <= 0 ||
    x + w > width ||
    y + h > height ||
    data.byteLength !== w * h * 4 ||
    frame.length !== width * height * 4
  ) {
    throw new Error('Invalid NDI dirty rectangle');
  }
  const source = new Uint32Array(
    data.buffer,
    data.byteOffset,
    data.byteLength / 4,
  );
  const target = new Uint32Array(
    frame.buffer,
    frame.byteOffset,
    frame.byteLength / 4,
  );
  for (let row = 0; row < h; row++) {
    const start = row * w;
    const base = (y + row) * width + x;
    target.set(source.subarray(start, start + w), base);
    for (let col = 0; col < w;) {
      const src = start + col;
      if (
        col + 8 <= w &&
        (source[src] |
          source[src + 1] |
          source[src + 2] |
          source[src + 3] |
          source[src + 4] |
          source[src + 5] |
          source[src + 6] |
          source[src + 7]) ===
          0
      ) {
        col += 8;
        continue;
      }
      const pixel = source[src];
      const alpha = pixel >>> 24;
      if (alpha === 0) target[base + col] = 0;
      else if (alpha !== 255) {
        const table = alpha * 256;
        target[base + col] =
          (alpha << 24) |
          (straight[table + ((pixel >>> 16) & 255)] << 16) |
          (straight[table + ((pixel >>> 8) & 255)] << 8) |
          straight[table + (pixel & 255)];
      }
      col++;
    }
  }
}
module.exports = {applyDirty};
