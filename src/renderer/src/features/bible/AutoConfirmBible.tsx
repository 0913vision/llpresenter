import {useEffect, useRef} from 'react';
import {cutsOfVerse, versesToReview} from '@core/bible/split/splitVerses';
import {useShow} from '@renderer/session/show';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import {confirmDefaultBibleCuts} from './saveBibleCuts';
import {useBibleProjections} from './useBibleProjections';
import {splitSourceFor} from './splitProjection';
import {verseKey} from './BibleRefinements';

/** Accept the measured default in preparation, without replacing a saved cut. */
export function AutoConfirmBible({
  onProblem,
}: {
  readonly onProblem: (notice: Notice) => void;
}): null {
  const {projections, refinementRevision} = useBibleProjections({onProblem});
  const projection = useShow(view => {
    if (view.openItemId === null || projections === null) return null;
    const source = splitSourceFor(view, view.openItemId);
    return source?.source === 'service'
      ? projections.get(source, refinementRevision)
      : null;
  });
  const pending = useRef(new Set<string>());
  useEffect(() => {
    const api = window.llp;
    if (
      api === undefined ||
      projection === null ||
      projection.problem !== undefined
    ) {
      return;
    }
    for (const ref of versesToReview(projection.parts)) {
      const verse = projection.verses.find(
        value => verseKey(value.reference) === verseKey(ref),
      );
      if (verse === undefined) continue;
      const key = `${verseKey(ref)}:${verse.text}`;
      if (pending.current.has(key)) continue;
      pending.current.add(key);
      confirmDefaultBibleCuts(
        api.settings,
        verse,
        cutsOfVerse(projection.parts, ref),
      )
        .catch(() =>
          onProblem({
            key: 'bible-split:auto-save',
            kind: 'warning',
            icon: 'warning',
            title: '\uc808 \ub098\ub204\uae30 \uc800\uc7a5 \uc2e4\ud328',
            time: noticeTime(),
          }),
        )
        .finally(() => pending.current.delete(key))
        .catch((error: unknown) => console.error(error));
    }
  }, [projection, onProblem]);
  return null;
}
