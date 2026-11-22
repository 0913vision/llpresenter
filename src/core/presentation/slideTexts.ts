import type {ShowTile} from '../schema/showService';
import type {ItemTexts} from '../schema/slideTexts';

/** Gives each slide what the theme's own text boxes show on it. */
export function withSlideTexts(
  tiles: readonly ShowTile[],
  texts: ItemTexts | undefined,
): readonly ShowTile[] {
  if (texts === undefined) return tiles;
  return tiles.map(tile => {
    const own = tile.key === undefined ? undefined : texts[tile.key];
    return own === undefined ? tile : {...tile, texts: own};
  });
}

/** Keeps the text of one box on one slide; null goes back to the theme's. */
export function setSlideText(
  texts: ItemTexts | undefined,
  {
    slide,
    box,
    text,
  }: {
    readonly slide: string;
    readonly box: string;
    readonly text: string | null;
  },
): ItemTexts | undefined {
  const {[slide]: previous = {}, ...others} = texts ?? {};
  const {[box]: _old, ...kept} = previous;
  const own = text === null ? kept : {...kept, [box]: text};
  const next =
    Object.keys(own).length === 0 ? others : {...others, [slide]: own};
  return Object.keys(next).length === 0 ? undefined : next;
}
