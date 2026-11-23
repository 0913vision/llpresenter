import type {JSX, KeyboardEvent} from 'react';
import type {ShowTile} from '@core/schema/showService';
import {hidesNext} from '@core/slides';
import {themeOfSlide} from '@core/theme';
import {themeOfTile, useThemes} from '@renderer/platform/themes';
import {isHiddenBeforeItem, outputSlideOf} from '@renderer/session/show';
import {isComposing} from '@renderer/ui/ime';
import {PanelTabs} from '@renderer/ui/Panel';
import {Properties} from '@renderer/ui/PropertyRow';
import {focusedSlide, selectedSlides, useDeckSelection} from '../deckSelection';
import {SlidePreview, usePreviewScreen} from '../SlidePreview';
import {SlideSidePanel} from '../SlideSidePanel';
import type {SlideDeck} from '../slideDeck';
import {
  INSPECTOR_TABS,
  showInspectorTab,
  useInspectorTab,
} from './inspectorTab';
import {LookTab} from './LookTab';
import styles from './SlideInspector.module.css';
import {TextsTab} from './TextsTab';
import {TransitionTab} from './TransitionTab';

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

/** Whether the slide before one shows nothing of it. */
function isHiddenBefore(
  deck: SlideDeck,
  tiles: readonly ShowTile[],
  index: number,
): boolean {
  const before = tiles[index - 1];
  if (before !== undefined) {
    return hidesNext(tiles, index - 1, themeOfTile(before));
  }
  return deck.item !== undefined && isHiddenBeforeItem(deck.id);
}

/** Everything of the selected slides: what it looks like, texts and settings. */
export function SlideInspector({
  deck,
  tiles,
}: {
  readonly deck: SlideDeck;
  readonly tiles: readonly ShowTile[];
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
  const tab = useInspectorTab();
  return (
    <SlideSidePanel label="슬라이드 속성" screen={screen}>
      {tile === undefined ? null : (
        <div
          className={styles.body}
          key={tile.slide.id}
          onKeyDown={event => replayFromFields(deck, event)}
        >
          <SlidePreview
            tiles={tiles}
            index={index}
            screen={screen}
            nextAtEnd={nextAtEnd}
          />
          <div className={styles.tabs}>
            <PanelTabs
              tabs={INSPECTOR_TABS}
              value={tab}
              onChange={showInspectorTab}
            />
          </div>
          <Properties>
            {tab === 'texts' ? (
              <TextsTab
                deck={deck}
                chosen={chosen}
                tiles={tiles}
                tile={only}
                theme={theme}
                hidden={isHiddenBefore(deck, tiles, index)}
              />
            ) : tab === 'look' ? (
              <LookTab deck={deck} chosen={chosen} />
            ) : (
              <TransitionTab deck={deck} chosen={chosen} />
            )}
          </Properties>
        </div>
      )}
    </SlideSidePanel>
  );
}
