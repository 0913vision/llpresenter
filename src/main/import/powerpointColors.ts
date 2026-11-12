import type {
  PowerPointColor,
  PowerPointFill,
} from '@core/songs/powerpointLayers';
import {POWERPOINT_BACKGROUND_LIMITS as LIMITS} from '@core/songs/powerpointLayers';
import {children, descendants, named, numberAttribute} from './powerpointXml';

export interface PowerPointPalette {
  readonly colors: ReadonlyMap<string, Element>;
  readonly mapping: ReadonlyMap<string, string>;
  readonly placeholder?: PowerPointColor;
}
const BLACK: PowerPointColor = {r: 0, g: 0, b: 0, alpha: 1};
const PRESET: Readonly<Record<string, string>> = {
  black: '000000',
  white: 'ffffff',
  red: 'ff0000',
  blue: '0000ff',
  green: '008000',
  yellow: 'ffff00',
  gray: '808080',
  silver: 'c0c0c0',
};
const clamp = (value: number) => Math.max(0, Math.min(1, value));

function hexColor(value: string): PowerPointColor {
  if (!/^[a-f\d]{6}$/i.test(value)) return BLACK;
  return {
    r: parseInt(value.slice(0, 2), 16) / 255,
    g: parseInt(value.slice(2, 4), 16) / 255,
    b: parseInt(value.slice(4, 6), 16) / 255,
    alpha: 1,
  };
}
function luminance(
  color: PowerPointColor,
  mod: number,
  off: number,
): PowerPointColor {
  const max = Math.max(color.r, color.g, color.b);
  const min = Math.min(color.r, color.g, color.b);
  const light = (max + min) / 2;
  const saturation =
    max === min ? 0 : (max - min) / (1 - Math.abs(2 * light - 1));
  const nextLight = clamp(light * mod + off);
  const chroma = (1 - Math.abs(2 * nextLight - 1)) * saturation;
  const channel = (value: number) =>
    max === min
      ? nextLight
      : ((value - min) / (max - min)) * chroma + nextLight - chroma / 2;
  return {
    ...color,
    r: channel(color.r),
    g: channel(color.g),
    b: channel(color.b),
  };
}
function transform(color: PowerPointColor, item: Element): PowerPointColor {
  const value = numberAttribute(item, 'val') / 100000;
  const channels = (fn: (channel: number) => number): PowerPointColor => ({
    ...color,
    r: clamp(fn(color.r)),
    g: clamp(fn(color.g)),
    b: clamp(fn(color.b)),
  });
  switch (item.localName) {
    case 'alpha':
      return {...color, alpha: clamp(value)};
    case 'alphaMod':
      return {...color, alpha: clamp(color.alpha * value)};
    case 'alphaOff':
      return {...color, alpha: clamp(color.alpha + value)};
    case 'lumMod':
      return luminance(color, value, 0);
    case 'lumOff':
      return luminance(color, 1, value);
    case 'shade':
      return channels(channel => channel * value);
    case 'tint':
      return channels(channel => channel * value + 1 - value);
    case 'redMod':
      return {...color, r: clamp(color.r * value)};
    case 'greenMod':
      return {...color, g: clamp(color.g * value)};
    case 'blueMod':
      return {...color, b: clamp(color.b * value)};
    default:
      return color;
  }
}
function baseColor(
  node: Element,
  palette: PowerPointPalette,
  depth: number,
): PowerPointColor {
  const value = node.getAttribute('val') ?? '';
  switch (node.localName) {
    case 'srgbClr':
      return hexColor(value);
    case 'sysClr':
      return hexColor(node.getAttribute('lastClr') ?? '000000');
    case 'prstClr':
      return hexColor(PRESET[value] ?? '000000');
    case 'scrgbClr': {
      const channel = (name: string) => {
        const linear = numberAttribute(node, name) / 100000;
        return clamp(
          linear <= 0.0031308
            ? linear * 12.92
            : 1.055 * linear ** (1 / 2.4) - 0.055,
        );
      };
      return {r: channel('r'), g: channel('g'), b: channel('b'), alpha: 1};
    }
    case 'schemeClr': {
      if (value === 'phClr') return palette.placeholder ?? BLACK;
      const name = palette.mapping.get(value) ?? value;
      const target = palette.colors.get(name);
      return target && depth < 8
        ? resolveColor(target, palette, depth + 1)
        : BLACK;
    }
    default:
      return BLACK;
  }
}
export function resolveColor(
  node: Element,
  palette: PowerPointPalette,
  depth = 0,
): PowerPointColor {
  return children(node).reduce(transform, baseColor(node, palette, depth));
}
export function fillColor(
  node: Element,
  palette: PowerPointPalette,
): PowerPointColor {
  const color = children(node).find(child => child.localName.endsWith('Clr'));
  return color ? resolveColor(color, palette) : BLACK;
}
export function insets(node: Element | undefined) {
  return {
    left: numberAttribute(node, 'l') / 100000,
    top: numberAttribute(node, 't') / 100000,
    right: numberAttribute(node, 'r') / 100000,
    bottom: numberAttribute(node, 'b') / 100000,
  };
}
export function readFill(
  node: Element,
  palette: PowerPointPalette,
): PowerPointFill | null {
  const solid =
    node.localName === 'solidFill' ? node : named(node, 'solidFill')[0];
  if (solid) return {kind: 'solid', color: fillColor(solid, palette)};
  const gradient =
    node.localName === 'gradFill' ? node : named(node, 'gradFill')[0];
  if (!gradient) return null;
  const linear = named(gradient, 'lin')[0];
  const path = named(gradient, 'path')[0];
  const stops = descendants(gradient, 'gs')
    .slice(0, LIMITS.stops)
    .map(stop => ({
      position: clamp(numberAttribute(stop, 'pos') / 100000),
      color: fillColor(stop, palette),
    }))
    .sort((a, b) => a.position - b.position);
  if (stops.length === 0) return null;
  return {
    kind: 'gradient',
    angle: numberAttribute(linear, 'ang') / 60000,
    scaled: linear?.getAttribute('scaled') !== '0',
    radial: path !== undefined,
    focus: insets(path ? named(path, 'fillToRect')[0] : undefined),
    stops,
  };
}
