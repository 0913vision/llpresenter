import type {PowerPointMatrix} from '@core/songs/powerpointLayers';
import {named, numberAttribute} from './powerpointXml';

export const IDENTITY: PowerPointMatrix = {a: 1, b: 0, c: 0, d: 1, e: 0, f: 0};
export function multiply(
  x: PowerPointMatrix,
  y: PowerPointMatrix,
): PowerPointMatrix {
  return {
    a: x.a * y.a + x.c * y.b,
    b: x.b * y.a + x.d * y.b,
    c: x.a * y.c + x.c * y.d,
    d: x.b * y.c + x.d * y.d,
    e: x.a * y.e + x.c * y.f + x.e,
    f: x.b * y.e + x.d * y.f + x.f,
  };
}
export function shapeTransform(xfrm: Element | undefined): PowerPointMatrix {
  const off = xfrm ? named(xfrm, 'off')[0] : undefined;
  const ext = xfrm ? named(xfrm, 'ext')[0] : undefined;
  const width = numberAttribute(ext, 'cx');
  const height = numberAttribute(ext, 'cy');
  const x = numberAttribute(off, 'x');
  const y = numberAttribute(off, 'y');
  const rotation = ((numberAttribute(xfrm, 'rot') / 60000) * Math.PI) / 180;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const horizontal =
    xfrm?.getAttribute('flipH') === '1' ||
    xfrm?.getAttribute('flipH') === 'true'
      ? -1
      : 1;
  const vertical =
    xfrm?.getAttribute('flipV') === '1' ||
    xfrm?.getAttribute('flipV') === 'true'
      ? -1
      : 1;
  const a = cos * width * horizontal;
  const b = sin * width * horizontal;
  const c = -sin * height * vertical;
  const d = cos * height * vertical;
  return {
    a,
    b,
    c,
    d,
    e: x + width / 2 - (a + c) / 2,
    f: y + height / 2 - (b + d) / 2,
  };
}
export function groupTransform(xfrm: Element | undefined): PowerPointMatrix {
  if (!xfrm) return IDENTITY;
  const off = named(xfrm, 'chOff')[0];
  const ext = named(xfrm, 'chExt')[0];
  const width = numberAttribute(ext, 'cx', 1) || 1;
  const height = numberAttribute(ext, 'cy', 1) || 1;
  return multiply(shapeTransform(xfrm), {
    a: 1 / width,
    b: 0,
    c: 0,
    d: 1 / height,
    e: -numberAttribute(off, 'x') / width,
    f: -numberAttribute(off, 'y') / height,
  });
}
