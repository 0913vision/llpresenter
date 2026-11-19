import {useEffect, useRef, useState, type JSX} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {BibleLookupPassage} from '@core/schema/bibleLookup';
import {createSlideId} from '@core/schema/ids';
import {SLIDES_LIMITS, type VerseSlide} from '@core/schema/service';
import type {SlidesItem} from '@core/services/slidesEdits';
import {passageBook} from '@core/bible/adjacentVerses';
import {versesToReview} from '@core/bible/split/splitVerses';
import {Dialog} from '@renderer/ui/Dialog';
import {useBibleTranslation} from './useBibleTranslation';
import {BiblePassageDialog} from './BiblePassageDialog';
import {SplitReview} from './SplitReview';
import {BibleAddSplitReview} from './BibleAddSplitReview';
import {verseKey} from './BibleRefinements';
import {confirmBibleCuts} from './saveBibleCuts';
import {loadSlidesProjection} from './loadSlidesProjection';
import {useSlidesVerseProjection} from './useSlidesVerseProjection';
import type {BibleProjection} from './splitProjection';

interface Review {
  readonly item: SlidesItem;
  readonly projection: BibleProjection;
  readonly references: ReadonlyArray<VerseSlide['verse']>;
  readonly added: readonly VerseSlide[];
  readonly explicit: boolean;
}

/** Confirms all required cuts before inserting the range as one local draft edit. */
export function BibleSlidesDialog({
  api,
  item,
  selected,
  reference,
  onInsert,
  onClose,
}: {
  readonly api: LlpApi;
  readonly item: SlidesItem;
  readonly selected: number;
  readonly reference?: VerseSlide['verse'];
  readonly onInsert: (slides: readonly VerseSlide[]) => void;
  readonly onClose: () => void;
}): JSX.Element {
  const translation = useBibleTranslation(api);
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(reference !== undefined);
  const [problem, setProblem] = useState<string | null>(null);
  const active = useRef(true);
  const {projection: refreshed, failed: refreshFailed} =
    useSlidesVerseProjection(
      api,
      review?.item ?? item,
      review?.explicit === true,
    );
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
      const addedKeys = new Set(added.map(slide => verseKey(slide.verse)));
      const references = versesToReview(projection.parts).filter(ref =>
        addedKeys.has(verseKey(ref)),
      );
      if (!autoOpen || references.length === 0) {
        finish(added);
      } else {
        setReview({
          item: target,
          projection: {
            ...projection,
            source: {...projection.source, review: true},
          },
          references,
          added,
          explicit: false,
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
  const initial = useRef({api, item, reference});
  useEffect(() => {
    active.current = true;
    const value = initial.current;
    if (value.reference !== undefined) {
      void loadSlidesProjection(
        value.api,
        value.item,
        () => active.current,
      ).then(
        projection => {
          if (
            projection === null ||
            !active.current ||
            value.reference === undefined
          ) {
            return;
          }
          setReview({
            item: value.item,
            projection,
            references: [value.reference],
            added: [],
            explicit: true,
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
    const preferences = await api.preferences.get();
    if (!active.current) return;
    const added = passage.verses.map(verse => ({
      id: createSlideId(crypto.randomUUID()),
      verse: {
        translation: passage.translation,
        book: book.id,
        chapter: verse.chapter,
        verse: verse.verse,
      },
      transition: preferences.show.slideDefaults.bible,
    }));
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
    setLoading(true);
    prepare(target, added, preferences.bible.splitEditorAutoOpen).catch(
      (error: unknown) => {
        if (active.current) {
          setProblem(
            error instanceof Error ? error.message : '성경 구절 불러오기 실패',
          );
        }
      },
    );
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
        title={reference === undefined ? '성경 구절' : '절 나누기'}
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
  const projection =
    !review.explicit || refreshFailed
      ? review.projection
      : (refreshed ?? review.projection);
  if (!review.explicit) {
    return (
      <BibleAddSplitReview
        api={api}
        projection={projection}
        references={review.references}
        onCancel={cancel}
        onComplete={() => finish(review.added)}
      />
    );
  }
  return (
    <SplitReview
      projection={projection}
      references={review.references}
      pending={new Set()}
      onCancel={cancel}
      onConfirm={async (verse, cuts) => {
        await confirmBibleCuts(api.settings, verse, cuts);
      }}
      onComplete={() => finish(review.added)}
    />
  );
}
