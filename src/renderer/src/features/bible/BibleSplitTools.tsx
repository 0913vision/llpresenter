import {withSectionCard} from '@core/services/sectionCards';
import {useShownItemId} from '@renderer/session/shownItem';
import {useEffect, useLayoutEffect, useRef, useState, type JSX} from 'react';
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
  canReviewBiblePart,
  splitSourceFor,
  sourceContent,
  type BibleProjection,
} from './splitProjection';
import {SplitReview} from './SplitReview';
import {confirmBibleCuts} from './saveBibleCuts';
import {updateServiceItem} from '@renderer/session/serviceItemUpdate';
import {isItemOfKind} from '@core/schema/service';
import {biblePartEffect, setBiblePartEffect} from '@core/bible/partTransitions';
import {cacheKey} from '@core/bible/split/splitCache';
import {useBibleProjections} from './useBibleProjections';
import {installBiblePictureProjection} from './prepareBiblePictures';
import {
  applyEditedVerseReview,
  editedVerseReview,
  type EditedVerseReview,
} from './editedVerseReview';

interface EditorSession {
  readonly source: BibleProjection;
  readonly references: ReadonlyArray<VerseSlide['verse']>;
  readonly serviceId: string | null;
  readonly edited?: EditedVerseReview;
}

function reviewSession(
  source: BibleProjection,
  index: number,
  serviceId: string | null,
): EditorSession | null {
  const part = source.partsByTile[index];
  if (part == null || !canReviewBiblePart(source, index)) return null;
  const edited = editedVerseReview(source, part);
  return {
    source,
    references: [part.reference],
    serviceId,
    ...(edited === undefined ? {} : {edited}),
  };
}

/** Installs one shared projection for saved Bible items, the panel, and live navigation. */
export function BibleSplitTools({
  onProblem,
  enableManual = false,
  selectedIndex,
  manualRequest = 0,
}: {
  readonly selectedIndex?: number | undefined;
  readonly manualRequest?: number | undefined;
  readonly enableManual?: boolean;
  readonly onProblem: (notice: Notice) => void;
}): JSX.Element | null {
  const {projections, themes, screens, saved} = useBibleProjections({
    onProblem,
  });
  const [session, setSession] = useState<EditorSession | null>(null);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
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
  }, [projections, themes, screens, saved]);
  const shownItemId = useShownItemId();
  const projection = useShow(view => {
    if (shownItemId === null || projections === null) return null;
    const source = splitSourceFor(view, shownItemId);
    return source === null ? null : projections.get(source);
  });
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
  const lastManualRequest = useRef(manualRequest);
  useEffect(() => {
    if (lastManualRequest.current === manualRequest) return;
    lastManualRequest.current = manualRequest;
    if (!enableManual || projection === null) return;
    const next = reviewSession(
      projection,
      selected,
      useShow.getState().serviceId,
    );
    if (next === null) return;
    queueMicrotask(() => {
      if (active.current) {
        setSession(next);
      }
    });
  }, [manualRequest, enableManual, projection, selected]);
  useWindowShortcuts([
    {
      id: 'bible.splitEdit',
      when: () =>
        enableManual &&
        canReviewBiblePart(projection, selected) &&
        session === null,
      run: () => {
        if (projection !== null) {
          setSession(
            reviewSession(projection, selected, useShow.getState().serviceId),
          );
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
  return (
    <SplitReview
      key={current.source.id}
      projection={session.edited?.projection ?? current}
      references={session.references}
      pending={new Set()}
      onCancel={() => setSession(null)}
      onConfirm={async (verse, cuts) => {
        const api = window.llp;
        if (api === undefined) throw new Error('절 나누기 저장 실패');
        const {edited, serviceId: origin} = session;
        const serviceId = useShow.getState().serviceId;
        if (origin !== serviceId) throw new Error('절 나누기 저장 실패');
        if (edited !== undefined && serviceId !== null) {
          const result = await updateServiceItem(api, {
            serviceId,
            itemId: session.source.source.id,
            change: item => applyEditedVerseReview(item, edited, cuts),
          });
          if (!result.ok) throw new Error('절 나누기 저장 실패');
          return;
        }
        const entry = await confirmBibleCuts(api.settings, verse, cuts);
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
        const transition =
          entry.cuts.length + 1 > oldParts
            ? (await api.preferences.get()).show.slideDefaults.bible
            : undefined;
        const result = await updateServiceItem(api, {
          serviceId,
          itemId: current.source.id,
          change: item => {
            if (!isItemOfKind(item, 'bible') && !isItemOfKind(item, 'sermon')) {
              return null;
            }
            const passage = isItemOfKind(item, 'bible')
              ? item.bible
              : item.sermon.passage;
            if (passage.translation !== verse.reference.translation) {
              return null;
            }
            const updated = {
              ...passage,
              cuts: {...passage.cuts, [cacheKey(verse.reference)]: entry},
            };
            let transitions = item.bibleTransitions ?? [];
            for (
              let part = oldParts + 1;
              part <= entry.cuts.length + 1;
              part++
            ) {
              if (
                transition !== undefined &&
                biblePartEffect(transitions, verse.reference, part) ===
                  undefined
              ) {
                transitions = setBiblePartEffect(
                  transitions,
                  {verse: verse.reference, part},
                  transition,
                );
              }
            }
            return isItemOfKind(item, 'bible')
              ? {...item, bible: updated, bibleTransitions: transitions}
              : {
                  ...item,
                  sermon: {...item.sermon, passage: updated},
                  bibleTransitions: transitions,
                };
          },
        });
        if (!result.ok) throw Error('절 나누기 저장 실패');
      }}
      onComplete={() => setSession(null)}
    />
  );
}
