import {useEffect, useRef, useState, type JSX} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {BibleLookupPassage} from '@core/schema/bibleLookup';
import {createSlideId} from '@core/schema/ids';
import {SLIDES_LIMITS, type VerseSlide} from '@core/schema/service';
import type {SlidesItem} from '@core/services/slidesEdits';
import {passageBook} from '@core/bible/adjacentVerses';
import {BIBLE_BOOKS} from '@core/bible/bibleBooks';
import {cutsOfVerse, versesToReview} from '@core/bible/split/splitVerses';
import {cacheKey} from '@core/bible/split/splitCache';
import {Dialog} from '@renderer/ui/Dialog';
import {useBibleTranslation} from './useBibleTranslation';
import {BiblePassageDialog} from './BiblePassageDialog';
import {SplitEditor} from './SplitEditor';
import {confirmBibleCuts} from './saveBibleCuts';
import {loadSlidesProjection} from './loadSlidesProjection';
import {useSlidesVerseProjection} from './useSlidesVerseProjection';
import type {BibleProjection} from './splitProjection';

interface Review {
  readonly item: SlidesItem;
  readonly projection: BibleProjection;
  readonly references: ReadonlyArray<VerseSlide['verse']>;
  readonly added: readonly VerseSlide[];
  readonly index: number;
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
  const {projection: refreshed} = useSlidesVerseProjection(
    api,
    review?.item ?? item,
    review !== null,
  );
  const prepare = async (
    target: SlidesItem,
    added: readonly VerseSlide[],
    explicit?: VerseSlide['verse'],
  ): Promise<void> => {
    try {
      const projection = await loadSlidesProjection(
        api,
        target,
        () => active.current,
      );
      if (projection === null || !active.current) return;
      const references =
        explicit === undefined ? versesToReview(projection.parts) : [explicit];
      if (references.length === 0) {
        onInsert(added);
        onClose();
      } else setReview({item: target, projection, references, added, index: 0});
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
            index: 0,
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
  const choose = (passage: BibleLookupPassage): void => {
    const book = passageBook(passage);
    if (book === undefined) {
      setProblem('성경 구절 불러오기 실패');
      return;
    }
    const added = passage.verses.map(verse => ({
      id: createSlideId(crypto.randomUUID()),
      verse: {
        translation: passage.translation,
        book: book.id,
        chapter: verse.chapter,
        verse: verse.verse,
      },
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
    prepare(target, added).catch((error: unknown) => {
      if (active.current) {
        setProblem(
          error instanceof Error ? error.message : '성경 구절 불러오기 실패',
        );
      }
    });
  };
  if (problem !== null) {
    return (
      <Dialog
        title="성경 구절"
        size="s"
        onCancel={onClose}
        primary={{label: '닫기', onSelect: onClose}}
      >
        <span role="alert">{problem}</span>
      </Dialog>
    );
  }
  if (review === null) {
    if (loading) {
      return (
        <Dialog
          title="절 나누기"
          size="s"
          onCancel={onClose}
          initialFocus="surface"
          primary={{label: '확정', disabled: true, onSelect: () => undefined}}
        >
          <span role="status">불러오는 중</span>
        </Dialog>
      );
    }
    return (
      <BiblePassageDialog
        api={api.bible}
        translation={translation}
        limit={SLIDES_LIMITS.slides - item.slides.slides.length}
        onChoose={choose}
        onClose={onClose}
      />
    );
  }
  const projection = refreshed ?? review.projection;
  const ref = review.references[review.index];
  const verse =
    ref === undefined
      ? undefined
      : projection.verses.find(
          verse =>
            verse.reference.translation === ref.translation &&
            cacheKey(verse.reference) === cacheKey(ref),
        );
  if (ref === undefined || verse === undefined) {
    return (
      <Dialog
        title="절 나누기"
        size="s"
        onCancel={onClose}
        primary={{label: '닫기', onSelect: onClose}}
      >
        <span role="alert">성경 구절 불러오기 실패</span>
      </Dialog>
    );
  }
  return (
    <SplitEditor
      key={`${review.index}:${ref.translation}:${ref.book}:${ref.chapter}:${ref.verse}`}
      verse={verse}
      label={`${BIBLE_BOOKS.find(book => book.id === ref.book)?.korean ?? '성경'} ${ref.chapter}:${ref.verse}`}
      cuts={cutsOfVerse(projection.parts, ref)}
      layout={projection.layout}
      element={projection.element}
      appearance={projection.appearance}
      prefix={projection.numbered ? `${ref.verse} ` : ''}
      position={review.index}
      total={review.references.length}
      onCancel={onClose}
      onConfirm={async cuts => {
        await confirmBibleCuts(api.settings, verse, cuts);
        if (!active.current) return;
        if (review.index + 1 < review.references.length) {
          setReview({...review, index: review.index + 1});
        } else {
          if (review.added.length > 0) onInsert(review.added);
          onClose();
        }
      }}
    />
  );
}
