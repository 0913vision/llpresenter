import type {JSX} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {VerseInput} from '@core/bible/split/splitVerses';
import type {BibleCutEntry} from '@core/schema/bibleCuts';
import {planSlides} from '@core/bible/split/manualSplit';
import {Dialog} from '@renderer/ui/Dialog';
import {verseKey} from './BibleRefinements';
import {SplitReview} from './SplitReview';
import {confirmBibleCuts} from './saveBibleCuts';
import type {BibleProjection} from './splitProjection';
import {useBibleRefinement} from './useBibleRefinement';

/** Opens at the first ready verse and lets later suggestions arrive in place. */
export function BibleAddSplitReview({
  api,
  projection,
  references,
  onComplete,
  onCancel,
  onConfirmed,
}: {
  readonly api: Pick<LlpApi, 'bible' | 'settings'>;
  readonly projection: BibleProjection;
  readonly references: ReadonlyArray<VerseInput['reference']>;
  readonly onComplete: () => void;
  readonly onCancel: () => void;
  readonly onConfirmed?: (verse: VerseInput, entry: BibleCutEntry) => void;
}): JSX.Element {
  const refinement = useBibleRefinement(api.bible, projection, {references});
  const first = references[0];
  if (
    !refinement.initialized ||
    (first !== undefined && refinement.pending.has(verseKey(first)))
  ) {
    return (
      <Dialog
        title="성경 구절"
        size="s"
        onCancel={onCancel}
        cancelLabel={null}
        initialFocus="surface"
        primary={{label: '취소', onSelect: onCancel}}
      >
        <span role="status">불러오는 중</span>
      </Dialog>
    );
  }
  return (
    <SplitReview
      projection={projection}
      references={references}
      pending={refinement.pending}
      suggestCuts={(verse, prefix) => {
        const suggestion = refinement.suggestCuts(verse, prefix);
        return suggestion !== undefined &&
          planSlides(verse.text, suggestion, {...projection.layout, prefix}).ok
          ? suggestion
          : undefined;
      }}
      onCancel={onCancel}
      onConfirm={async (verse, cuts) => {
        const entry = await confirmBibleCuts(api.settings, verse, cuts);
        onConfirmed?.(verse, entry);
      }}
      onComplete={onComplete}
    />
  );
}
