import {Fragment, type JSX, type KeyboardEvent, type ReactNode} from 'react';
import type {ShowTile} from '@core/schema/showService';
import {boxesOf, fillsItself} from '@core/slides/boxes';
import {themeOfSlide} from '@core/theme/themes';
import {useThemes} from '@renderer/platform/themes';
import {outputSlideOf} from '@renderer/session/show';
import {isComposing} from '@renderer/ui/ime';
import {Properties, PropertyGroup} from '@renderer/ui/PropertyRow';
import {focusedSlide, selectedSlides, useDeckSelection} from '../deckSelection';
import {SlidePreview, usePreviewScreen} from '../SlidePreview';
import {SlideSidePanel} from '../SlideSidePanel';
import type {SlideDeck} from '../slideDeck';
import {SlideTextField} from '../SlideTextField';
import {BackgroundSection} from './BackgroundSection';
import {FilledTexts} from './FilledTexts';
import {LabelRow} from './LabelRow';
import styles from './SlideInspector.module.css';
import {ThemeRow} from './ThemeRow';
import {TransitionSection} from './TransitionSection';

/** Undoes and redoes from the fields, as everywhere in the editor. */
function replayFromFields(deck: SlideDeck, event: KeyboardEvent): void {
  if (
    deck.readOnly ||
    isComposing(event) ||
    event.altKey ||
    !(event.ctrlKey || event.metaKey)
  ) {
    return;
  }
  const key = event.key.toLowerCase();
  if (key !== 'z' && key !== 'y') return;
  event.preventDefault();
  event.stopPropagation();
  deck.replay(key === 'y' || event.shiftKey ? 'redo' : 'undo');
}

/** Everything of the selected slides: what it looks like, texts and settings. */
export function SlideInspector({
  deck,
  tiles,
  children,
}: {
  readonly deck: SlideDeck;
  readonly tiles: readonly ShowTile[];
  /** Rows of the item itself, above the ones of its slides. */
  readonly children?: ReactNode;
}): JSX.Element {
  const screen = usePreviewScreen();
  const selection = useDeckSelection(deck);
  const chosen = selectedSlides(deck, selection);
  const slide = focusedSlide(deck, selection);
  const index = tiles.findIndex(tile => tile.slide.id === slide?.id);
  const tile = chosen.length === 0 ? undefined : tiles[index];
  const themes = useThemes(view => view.themes);
  const theme = slide === undefined ? undefined : themeOfSlide(themes, slide);
  const nextAtEnd =
    deck.item === undefined
      ? null
      : (outputSlideOf({itemId: deck.id, index})?.next ?? null);
  const only = chosen.length === 1 ? tile : undefined;
  return (
    <SlideSidePanel label="슬라이드 속성" screen={screen}>
      <div
        className={styles.body}
        onKeyDown={event => replayFromFields(deck, event)}
      >
        {children}
        {tile === undefined ? null : (
          <Fragment key={tile.slide.id}>
            <SlidePreview
              tiles={tiles}
              index={index}
              screen={screen}
              nextAtEnd={nextAtEnd}
            />
            {only === undefined || theme === undefined ? null : (
              <div className={styles.text}>
                {boxesOf(theme)
                  .filter(box => !fillsItself(theme, box))
                  .map(box => (
                    <SlideTextField
                      key={box}
                      deck={deck}
                      tile={only}
                      theme={theme}
                      box={box}
                    />
                  ))}
                <FilledTexts deck={deck} tile={only} theme={theme} />
              </div>
            )}
            <Properties>
              <PropertyGroup>
                <ThemeRow deck={deck} chosen={chosen} />
                <LabelRow deck={deck} chosen={chosen} />
              </PropertyGroup>
              <BackgroundSection deck={deck} chosen={chosen} />
              <TransitionSection deck={deck} chosen={chosen} />
            </Properties>
          </Fragment>
        )}
      </div>
    </SlideSidePanel>
  );
}
