import type {VerseInput} from '@core/bible/split/splitVerses';
import type {BibleCutEntry} from '@core/schema/bibleCuts';
import type {BibleProjection} from './splitProjection';

export interface BibleInsertionRequest {
  readonly serviceId: string;
  readonly serviceEpoch: number;
  readonly projection: BibleProjection;
  readonly references: ReadonlyArray<VerseInput['reference']>;
}

type Review = (
  request: BibleInsertionRequest,
) => Promise<Readonly<Record<string, BibleCutEntry>> | null>;

let review: Review | undefined;

export function installBibleInsertionReview(handler: Review): () => void {
  review = handler;
  return () => {
    if (review === handler) review = undefined;
  };
}

/** An insertion has no service row until its review completes. */
export function reviewBibleInsertion(
  request: BibleInsertionRequest,
): ReturnType<Review> {
  return review?.(request) ?? Promise.resolve(null);
}
