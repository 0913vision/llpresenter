import type {TranslationId} from '@core/schema/common/ids';

/**
 * One row the 주소 field suggests: a book or a recent passage, under its group
 * heading, with the text it puts into the field.
 */
export interface BibleSuggestion {
  readonly bookId?: number | undefined;
  /** Tells the rows apart, also between groups. */
  readonly key: string;
  /** The heading the row sits under; rows of one group follow each other. */
  readonly group: string;
  /** The text the row puts into the field when it is chosen. */
  readonly input: string;
  readonly translation: TranslationId | undefined;
  /** How many verses the passage holds, shown as `12절`. */
  readonly count?: number | undefined;
  readonly ref?: string | undefined;
}
