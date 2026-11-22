import {useState, type JSX} from 'react';
import {sameJson} from '@core/common/sameJson';
import type {SlideBackground} from '@core/schema/theme';
import {withBackground} from '@core/slides';
import {PropertyGroup, PropertyRow} from '@renderer/ui/PropertyRow';
import {OwnTextButton} from '../OwnTextButton';
import {BackgroundPlace, isPlaced, unplaced} from './BackgroundPlace';
import {changeSelected, type ChosenSlides} from './changeSelected';
import {SlideBackgroundControl} from './SlideBackgroundControl';
import {ThemeRow} from './ThemeRow';

type Picture = Extract<SlideBackground, {readonly kind: 'media'}>;

/** Where the background picture is, locked to the whole screen at first. */
function PlaceGroup({
  deck,
  chosen,
  picture,
}: ChosenSlides & {readonly picture: Picture}): JSX.Element {
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
      <BackgroundPlace
        value={picture}
        disabled={deck.readOnly || !on}
        onChange={set}
      />
    </PropertyGroup>
  );
}

/** The background that the chosen slides share, or the first one's. */
export function chosenBackground(chosen: ChosenSlides['chosen']): {
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
  return (
    <>
      <PropertyGroup>
        <ThemeRow deck={deck} chosen={chosen} />
        <PropertyRow label="배경">
          {({controlId}) => (
            <SlideBackgroundControl
              id={controlId}
              value={value}
              mixed={mixed}
              disabled={deck.readOnly}
              onChange={background =>
                changeSelected(deck, slide => withBackground(slide, background))
              }
            />
          )}
        </PropertyRow>
      </PropertyGroup>
      {!mixed && value?.kind === 'media' ? (
        <PlaceGroup deck={deck} chosen={chosen} picture={value} />
      ) : null}
    </>
  );
}
