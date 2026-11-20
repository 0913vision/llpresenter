/** Converts a received BGRA frame to a 640x360 RGBA preview. */
function previewPixels(source, width, height, stride, alpha = true) {
  const pixels = new Uint8Array(640 * 360 * 4);
  for (let y = 0; y < 360; y++) {
    const row = Math.floor((y * height) / 360) * stride;
    for (let x = 0; x < 640; x++) {
      const s = row + Math.floor((x * width) / 640) * 4;
      const d = (y * 640 + x) * 4;
      pixels[d] = source[s + 2];
      pixels[d + 1] = source[s + 1];
      pixels[d + 2] = source[s];
      pixels[d + 3] = alpha ? source[s + 3] : 255;
    }
  }
  return pixels;
}

module.exports = {previewPixels};
