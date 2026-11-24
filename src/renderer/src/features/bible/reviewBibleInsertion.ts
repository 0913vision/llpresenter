import type {VerseInput} from '@core/bible';
import type {BibleSplit} from './passageSplitter';

/**
 * A passage waiting for its review: how it is split and the references of its
 * verses.
 */
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

/**
 * Makes `handler` the review every passage goes through before it gets slides,
 * and returns a function that removes it again.
 */
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
