import {useState, type JSX} from 'react';
import {sameJson} from '@core/common/sameJson';
import type {SlideBackground} from '@core/schema/theme';
import {withBackground} from '@core/slides/edits';
import {PropertyFold} from '@renderer/ui/PropertyFold';
import {PropertyGroup, PropertyRow} from '@renderer/ui/PropertyRow';
import {OwnTextButton} from '../OwnTextButton';
import {ApplyToAll} from './ApplyToAll';
import {BackgroundPlace, isPlaced, unplaced} from './BackgroundPlace';
import {changeSelected, type ChosenSlides} from './changeSelected';
import {useFold} from './folding';
import {SlideBackgroundControl} from './SlideBackgroundControl';

type Picture = Extract<SlideBackground, {readonly kind: 'media'}>;

/** Where the background picture is, locked to the whole screen at first. */
function PlaceFold({
  deck,
  chosen,
  picture,
}: ChosenSlides & {readonly picture: Picture}): JSX.Element {
  const fold = useFold('place');
  const ids = chosen.map(slide => slide.id).join(',');
  const [open, setOpen] = useState<string | null>(null);
  const placed = isPlaced(picture);
  const on = placed || open === ids;
  const set = (value: Picture): void =>
    changeSelected(deck, slide => withBackground(slide, value));
  return (
    <PropertyFold
      title="위치"
      mark={placed}
      action={
        <OwnTextButton
          own={{
            on,
            disabled: deck.readOnly,
            set: next => {
              setOpen(next ? ids : null);
              if (next) fold.onOpenChange(true);
              else if (placed) set(unplaced(picture));
            },
          }}
        />
      }
      {...fold}
    >
      <BackgroundPlace
        value={picture}
        disabled={deck.readOnly || !on}
        onChange={set}
      />
    </PropertyFold>
  );
}

/** The background of the selected slides. */
export function BackgroundSection({deck, chosen}: ChosenSlides): JSX.Element {
  const value = chosen[0]?.background;
  const mixed = chosen.some(slide => !sameJson(slide.background, value));
  return (
    <PropertyGroup title="배경">
      <PropertyRow label="그림">
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
      {!mixed && value?.kind === 'media' ? (
        <PlaceFold deck={deck} chosen={chosen} picture={value} />
      ) : null}
      <ApplyToAll
        deck={deck}
        mixed={mixed}
        change={slide => withBackground(slide, value)}
      />
    </PropertyGroup>
  );
}
