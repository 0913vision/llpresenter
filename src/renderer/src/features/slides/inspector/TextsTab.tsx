import type {JSX} from 'react';
import type {ShowTile} from '@core/schema/showService';
import type {ThemeFile} from '@core/schema/theme';
import {boxesOf, fillsItself, NEXT_BOX, showsHymn} from '@core/slides';
import {PropertyGroup} from '@renderer/ui/PropertyRow';
import {SlideTextField} from '../SlideTextField';
import type {ChosenSlides} from './changeSelected';
import {HideNextRow} from './HideNextRow';
import {HymnGroup} from './HymnGroup';
import {LabelRow} from './LabelRow';
import styles from './SlideInspector.module.css';

const HIDDEN_NOTE =
  '앞 슬라이드에서 이 내용을 보여주지 않도록 설정되어 있습니다.';

/** The texts of the slide: its own ones, its label, and what fills itself. */
export function TextsTab({
  deck,
  chosen,
  tiles,
  tile,
  theme,
  hidden,
}: ChosenSlides & {
  readonly tiles: readonly ShowTile[];
  /** The slide whose texts can be changed, when only one is selected. */
  readonly tile: ShowTile | undefined;
  readonly theme: ThemeFile | undefined;
  /** The slide before shows nothing of this one. */
  readonly hidden: boolean;
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
      {place === null || !showsHymn(place.theme) ? null : (
        <HymnGroup deck={deck} chosen={chosen} />
      )}
      {place === null || own.length === 0 ? null : (
        <PropertyGroup title="텍스트">
          <div className={styles.texts}>
            {own.map(box => (
              <SlideTextField key={box} {...place} box={box} />
            ))}
          </div>
        </PropertyGroup>
      )}
      <PropertyGroup title="이름표">
        <LabelRow deck={deck} chosen={chosen} />
      </PropertyGroup>
      <PropertyGroup title="무대 화면">
        <HideNextRow deck={deck} chosen={chosen} tiles={tiles} />
      </PropertyGroup>
      {place === null ? null : (
        <PropertyGroup title="부가 정보">
          <div className={styles.texts}>
            {filled.map(box => (
              <SlideTextField
                key={box}
                {...place}
                box={box}
                note={hidden && box === NEXT_BOX ? HIDDEN_NOTE : undefined}
              />
            ))}
          </div>
        </PropertyGroup>
      )}
    </>
  );
}
