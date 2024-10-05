// Hex를 RGBA로 변환하는 함수
export const hexToRgba = (hex) => {
  let bigint = parseInt(hex.slice(1), 16);
  let r, g, b, a = 1;

  if (hex.length === 9) { // #RRGGBBAA 형태
    r = (bigint >> 24) & 255;
    g = (bigint >> 16) & 255;
    b = (bigint >> 8) & 255;
    a = (bigint & 255) / 255;
  } else if (hex.length === 7) { // #RRGGBB 형태
    r = (bigint >> 16) & 255;
    g = (bigint >> 8) & 255;
    b = bigint & 255;
  } else {
    r = g = b = 0;
  }

  return { r, g, b, a };
};
// RGBA를 HSVA로 변환하는 함수
export const rgbaToHsva = (r, g, b, a = 1) => {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h, s;
  const v = max;

  s = max === 0 ? 0 : d / max;

  if (max === min) {
    h = 0; // 무채색
  } else {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
      default: h = 0;
    }
    h /= 6;
  }

  return {
    h: h * 360,
    s: s * 100,
    v: v * 100,
    a
  };
};
