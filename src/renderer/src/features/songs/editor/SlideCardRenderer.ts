import type {ReactNode} from 'react';
import type {Slide} from '@core/services/slidesEdits';
export type SlideSurfaceMode = 'list' | 'grid';

/** Return custom card contents for a slide, or undefined for the standard row or cell. */
export type SlideCardRenderer<T = Slide> = (
  slide: T,
  index: number,
  mode: SlideSurfaceMode,
) => ReactNode | undefined;

/** An item-owned card preceding its content slides. */
export interface LeadingSlideCard {
  readonly label?: string | undefined;
  readonly render: (mode: SlideSurfaceMode) => ReactNode;
  readonly onDelete: () => void;
  readonly onSelectChange?: ((selected: boolean) => void) | undefined;
}

/** A virtual item for measuring an item-owned leading card. */
export const LEADING_CARD_WINDOW_ITEM = {lines: ['', '', '']} as const;
