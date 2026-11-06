import {useEffect, useLayoutEffect, useRef, useState, type JSX} from 'react';
import {versesToReview} from '@core/bible/split/splitVerses';
import type {VerseSlide} from '@core/schema/service';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {
  publishSlidesProjection,
  setBibleTileResolver,
} from '@renderer/session/showLibrary';
import {useLive} from '@renderer/session/live';
import {useShow} from '@renderer/session/show';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import {
  splitSourceFor,
  sourceContent,
  type BibleProjection,
} from './splitProjection';
import {SplitReview} from './SplitReview';
import {verseKey} from './BibleRefinements';
import {useBibleRefinement} from './useBibleRefinement';
import {useBibleReviewPreference} from './useBibleReviewPreference';
import {confirmBibleCuts} from './saveBibleCuts';
import {useBibleProjections} from './useBibleProjections';
import {installBibleReviewHandler} from './actions';

interface EditorSession {
  readonly source: BibleProjection;
  readonly references: ReadonlyArray<VerseSlide['verse']>;
  readonly identity: object | null;
  readonly automatic: boolean;
  readonly output?: () => void;
}

/** Installs one shared projection for saved Bible items, the panel, and live navigation. */
export function BibleSplitTools({
  onProblem,
}: {
  readonly onProblem: (notice: Notice) => void;
}): JSX.Element | null {
  const api = window.llp;
  const autoOpen = useBibleReviewPreference(api?.preferences);
  const {projections, themes, screens, saved, refinementRevision} =
    useBibleProjections({onProblem});
  const [session, setSession] = useState<EditorSession | null>(null);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const [seen, setSeen] = useState<object | null>(null);
  useLayoutEffect(() => () => setBibleTileResolver(null), []);
  useLayoutEffect(() => {
    setBibleTileResolver(
      projections === null
        ? null
        : (view, id) => {
            const source = splitSourceFor(view, id);
            return source === null
              ? null
              : (projections.get(source)?.tiles ?? null);
          },
      themes === null || screens === null || saved === null
        ? null
        : {
            themes: themes.revision,
            screens: screens.revision,
            bibleCuts: saved.revision,
          },
    );
  }, [projections, themes, screens, saved, refinementRevision]);
  const projection = useShow(view => {
    if (view.openItemId === null || projections === null) return null;
    const source = splitSourceFor(view, view.openItemId);
    return source === null ? null : projections.get(source);
  });
  const refinement = useBibleRefinement(api?.bible, projection);
  if (
    session !== null &&
    session.identity === null &&
    refinement.initialized &&
    projection?.source.id === session.source.source.id
  ) {
    setSession({...session, identity: refinement.identity});
  } else if (
    session?.identity != null &&
    session.identity !== refinement.identity
  ) {
    setSession(null);
  }
  useEffect(() => {
    if (session === null || !session.automatic || autoOpen !== false) return;
    let current = true;
    queueMicrotask(() => {
      if (current) {
        setSession(null);
        session.output?.();
      }
    });
    return () => {
      current = false;
    };
  }, [session, autoOpen]);
  useLayoutEffect(
    () =>
      installBibleReviewHandler((id, output) => {
        const source = splitSourceFor(useShow.getState(), id);
        const requested = source === null ? null : projections?.get(source);
        if (
          requested == null ||
          requested.source.review === false ||
          autoOpen === false
        ) {
          return false;
        }
        const references = versesToReview(requested.parts);
        if (references.length === 0) return false;
        setSession({
          source: requested,
          references,
          identity: null,
          automatic: true,
          output,
        });
        return true;
      }),
    [projections, autoOpen],
  );
  const selected = useShow(view => view.selectedTile);
  const liveId = useLive(view => view.state?.layers.slide?.itemId ?? null);
  const liveProjection = useShow(view => {
    if (liveId === null || projections === null) return null;
    const source = splitSourceFor(view, liveId);
    return source === null ? null : projections.get(source);
  });
  useLayoutEffect(() => {
    if (liveId !== null && liveProjection !== null) {
      publishSlidesProjection(useShow.getState(), liveId, liveProjection.tiles);
    }
  }, [liveId, liveProjection]);
  const reported = useRef<object | null>(null);
  useEffect(() => {
    const failedMeasure =
      projection?.parts.some(part => part.problem !== undefined) === true;
    if (
      projection === null ||
      (projection.problem !== 'tile-limit' && !failedMeasure) ||
      reported.current === sourceContent(projection.source)
    ) {
      return;
    }
    reported.current = sourceContent(projection.source);
    onProblem({
      key: 'bible-split:limit',
      kind: 'warning',
      icon: 'warning',
      title: failedMeasure
        ? '성경 구절 나누기 실패'
        : '성경 슬라이드는 10000개까지 표시할 수 있음',
      time: noticeTime(),
    });
  }, [projection, onProblem]);
  if (
    projection !== null &&
    saved !== null &&
    themes !== null &&
    screens !== null &&
    refinement.initialized &&
    autoOpen !== null &&
    (session?.identity == null || session.identity === refinement.identity) &&
    seen !== refinement.identity
  ) {
    const references = versesToReview(projection.parts);
    const first = references[0];
    if (first === undefined || !refinement.pending.has(verseKey(first))) {
      setSeen(refinement.identity);
      if (
        autoOpen &&
        references.length > 0 &&
        projection.source.review !== false &&
        session === null
      ) {
        setSession({
          source: projection,
          references,
          identity: refinement.identity,
          automatic: true,
        });
      }
    }
  }
  useWindowShortcuts([
    {
      id: 'bible.splitEdit',
      when: () => projection?.partsByTile[selected] != null && session === null,
      run: () => {
        const part = projection?.partsByTile[selected];
        if (projection !== null && part != null) {
          refinement.cancel();
          setSession({
            source: projection,
            references: [part.reference],
            identity: refinement.identity,
            automatic: false,
          });
        }
      },
    },
  ]);
  const current =
    session !== null && projection?.source.id === session.source.source.id
      ? projection
      : session?.source;
  if (session === null || current === undefined) {
    return null;
  }
  const first = session.references[0];
  if (
    session.automatic &&
    (autoOpen !== true ||
      !refinement.initialized ||
      (first !== undefined && refinement.pending.has(verseKey(first))))
  ) {
    return null;
  }
  const cancel = (): void => {
    refinement.cancel();
    setSession(null);
    if (session.automatic && current.source.source === 'external') {
      useShow.setState({bibleSource: null, openItemId: null, selectedTile: 0});
      queueMicrotask(() => {
        if (active.current && useShow.getState().openItemId === null) {
          document
            .querySelector<HTMLInputElement>('input[aria-label="끝절"]')
            ?.focus();
        }
      });
    }
  };
  return (
    <SplitReview
      key={`${current.source.id}:${session.automatic}`}
      projection={current}
      references={session.references}
      pending={session.automatic ? refinement.pending : new Set()}
      onCancel={cancel}
      onConfirm={async (verse, cuts) => {
        const api = window.llp;
        if (api === undefined) throw new Error('절 나누기 저장 불가');
        await confirmBibleCuts(api.settings, verse, cuts);
      }}
      onComplete={() => {
        setSession(null);
        session.output?.();
      }}
    />
  );
}
