import {useEffect, useRef, useState, type JSX} from 'react';
import type {SlideTile} from '@core/presentation/model';
import {
  cutVerse,
  isPassageItem,
  keptSlides,
  passageOf,
  withPassage,
} from '@core/services/passageEdits';
import type {VerseReference} from '@core/bible/bibleTiles';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {useShow} from '@renderer/session/show';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import {updateServiceItem} from '@renderer/session/serviceItemUpdate';
import {confirmBibleCuts} from './saveBibleCuts';
import {passageSplitter, type BibleSplit} from './passageSplitter';
import {SplitReview} from './SplitReview';

interface Cut {
  readonly itemId: string;
  readonly split: BibleSplit;
  readonly reference: VerseReference;
}

/** Cuts the verse of the selected slide by hand, whatever it shows now. */
export function BibleSplitTools({
  itemId,
  tile,
  request = 0,
  onProblem,
}: {
  readonly itemId: string | null;
  readonly tile: SlideTile | undefined;
  /** Opens the editor each time it changes. */
  readonly request?: number;
  readonly onProblem: (notice: Notice) => void;
}): JSX.Element | null {
  const [cut, setCut] = useState<Cut | null>(null);
  const open = (): void => {
    const view = useShow.getState();
    const row = view.rows.find(entry => entry.id === itemId);
    const reference = tile?.bibleVerse;
    if (
      itemId === null ||
      reference === undefined ||
      row?.kind !== 'bible' ||
      row.bible?.passage === undefined
    ) {
      return;
    }
    const split = passageSplitter()?.split(row.bible.passage, {
      verseNumbers: row.bible.verseNumbers ?? true,
      slides: row.bible.slides,
      theme: row.bible.theme,
    });
    if (split == null) {
      onProblem({
        key: 'bible-split',
        kind: 'warning',
        icon: 'warning',
        title: '성경 구절 나누기 실패',
        time: noticeTime(),
      });
      return;
    }
    setCut({itemId, split, reference});
  };
  const seen = useRef(request);
  useEffect(() => {
    if (seen.current === request) return;
    seen.current = request;
    queueMicrotask(open);
  });
  useWindowShortcuts([
    {
      id: 'bible.splitEdit',
      when: () => cut === null && tile?.bibleVerse !== undefined,
      run: open,
    },
  ]);
  if (cut === null) return null;
  return (
    <SplitReview
      projection={cut.split}
      references={[cut.reference]}
      pending={new Set()}
      onCancel={() => setCut(null)}
      onConfirm={async (verse, {selection, texts}) => {
        const api = window.llp;
        const {serviceId, rows} = useShow.getState();
        const row = rows.find(entry => entry.id === cut.itemId);
        if (
          api === undefined ||
          serviceId === null ||
          row?.kind !== 'bible' ||
          row.bible?.passage === undefined
        ) {
          throw new Error('절 나누기 저장 실패');
        }
        const lookup = row.bible.passage;
        await confirmBibleCuts(api.settings, verse, selection).catch(
          (error: unknown) =>
            console.error('Could not remember the cut of a verse', error),
        );
        const result = await updateServiceItem(api, {
          serviceId,
          itemId: cut.itemId,
          change: item => {
            if (!isPassageItem(item)) return null;
            const passage = passageOf(item);
            return withPassage(item, {
              ...passage,
              slides: cutVerse(keptSlides(passage, lookup), verse.reference, {
                texts,
                transition: passage.transition,
              }),
            });
          },
        });
        if (!result.ok) throw Error('절 나누기 저장 실패');
      }}
      onComplete={() => setCut(null)}
    />
  );
}
