import {useEffect, useRef, useState, type JSX} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {BibleLookupPassage} from '@core/schema/bibleLookup';
import type {BibleCutEntry} from '@core/schema/bibleCuts';
import {createSlideId} from '@core/schema/ids';
import {SLIDES_LIMITS, type VerseSlide} from '@core/schema/service';
import type {SlidesItem} from '@core/services/slidesEdits';
import {passageBook} from '@core/bible/adjacentVerses';
import {versesToReview} from '@core/bible/split/splitVerses';
import {knownCutEntryFor} from '@core/bible/split/splitCache';
import {Dialog} from '@renderer/ui/Dialog';
import {useBibleTranslation} from './useBibleTranslation';
import {BiblePassageDialog} from './BiblePassageDialog';
import {SplitReview} from './SplitReview';
import {BibleAddSplitReview} from './BibleAddSplitReview';
import {verseKey} from './BibleRefinements';
import {confirmBibleCuts} from './saveBibleCuts';
import {loadSlidesProjection} from './loadSlidesProjection';
import type {BibleProjection} from './splitProjection';

interface Review {
  readonly projection: BibleProjection;
  readonly references: ReadonlyArray<VerseSlide['verse']>;
  readonly added: readonly VerseSlide[];
  readonly slideId?: VerseSlide['id'];
}

function forRows(
  projection: BibleProjection,
  ids: ReadonlySet<string>,
): BibleProjection {
  const parts = projection.partsByTile.flatMap((part, index) => {
    const id = projection.tiles[index]?.sourceSlideId;
    return part !== null && id !== undefined && ids.has(id) ? [part] : [];
  });
  return {...projection, parts};
}

