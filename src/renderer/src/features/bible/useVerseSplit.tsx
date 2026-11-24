import {useState, type JSX} from 'react';
import {BIBLE_BOOKS} from '@core/bible';
import {
  isCutOfVerse,
  slidesOfVerse,
  replaceVerse,
  sameVerse,
  verseSlides,
  versesOfPassage,
} from '@core/slides';
import type {BiblePassage} from '@core/schema/biblePassage';
import type {SlideId} from '@core/schema/ids';
import type {VerseReference} from '@core/schema/slide';
import {
  selectAdded,
  focusedSlide,
  useDeckSelection,
} from '../slides/deckSelection';
import type {SlideDeck} from '../slides/slideDeck';
import type {Report} from '@renderer/session/serviceEdit';
import {slideMaking} from '@renderer/platform/themes';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {warningNotice} from '@renderer/ui/notices';
import {confirmBibleCuts} from './saveBibleCuts';
import {passageSplitter, type BibleSplit} from './passageSplitter';
import {usePassageText} from './passageText';
import {SplitReview} from './SplitReview';

const NO_DECK = {id: '', slides: []};

interface Cut {
  readonly split: BibleSplit;
  readonly reference: VerseReference;
}

/** The passage a verse is of: the item's own, or the verse by itself. */
function passageOf(
  deck: SlideDeck,
  verse: VerseReference | undefined,
): Pick<BiblePassage, 'translation' | 'ref'> | undefined {
  const {item} = deck;
  if (item !== undefined && 'passage' in item) return item.passage;
  const book = BIBLE_BOOKS.find(entry => entry.id === verse?.book);
  return verse === undefined || book === undefined
    ? undefined
    : {
        translation: verse.translation,
        ref: `${book.korean} ${verse.chapter}:${verse.verse}`,
      };
}

/** Cuts the verse of the selected slide between its words. */
export function useVerseSplit(
  deck: SlideDeck | null,
  report: Report,
  /** The slide whose verse is meant; the selected one when absent. */
  slideId?: SlideId,
): {
  readonly reason: string | undefined;
  readonly open: () => void;
  readonly dialog: JSX.Element | null;
} {
  const selection = useDeckSelection(deck ?? NO_DECK);
  const slide =
    deck === null
      ? undefined
      : slideId === undefined
        ? focusedSlide(deck, selection)
        : deck.slides.find(entry => entry.id === slideId);
  const verse = slide?.verse;
  const text = usePassageText(
    deck === null ? undefined : passageOf(deck, verse),
  );
  const [cut, setCut] = useState<Cut | null>(null);
  const original =
    verse === undefined || text === null
      ? undefined
      : versesOfPassage(text).find(entry => sameVerse(entry.reference, verse));
  const reason =
    deck === null || verse === undefined
      ? '말씀 슬라이드를 고르세요.'
      : deck.readOnly
        ? '지금은 편집할 수 없습니다.'
        : text === null
          ? '본문을 불러오는 중입니다.'
          : original === undefined
            ? '이 절의 본문을 찾을 수 없습니다.'
            : isCutOfVerse(deck.slides, original)
              ? undefined
              : '직접 고친 절은 여기서 나눌 수 없습니다.';
  const open = (): void => {
    if (
      deck === null ||
      reason !== undefined ||
      text === null ||
      verse === undefined
    ) {
      return;
    }
    const numbered =
      deck.item !== undefined && 'passage' in deck.item
        ? deck.item.passage.verseNumbers
        : (slide?.texts['본문'] ?? '').startsWith(`${verse.verse} `);
    const split = passageSplitter()?.split(text, {
      verseNumbers: numbered,
      slides: deck.slides,
      theme: slide?.theme,
    });
    if (split == null) {
      report(warningNotice('bible-split', '성경 구절 나누기 실패'));
      return;
    }
    setCut({split, reference: verse});
  };
  useWindowShortcuts([
    {
      id: 'bible.splitEdit',
      when: () => cut === null && verse !== undefined,
      unavailable: () => reason,
      run: open,
    },
  ]);
  const apply = ({split, reference}: Cut, texts: readonly string[]): void => {
    if (deck === null) return;
    const before = slidesOfVerse(deck.slides, reference);
    const own = split.numbered ? `${reference.verse} ` : '';
    const made = verseSlides(slideMaking(), {
      reference,
      texts: texts.map((part, index) => (index === 0 ? own + part : part)),
      address: before[0]?.texts['주소'],
      before,
    });
    deck.edit(slides => replaceVerse(slides, reference, made));
    selectAdded(
      deck.id,
      made.slice(0, 1).map(entry => entry.id),
    );
  };
  const dialog =
    cut === null ? null : (
      <SplitReview
        projection={cut.split}
        references={[cut.reference]}
        pending={new Set()}
        onCancel={() => setCut(null)}
        onConfirm={async (entry, {selection: chosen, texts}) => {
          const api = window.llp;
          if (api !== undefined) {
            await confirmBibleCuts(api.settings, entry, chosen).catch(
              (error: unknown) =>
                console.error('Could not remember the cut of a verse', error),
            );
          }
          apply(cut, texts);
        }}
        onComplete={() => setCut(null)}
      />
    );
  return {reason, open, dialog};
}
