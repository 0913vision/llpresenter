import {children, descendants, named, numberAttribute} from './powerpointXml';

/**
 * A resolved color. The red, green and blue channels and the alpha run from 0
 * to 1.
 */
export interface PowerPointColor {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly alpha: number;
}

/**
 * The theme colors of a deck by name, and the mapping from the color names that
 * slides use (such as `bg1`) to them.
 */
export interface PowerPointPalette {
  readonly colors: ReadonlyMap<string, Element>;
  readonly mapping: ReadonlyMap<string, string>;
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
/**
 * Resolves a color element to its channels. It follows theme colors and applies
 * the element's transforms (alpha, luminance, shade, tint). An unknown or
 * circular color is black.
 */
export function resolveColor(
  node: Element,
  palette: PowerPointPalette,
  depth = 0,
): PowerPointColor {
  return children(node).reduce(transform, baseColor(node, palette, depth));
}

const DEFAULT_MAPPING = new Map([
  ['bg1', 'lt1'],
  ['tx1', 'dk1'],
  ['bg2', 'lt2'],
  ['tx2', 'dk2'],
]);

/** The theme colors of a slide, through what its layout and master map. */
export function paletteOf(
  parts: readonly Element[],
  theme: Element | undefined,
): PowerPointPalette {
  const colors = new Map<string, Element>();
  const scheme = theme && descendants(theme, 'clrScheme')[0];
  for (const entry of scheme ? children(scheme) : []) {
    const color = children(entry)[0];
    if (color) colors.set(entry.localName, color);
  }
  let mapping = new Map(DEFAULT_MAPPING);
  let masterMapping = new Map(mapping);
  for (const part of parts) {
    const override = named(part, 'clrMapOvr')[0];
    if (override && named(override, 'masterClrMapping').length > 0) {
      mapping = new Map(masterMapping);
      continue;
    }
    const map =
      (override && named(override, 'overrideClrMapping')[0]) ??
      named(part, 'clrMap')[0];
    if (!map) continue;
    for (const attr of Array.from(map.attributes)) {
      mapping.set(attr.name, attr.value);
    }
    if (part.localName === 'sldMaster') masterMapping = new Map(mapping);
  }
  return {colors, mapping};
}
