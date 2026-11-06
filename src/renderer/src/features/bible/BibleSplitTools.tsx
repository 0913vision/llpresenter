import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
} from 'react';
import {cutsOfVerse, versesToReview} from '@core/bible/split/splitVerses';
import {BIBLE_BOOKS} from '@core/bible/bibleBooks';
import type {VerseSlide} from '@core/schema/service';
import {useSettingsDocument} from '@renderer/platform/useSettingsDocument';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {
  publishSlidesProjection,
  setBibleTileResolver,
} from '@renderer/session/showLibrary';
import {useLive} from '@renderer/session/live';
import {useShow} from '@renderer/session/show';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import {
  BibleProjections,
  splitSourceFor,
  sourceContent,
  type BibleProjection,
} from './splitProjection';
import {SplitEditor} from './SplitEditor';
import {confirmBibleCuts} from './saveBibleCuts';
import {createBibleMeasureContext} from '@renderer/rendering/bibleMeasure';
import {installBibleReviewHandler} from './actions';

interface EditorSession {
  readonly source: BibleProjection;
  readonly references: ReadonlyArray<VerseSlide['verse']>;
  readonly index: number;
  readonly automatic: boolean;
  readonly output?: () => void;
}

/** Installs one shared projection for saved Bible items, the panel, and live navigation. */
export function BibleSplitTools({
  onProblem,
}: {
  readonly onProblem: (notice: Notice) => void;
}): JSX.Element | null {
  const themes = useSettingsDocument('themes', '테마', onProblem);
  const screens = useSettingsDocument('screens', '화면', onProblem);
  const saved = useSettingsDocument('bibleCuts', '절 나누기', onProblem);
  const [measurement, setMeasurement] = useState(() => ({
    canvas: createBibleMeasureContext(),
  }));
  const [session, setSession] = useState<EditorSession | null>(null);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const [seen, setSeen] = useState<BibleProjection['source'] | null>(null);
  useEffect(() => {
    const update = (): void =>
      setMeasurement(value => ({canvas: value.canvas}));
    const fonts = document.fonts;
    if (typeof fonts === 'undefined') return undefined;
    fonts.addEventListener('loadingdone', update);
    return () => fonts.removeEventListener('loadingdone', update);
  }, []);
  const projections = useMemo(
    () =>
      measurement.canvas === null ||
      themes === null ||
      screens === null ||
      saved === null
        ? null
        : new BibleProjections({
            themes: themes.value,
            screens: screens.value.screens,
            saved: saved.value,
            canvas: measurement.canvas,
          }),
    [themes, screens, saved, measurement],
  );
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
  }, [projections, themes, screens, saved]);
  useLayoutEffect(
    () =>
      installBibleReviewHandler((id, output) => {
        const source = splitSourceFor(useShow.getState(), id);
        const projection = source === null ? null : projections?.get(source);
        if (projection === null || projection === undefined) return false;
        const references = versesToReview(projection.parts);
        if (references.length === 0) return false;
        setSession({
          source: projection,
          references,
          index: 0,
          automatic: true,
          output,
        });
        return true;
      }),
    [projections],
  );
  const projection = useShow(view => {
    if (view.openItemId === null || projections === null) return null;
    const source = splitSourceFor(view, view.openItemId);
    return source === null ? null : projections.get(source);
  });
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
    (seen?.id !== projection.source.id ||
      sourceContent(seen) !== sourceContent(projection.source))
  ) {
    setSeen(projection.source);
    const references = versesToReview(projection.parts);
    if (
      references.length > 0 &&
      projection.source.review !== false &&
      session === null
    ) {
      setSession({source: projection, references, index: 0, automatic: true});
    }
  }
  useWindowShortcuts([
    {
      id: 'bible.splitEdit',
      when: () => projection?.partsByTile[selected] != null && session === null,
      run: () => {
        const part = projection?.partsByTile[selected];
        if (projection !== null && part != null) {
          setSession({
            source: projection,
            references: [part.reference],
            index: 0,
            automatic: false,
          });
        }
      },
    },
  ]);
  const reference = session?.references[session.index];
  const current =
    session !== null && projection?.source.id === session.source.source.id
      ? projection
      : session?.source;
  const verse =
    reference === undefined
      ? undefined
      : current?.verses.find(
          verse =>
            verse.reference.translation === reference.translation &&
            verse.reference.book === reference.book &&
            verse.reference.chapter === reference.chapter &&
            verse.reference.verse === reference.verse,
        );
  if (
    session === null ||
    reference === undefined ||
    current === undefined ||
    verse === undefined
  ) {
    return null;
  }
  const prefix = current.numbered ? `${reference.verse} ` : '';
  const cancel = (): void => {
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
    <SplitEditor
      key={`${current.source.id}:${reference.chapter}:${reference.verse}:${session.index}`}
      verse={verse}
      label={`${BIBLE_BOOKS.find(book => book.id === reference.book)?.korean ?? '성경'} ${reference.chapter}:${reference.verse}`}
      cuts={cutsOfVerse(current.parts, reference)}
      layout={current.layout}
      element={current.element}
      appearance={current.appearance}
      prefix={prefix}
      position={session.index}
      total={session.references.length}
      onCancel={cancel}
      onConfirm={async cuts => {
        const api = window.llp;
        if (api === undefined) throw new Error('절 나누기 저장 불가');
        await confirmBibleCuts(api.settings, verse, cuts);
        if (!active.current) return;
        setSession(value =>
          value !== session
            ? value
            : session.index + 1 >= session.references.length
              ? null
              : {...session, index: session.index + 1},
        );
        if (session.index + 1 >= session.references.length) session.output?.();
      }}
    />
  );
}