/** Confirms all required cuts before inserting the range as one local draft edit. */
export function BibleSlidesDialog({
  api,
  item,
  selected,
  slideId,
  onInsert,
  onConfirmCut,
  onClose,
}: {
  readonly api: LlpApi;
  readonly item: SlidesItem;
  readonly selected: number;
  readonly slideId?: VerseSlide['id'];
  readonly onInsert: (slides: readonly VerseSlide[]) => void;
  readonly onConfirmCut?: (id: VerseSlide['id'], cut: BibleCutEntry) => void;
  readonly onClose: () => void;
}): JSX.Element {
  const translation = useBibleTranslation(api);
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(slideId !== undefined);
  const [problem, setProblem] = useState<string | null>(null);
  const active = useRef(true);
  const confirmed = useRef(new Map<string, BibleCutEntry>());
  const cancel = (): void => {
    active.current = false;
    onClose();
  };
  const finish = (added: readonly VerseSlide[]): void => {
    if (!active.current) return;
    active.current = false;
    if (added.length > 0) onInsert(added);
    onClose();
  };
  const prepare = async (
    target: SlidesItem,
    added: readonly VerseSlide[],
    autoOpen: boolean,
  ): Promise<void> => {
    try {
      const projection = await loadSlidesProjection(
        api,
        target,
        () => active.current,
      );
      if (projection === null || !active.current) return;
      const proposed = forRows(
        projection,
        new Set(added.map(slide => slide.id)),
      );
      const references = versesToReview(proposed.parts);
      if (!autoOpen || references.length === 0) {
        finish(added);
      } else {
        setReview({
          projection: {
            ...proposed,
            source: {...projection.source, review: true},
          },
          references,
          added,
        });
      }
    } catch (error: unknown) {
      if (active.current) {
        setProblem(
          error instanceof Error ? error.message : '성경 구절 불러오기 실패',
        );
      }
    } finally {
      if (active.current) setLoading(false);
    }
  };
  const initial = useRef({api, item, slideId});
  useEffect(() => {
    active.current = true;
    const value = initial.current;
    const id = value.slideId;
    if (id !== undefined) {
      void loadSlidesProjection(
        value.api,
        value.item,
        () => active.current,
      ).then(
        projection => {
          if (projection === null || !active.current) {
            return;
          }
          const chosen = forRows(projection, new Set([id]));
          const part = chosen.parts[0];
          if (part === undefined) {
            setProblem('성경 구절 불러오기 실패');
            setLoading(false);
            return;
          }
          setReview({
            projection: chosen,
            references: [part.reference],
            added: [],
            slideId: id,
          });
          setLoading(false);
        },
        (error: unknown) => {
          if (active.current) {
            setProblem(
              error instanceof Error
                ? error.message
                : '성경 구절 불러오기 실패',
            );
            setLoading(false);
          }
        },
      );
    }
    return () => {
      active.current = false;
    };
  }, []);
  const choose = async (passage: BibleLookupPassage): Promise<void> => {
    const book = passageBook(passage);
    if (book === undefined) {
      setProblem('성경 구절 불러오기 실패');
      return;
    }
    setLoading(true);
    const [preferences, saved] = await Promise.all([
      api.preferences.get(),
      api.settings.get({name: 'bibleCuts'}),
    ]);
    if (!active.current) return;
    const added = passage.verses.map((verse): VerseSlide => {
      const reference = {
        translation: passage.translation,
        book: book.id,
        chapter: verse.chapter,
        verse: verse.verse,
      };
      const cut =
        saved.name === 'bibleCuts'
          ? knownCutEntryFor(saved.value, reference, verse.text)
          : undefined;
      return {
        id: createSlideId(crypto.randomUUID()),
        verse: reference,
        transition: preferences.show.slideDefaults.bible,
        ...(cut === undefined ? {} : {cut}),
      };
    });
    const at = Math.min(selected + 1, item.slides.slides.length);
    const target = {
      ...item,
      slides: {
        ...item.slides,
        slides: [
          ...item.slides.slides.slice(0, at),
          ...added,
          ...item.slides.slides.slice(at),
        ],
      },
    };
    await prepare(target, added, preferences.bible.splitEditorAutoOpen);
  };
  if (problem !== null) {
    return (
      <Dialog
        title="성경 구절"
        size="s"
        onCancel={cancel}
        primary={{label: '닫기', onSelect: cancel}}
      >
        <span role="alert">{problem}</span>
      </Dialog>
    );
  }
  if (review === null && loading) {
    return (
      <Dialog
        title={slideId === undefined ? '성경 구절' : '절 나누기'}
        size="s"
        onCancel={cancel}
        initialFocus="surface"
        primary={{label: '확정', disabled: true, onSelect: () => undefined}}
      >
        <span role="status">불러오는 중</span>
      </Dialog>
    );
  }
  if (review === null) {
    return (
      <BiblePassageDialog
        api={api.bible}
        translation={translation}
        limit={SLIDES_LIMITS.slides - item.slides.slides.length}
        onChoose={passage => {
          void choose(passage).catch((error: unknown) => {
            if (active.current) {
              setLoading(false);
              setProblem(
                error instanceof Error
                  ? error.message
                  : '성경 구절 불러오기 실패',
              );
            }
          });
        }}
        onClose={cancel}
      />
    );
  }
  const reviewedSlide = review.slideId;
  if (reviewedSlide === undefined) {
    return (
      <BibleAddSplitReview
        api={api}
        projection={review.projection}
        references={review.references}
        onCancel={cancel}
        onConfirmed={(verse, entry) =>
          confirmed.current.set(verseKey(verse.reference), entry)
        }
        onComplete={() =>
          finish(
            review.added.map(slide => {
              const cut = confirmed.current.get(verseKey(slide.verse));
              return cut === undefined ? slide : {...slide, cut};
            }),
          )
        }
      />
    );
  }
  return (
    <SplitReview
      projection={review.projection}
      references={review.references}
      pending={new Set()}
      onCancel={cancel}
      onConfirm={async (verse, cuts) => {
        const entry = await confirmBibleCuts(api.settings, verse, cuts);
        if (active.current) onConfirmCut?.(reviewedSlide, entry);
      }}
      onComplete={() => finish(review.added)}
    />
  );
}
