import type {ReactNode} from 'react';
import type {Slide} from '@core/services/slidesEdits';
export type SlideSurfaceMode = 'list' | 'grid';

/** A projected position or a stable source ID, which can represent several verse parts. */
export type RenderSlideTextFields = (slide?: number | string) => ReactNode;

/** Return custom card contents for a slide, or undefined for the standard row or cell. */
export type SlideCardRenderer<T = Slide> = (
  slide: T,
  index: number,
  mode: SlideSurfaceMode,
) => ReactNode | undefined;

/** An item-owned card preceding its content slides. */
export interface LeadingSlideCard {
  readonly label?: string | undefined;
  readonly mixedSelection?: boolean;
  readonly render: (mode: SlideSurfaceMode) => ReactNode;
  readonly onDelete: () => void;
  readonly onSelectChange?: ((selected: boolean) => void) | undefined;
}

/** A virtual item for measuring an item-owned leading card. */
export const LEADING_CARD_WINDOW_ITEM = {lines: ['', '', '']} as const;
