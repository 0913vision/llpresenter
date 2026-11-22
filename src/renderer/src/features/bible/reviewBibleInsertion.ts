import type {VerseInput} from '@core/bible/split/splitVerses';
import type {BibleSplit} from './passageSplitter';

export interface BibleInsertionRequest {
  readonly projection: BibleSplit;
  readonly references: ReadonlyArray<VerseInput['reference']>;
}

/** The confirmed texts of each reviewed verse, by its key. */
export type ReviewedVerses = Readonly<Record<string, readonly string[]>>;

type Review = (
  request: BibleInsertionRequest,
) => Promise<ReviewedVerses | null>;

let review: Review | undefined;

export function installBibleInsertionReview(handler: Review): () => void {
  review = handler;
  return () => {
    if (review === handler) review = undefined;
  };
}

/** A passage has no slides until its review is done. */
export function reviewBibleInsertion(
  request: BibleInsertionRequest,
): ReturnType<Review> {
  return review?.(request) ?? Promise.resolve(null);
}
