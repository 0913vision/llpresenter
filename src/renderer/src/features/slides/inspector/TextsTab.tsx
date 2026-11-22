import type {JSX} from 'react';
import type {ShowTile} from '@core/schema/showService';
import type {ThemeFile} from '@core/schema/theme';
import {boxesOf, fillsItself} from '@core/slides/boxes';
import {PropertyGroup, PropertyRow} from '@renderer/ui/PropertyRow';
import {OwnTextButton} from '../OwnTextButton';
import {SlideTextArea, type SlideBox} from '../SlideTextArea';
import {SlideTextField} from '../SlideTextField';
import {useOwnText} from '../useOwnText';
import type {ChosenSlides} from './changeSelected';
import {LabelRow} from './LabelRow';
import styles from './SlideInspector.module.css';

/** A text that fills itself, locked until it is opened for editing. */
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

/** The texts of the slide: its own ones, its label, and what fills itself. */
export function TextsTab({
  deck,
  chosen,
  tile,
  theme,
}: ChosenSlides & {
  /** The slide whose texts can be changed, when only one is selected. */
  readonly tile: ShowTile | undefined;
  readonly theme: ThemeFile | undefined;
}): JSX.Element {
  const place =
    tile === undefined || theme === undefined ? null : {deck, tile, theme};
  const boxes = place === null ? [] : boxesOf(place.theme);
  const own = boxes.filter(
    box => place !== null && !fillsItself(place.theme, box),
  );
  const filled = boxes.filter(box => !own.includes(box));
  return (
    <>
      {place === null || own.length === 0 ? null : (
        <PropertyGroup>
          <div className={styles.texts}>
            {own.map(box => (
              <SlideTextField key={box} {...place} box={box} />
            ))}
          </div>
        </PropertyGroup>
      )}
      <PropertyGroup>
        <LabelRow deck={deck} chosen={chosen} />
      </PropertyGroup>
      {place === null || filled.length === 0 ? null : (
        <PropertyGroup title="자동 글">
          {filled.map(box => (
            <FilledTextRow key={box} {...place} box={box} />
          ))}
        </PropertyGroup>
      )}
    </>
  );
}
