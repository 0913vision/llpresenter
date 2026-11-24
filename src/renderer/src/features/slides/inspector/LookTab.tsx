import {useState, type JSX, type ReactNode} from 'react';
import {sameJson} from '@core/common/sameJson';
import {isPlaced} from '@core/schema/media/picturePlace';
import type {SlideBackground} from '@core/schema/screens/theme';
import {withBackground} from '@core/slides';
import {PicturePlaceRows} from '@renderer/ui/choices/PicturePlace';
import {PropertyControl, PropertyGroup} from '@renderer/ui/panels/PropertyRow';
import {OwnTextButton} from '../texts/OwnTextButton';
import {ApplyToAll} from './ApplyToAll';
import {changeSelected, type ChosenSlides} from './changeSelected';
import {SlideBackgroundControl} from './SlideBackgroundControl';
import {ThemeRow} from './ThemeRow';

type Picture = Extract<SlideBackground, {readonly kind: 'media'}>;

function unplaced(picture: Picture): Picture {
  const {fit: _fit, area: _area, ...kept} = picture;
  return kept;
}

/** Where the background picture is, locked to the whole screen at first. */
function PlaceGroup({
  deck,
  chosen,
  picture,
  children,
}: ChosenSlides & {
  readonly picture: Picture;
  readonly children: ReactNode;
}): JSX.Element {
  const ids = chosen.map(slide => slide.id).join(',');
  const [open, setOpen] = useState<string | null>(null);
  const placed = isPlaced(picture);
  const on = placed || open === ids;
  const set = (value: Picture): void =>
    changeSelected(deck, slide => withBackground(slide, value));
  return (
    <PropertyGroup
      title="배경 위치"
      action={
        <OwnTextButton
          own={{
            on,
            disabled: deck.readOnly,
            set: next => {
              setOpen(next ? ids : null);
              if (!next && placed) set(unplaced(picture));
            },
          }}
        />
      }
    >
      <PicturePlaceRows
        value={picture}
        disabled={deck.readOnly || !on}
        onChange={place => set({...unplaced(picture), ...place})}
      />
      {children}
    </PropertyGroup>
  );
}

/** The background that the chosen slides share, or the first one's. */
function chosenBackground(chosen: ChosenSlides['chosen']): {
  readonly value: SlideBackground | undefined;
  readonly mixed: boolean;
} {
  const value = chosen[0]?.background;
  return {
    value,
    mixed: chosen.some(slide => !sameJson(slide.background, value)),
  };
}

/** The theme and the background of the selected slides. */
export function LookTab({deck, chosen}: ChosenSlides): JSX.Element {
  const {value, mixed} = chosenBackground(chosen);
  const placed = !mixed && value?.kind === 'media' ? value : null;
  const applyToAll = (
    <ApplyToAll
      deck={deck}
      change={mixed ? null : slide => withBackground(slide, value)}
    >
      배경을 전체 슬라이드에 적용
    </ApplyToAll>
  );
  return (
    <>
      <PropertyGroup title="테마">
        <ThemeRow deck={deck} chosen={chosen} />
      </PropertyGroup>
      <PropertyGroup title="배경">
        <PropertyControl>
          <SlideBackgroundControl
            value={value}
            mixed={mixed}
            disabled={deck.readOnly}
            onChange={background =>
              changeSelected(deck, slide => withBackground(slide, background))
            }
          />
        </PropertyControl>
        {placed === null ? applyToAll : null}
      </PropertyGroup>
      {placed === null ? null : (
        <PlaceGroup deck={deck} chosen={chosen} picture={placed}>
          {applyToAll}
        </PlaceGroup>
      )}
    </>
  );
}
