import {render} from '@testing-library/react';
import {useMemo, useState, type JSX} from 'react';
import type {Slide} from '@core/schema/slides/slide';
import type {SlideSource} from '@core/slides/tiles';
import {BackgroundDrop} from '@renderer/features/slides/BackgroundDrop';
import {SlideEditor} from '@renderer/features/slides/SlideEditor';
import {SlideInspector} from '@renderer/features/slides/inspector/SlideInspector';
import {
  useDeckTiles,
  type SlideDeck,
} from '@renderer/features/slides/slideDeck';
import {seedSlideSurfaceView} from '@renderer/features/slides/rows/SlideSurfaceView';
import {useThemes} from '@renderer/platform/themes';
import type {Report} from '@renderer/session/serviceEdit';
import {themes, themeScreens} from '@fixtures/core/themeOutput';

const NO_COLORS = new Map();
let decks = 0;

/** The editor of a list of slides that keeps its edits and their undo. */
export function renderEditor(
  first: readonly Slide[],
  {
    readOnly = false,
    grid = false,
    source = {kind: 'song', title: '새 노래'},
    onBack = () => undefined,
    report = () => undefined,
  }: {
    readonly readOnly?: boolean;
    readonly grid?: boolean;
    readonly source?: SlideSource;
    readonly onBack?: () => void;
    readonly report?: Report;
  } = {},
) {
  useThemes.setState({themes: themes(), screens: themeScreens});
  seedSlideSurfaceView({
    layout: {normal: {editorSlideView: grid ? 'grid' : 'list'}},
  });
  decks += 1;
  const id = `deck-${decks}`;
  const current: {slides: readonly Slide[]} = {slides: first};
  function Harness(): JSX.Element {
    const [past, setPast] = useState<ReadonlyArray<readonly Slide[]>>([]);
    const [slides, setSlides] = useState(first);
    current.slides = slides;
    const deck = useMemo<SlideDeck>(
      () => ({
        id,
        item: undefined,
        source,
        slides,
        readOnly,
        canUndo: past.length > 0,
        canRedo: false,
        edit: change => {
          const next = change(slides);
          if (next === slides) return;
          setPast([...past, slides]);
          setSlides(next);
        },
        replay: () => {
          const before = past.at(-1);
          if (before === undefined) return;
          setPast(past.slice(0, -1));
          setSlides(before);
        },
      }),
      [slides, past],
    );
    const tiles = useDeckTiles(deck, NO_COLORS);
    return (
      <BackgroundDrop deck={deck} report={report}>
        <SlideEditor
          deck={deck}
          tiles={tiles}
          header={<h2>{source.title}</h2>}
          onBack={onBack}
        />
        <SlideInspector deck={deck} tiles={tiles} />
      </BackgroundDrop>
    );
  }
  return {...render(<Harness />), current};
}

/** The texts of the slides, for comparing. */
export function textsOf(slides: readonly Slide[]) {
  return slides.map(slide => Object.values(slide.texts).join(' / '));
}
