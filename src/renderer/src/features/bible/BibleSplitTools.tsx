import {withSectionCard} from '@core/services/sectionCards';
import {useShownItemId} from '@renderer/session/shownItem';
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
import {updateServiceItem} from '@renderer/session/serviceItemUpdate';
import {isItemOfKind} from '@core/schema/service';
import {biblePartEffect, setBiblePartEffect} from '@core/bible/partTransitions';
import {useBibleProjections} from './useBibleProjections';
import {installBibleReviewHandler} from './actions';
import {installBiblePictureProjection} from './prepareBiblePictures';

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
  allowReview = false,
  enableManual = false,
  selectedIndex,
  manualRequest = 0,
}: {
  readonly selectedIndex?: number | undefined;
  readonly manualRequest?: number | undefined;
  readonly allowReview?: boolean;
  readonly enableManual?: boolean;
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
  useLayoutEffect(
    () => installBiblePictureProjection(projections),
    [projections],
  );
  useLayoutEffect(() => () => setBibleTileResolver(null), []);
  useLayoutEffect(() => {
    setBibleTileResolver(
      projections === null
        ? null
        : (view, id) => {
            const source = splitSourceFor(view, id);
            if (source === null) return null;
            const tiles = projections.get(source)?.tiles;
            if (tiles === undefined) return null;
            return withSectionCard(view.tiles[id]?.[0]?.sectionCard, tiles);
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
  const shownItemId = useShownItemId();
  const projection = useShow(view => {
    if (shownItemId === null || projections === null) return null;
    const source = splitSourceFor(view, shownItemId);
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
          !allowReview ||
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
    [projections, autoOpen, allowReview],
  );
  const selected = useShow(
    view =>
      (selectedIndex ?? view.selectedTile) -
      (shownItemId !== null &&
      view.rows.find(row => row.id === shownItemId)?.kind === 'bible' &&
      view.tiles[shownItemId]?.[0]?.sectionCard !== undefined
        ? 1
        : 0),
  );
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
        : '슬라이드는 10000개까지 만들 수 있습니다',
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
        allowReview &&
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
  const lastManualRequest = useRef(manualRequest);
  useEffect(() => {
    if (lastManualRequest.current === manualRequest) return;
    lastManualRequest.current = manualRequest;
    const part = projection?.partsByTile[selected];
    if (!enableManual || projection === null || part == null) return;
    refinement.cancel();
    queueMicrotask(() => {
      if (active.current) {
        setSession({
          source: projection,
          references: [part.reference],
          identity: refinement.identity,
          automatic: false,
        });
      }
    });
  }, [manualRequest, enableManual, projection, selected, refinement]);
  useWindowShortcuts([
    {
      id: 'bible.splitEdit',
      when: () =>
        enableManual &&
        projection?.partsByTile[selected] != null &&
        session === null,
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
        if (api === undefined) throw new Error('절 나누기 저장 실패');
        await confirmBibleCuts(api.settings, verse, cuts);
        const serviceId = useShow.getState().serviceId;
        if (
          current.source.source !== 'service' ||
          current.source.kind !== 'bible' ||
          serviceId === null
        ) {
          return;
        }
        const oldParts = current.parts.filter(
          part =>
            part.reference.translation === verse.reference.translation &&
            part.reference.book === verse.reference.book &&
            part.reference.chapter === verse.reference.chapter &&
            part.reference.verse === verse.reference.verse,
        ).length;
        if (cuts.length + 1 <= oldParts) return;
        const preferences = await api.preferences.get();
        const result = await updateServiceItem(api, {
          serviceId,
          itemId: current.source.id,
          change: item => {
            if (!isItemOfKind(item, 'bible') && !isItemOfKind(item, 'sermon')) {
              return null;
            }
            let transitions = item.bibleTransitions ?? [];
            for (let part = oldParts + 1; part <= cuts.length + 1; part++) {
              if (
                biblePartEffect(transitions, verse.reference, part) ===
                undefined
              ) {
                transitions = setBiblePartEffect(
                  transitions,
                  {verse: verse.reference, part},
                  preferences.show.slideDefaults.bible,
                );
              }
            }
            return {...item, bibleTransitions: transitions};
          },
        });
        if (!result.ok) throw Error('새 구절 전환 저장 실패');
      }}
      onComplete={() => {
        setSession(null);
        session.output?.();
      }}
    />
  );
}
