import type {VerseInput} from '@core/bible/split/splitVerses';
import type {BibleProjection} from './splitProjection';

type Review = (
  projection: BibleProjection,
  references: ReadonlyArray<VerseInput['reference']>,
) => Promise<boolean>;

let review: Review | undefined;

export function installBibleInsertionReview(handler: Review): () => void {
  review = handler;
  return () => {
    if (review === handler) review = undefined;
  };
}

/** An insertion has no service row until its review completes. */
export function reviewBibleInsertion(
  ...request: Parameters<Review>
): Promise<boolean> {
  return review?.(...request) ?? Promise.resolve(false);
}
