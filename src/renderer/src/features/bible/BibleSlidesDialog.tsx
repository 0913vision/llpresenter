import {useEffect, useRef, useState, type JSX} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {BibleLookupPassage} from '@core/schema/bibleLookup';
import {createSlideId} from '@core/schema/ids';
import {SLIDES_LIMITS} from '@core/schema/service';
import type {Slide, SlidesItem} from '@core/services/slidesEdits';
import {passageTiles} from '@core/bible/bibleTiles';
import {slidesOfParts} from '@core/bible/split/splitPassage';
import {versesToReview, type VerseInput} from '@core/bible/split/splitVerses';
import {cutVerse} from '@core/services/passageEdits';
import type {SlideTransition} from '@core/schema/slideTransition';
import type {BibleSlides} from '@core/schema/biblePassage';
import {Dialog} from '@renderer/ui/Dialog';
import {useBibleTranslation} from './useBibleTranslation';
import {BiblePassageDialog} from './BiblePassageDialog';
import {BibleAddSplitReview} from './BibleAddSplitReview';
import {passageSplitter, type BibleSplit} from './passageSplitter';

interface Review {
  readonly split: BibleSplit;
  readonly references: ReadonlyArray<VerseInput['reference']>;
  readonly finish: (slides: BibleSlides) => void;
  readonly transition: SlideTransition;
}

/** Adds a passage to a blank item as its own text slides, each with a reference. */
export function BibleSlidesDialog({
  api,
  item,
  onInsert,
  onClose,
}: {
  readonly api: LlpApi;
  readonly item: SlidesItem;
  readonly onInsert: (slides: readonly Slide[]) => void;
  readonly onClose: () => void;
}): JSX.Element {
  const translation = useBibleTranslation(api);
  const [review, setReview] = useState<Review | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const active = useRef(true);
  const slides = useRef<BibleSlides>({});
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const choose = async (passage: BibleLookupPassage): Promise<void> => {
    const preferences = await api.preferences.get();
    if (!active.current) return;
    const {verseNumbers, reference, translationName} =
      preferences.bible.defaults;
    const transition = preferences.show.slideDefaults.bible;
    const split = passageSplitter()?.split(passage, {
      verseNumbers,
      theme: item.theme,
    });
    if (split == null) throw Error('절 나누기를 측정할 수 없음');
    const finish = (cut: BibleSlides): void => {
      if (!active.current) return;
      active.current = false;
      onInsert(
        passageTiles(passage, {
          slides: cut,
          verseNumbers,
          reference,
          translationName,
        }).map(tile => ({
          id: createSlideId(crypto.randomUUID()),
          text: tile.lines.join('\n'),
          ...(tile.reference === undefined ? {} : {reference: tile.reference}),
          transition,
        })),
      );
      onClose();
    };
    const cut = slidesOfParts(split.parts, {transition});
    const references = versesToReview(split.parts);
    if (!preferences.bible.splitEditorAutoOpen || references.length === 0) {
      finish(cut);
      return;
    }
    slides.current = cut;
    setReview({split, references, finish, transition});
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
    return (
      <BiblePassageDialog
        api={api.bible}
        translation={translation}
        limit={SLIDES_LIMITS.slides - item.slides.slides.length}
        onChoose={passage => {
          choose(passage).catch((error: unknown) => {
            if (active.current) {
              setProblem(
                error instanceof Error
                  ? error.message
                  : '성경 구절 불러오기 실패',
              );
            }
          });
        }}
        onClose={onClose}
      />
    );
  }
  return (
    <BibleAddSplitReview
      api={api}
      projection={review.split}
      references={review.references}
      onCancel={onClose}
      onConfirmed={(verse, texts) => {
        slides.current = cutVerse(slides.current, verse.reference, {
          texts,
          transition: review.transition,
        });
      }}
      onComplete={() => review.finish(slides.current)}
    />
  );
}
