import {useState} from 'react';
import {ownText} from '@core/slides';
import {setOwnText} from './deckTexts';
import type {SlideBox} from './SlideTextArea';

/** Whether a box that fills itself has a text of its own, and the switch. */
export interface OwnText {
  readonly on: boolean;
  readonly disabled: boolean;
  readonly set: (on: boolean) => void;
}

/**
 * Whether a slide keeps its own text in a box instead of the text that flows in
 * from the slides around it, and the call that switches it.
 */
export function useOwnText({deck, tile, theme, box}: SlideBox): OwnText {
  // NOTE(0913vision): A text that is emptied stays open until it is locked.
  const [open, setOpen] = useState<string | null>(null);
  const {slide} = tile;
  return {
    on: ownText(slide, box) !== '' || open === slide.id,
    disabled: deck.readOnly,
    set: on => {
      setOpen(on ? slide.id : null);
      setOwnText(deck, {tile, theme, box}, on);
    },
  };
}
