import {useId, useState, type JSX} from 'react';
import {create} from 'zustand';
import type {ShowTile} from '@core/schema/showService';
import type {Slide} from '@core/schema/slide';
import type {ThemeFile} from '@core/schema/theme';
import {sameJson} from '@core/common/sameJson';
import {boxesOf, fillsItself, ownText} from '@core/slides/boxes';
import {withBackground} from '@core/slides/edits';
import {PropertyDisclosure} from '@renderer/ui/PropertyDisclosure';
import {PropertyRow} from '@renderer/ui/PropertyRow';
import {OwnTextButton} from '../OwnTextButton';
import {SlideTextArea, type SlideBox} from '../SlideTextArea';
import {useOwnText} from '../useOwnText';
import {BackgroundPlace, isPlaced, unplaced} from './BackgroundPlace';
import {changeSelected, type ChosenSlides} from './changeSelected';
import styles from './SlideInspector.module.css';

/** Open or folded for every slide alike, until the app closes. */
const useFolding = create<{readonly open: boolean}>(() => ({open: false}));

function FilledTextRow(place: SlideBox): JSX.Element {
  const own = useOwnText(place);
  return (
    <PropertyRow label={place.box} alignTop>
      {({controlId}) => (
        <span className={styles.withAction}>
          <SlideTextArea {...place} id={controlId} locked={!own.on} />
          <OwnTextButton own={own} />
        </span>
      )}
    </PropertyRow>
  );
}

/** The place of the background picture the selected slides share. */
function pictureOf(chosen: readonly Slide[]) {
  const value = chosen[0]?.background;
  return value?.kind === 'media' &&
    chosen.every(slide => sameJson(slide.background, value))
    ? value
    : undefined;
}

function PlaceRows({deck, chosen}: ChosenSlides): JSX.Element | null {
  const ids = chosen.map(slide => slide.id).join(',');
  const labelId = useId();
  const [open, setOpen] = useState<string | null>(null);
  const value = pictureOf(chosen);
  if (value === undefined) return null;
  const on = isPlaced(value) || open === ids;
  const set = (background: typeof value): void =>
    changeSelected(deck, slide => withBackground(slide, background));
  return (
    <div role="group" aria-labelledby={labelId}>
      <div className={styles.placeHead}>
        <span id={labelId}>배경 위치</span>
        <OwnTextButton
          own={{
            on,
            disabled: deck.readOnly,
            set: next => {
              setOpen(next ? ids : null);
              if (!next && isPlaced(value)) set(unplaced(value));
            },
          }}
        />
      </div>
      {on ? (
        <BackgroundPlace
          value={value}
          disabled={deck.readOnly}
          onChange={set}
        />
      ) : null}
    </div>
  );
}

/** What fills itself and is seldom changed, folded away. */
export function DefaultsGroup({
  deck,
  chosen,
  tile,
  theme,
}: ChosenSlides & {
  /** The slide whose texts can be changed, when only one is selected. */
  readonly tile: ShowTile | undefined;
  readonly theme: ThemeFile | undefined;
}): JSX.Element | null {
  const open = useFolding(view => view.open);
  const boxes =
    tile === undefined || theme === undefined
      ? []
      : boxesOf(theme).filter(box => fillsItself(theme, box));
  const picture = pictureOf(chosen);
  if (boxes.length === 0 && picture === undefined) return null;
  const changed =
    (picture !== undefined && isPlaced(picture)) ||
    (tile !== undefined && boxes.some(box => ownText(tile.slide, box) !== ''));
  return (
    <PropertyDisclosure
      title="기본값"
      mark={changed}
      open={open}
      onOpenChange={next => useFolding.setState({open: next})}
    >
      {tile === undefined || theme === undefined
        ? null
        : boxes.map(box => (
            <FilledTextRow
              key={box}
              deck={deck}
              tile={tile}
              theme={theme}
              box={box}
            />
          ))}
      <PlaceRows deck={deck} chosen={chosen} />
    </PropertyDisclosure>
  );
}
