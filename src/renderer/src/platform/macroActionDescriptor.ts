import type {MacroActionKind} from '@core/schema/macros';

/** The palette groups, in the order the 동작 팔레트 shows them. */
export const MACRO_PALETTE_GROUPS = [
  '화면',
  '지우기',
  '내용',
  '소리',
  '진행',
] as const;

export type MacroPaletteGroup = (typeof MACRO_PALETTE_GROUPS)[number];

/**
 * How a 매크로 action kind presents itself: its name, its icon, and the
 * palette group that lists it. A renderer presentation contract, not a file
 * schema.
 */
export interface MacroActionDescriptor {
  readonly kind: MacroActionKind;
  readonly label: string;
  readonly icon: string;
  readonly paletteGroup: MacroPaletteGroup;
}
