import type {ItemKind, ItemRow, SlideTile} from '@core/presentation/model';
import {themeOfSlide} from '@core/theme/themes';
import {useThemes} from '@renderer/platform/themes';

/** Icons shared by the order table and its insertable item palette. */
export const iconByKind: Readonly<Record<ItemKind, string>> = {
  song: 'song',
  bible: 'book',
  sermon: 'mic',
  liturgy: 'monitor',
  notice: 'monitor',
  blank: 'monitor',
  media: 'film',
  unknown: 'filex',
};

/** The icon of a row; an item of pictures alone has the one of a picture. */
export function serviceRowIcon(
  row: ItemRow,
  tiles: readonly SlideTile[] | undefined,
): string {
  if (row.kind !== 'blank' && row.kind !== 'notice') {
    return iconByKind[row.kind];
  }
  const {themes} = useThemes.getState();
  const content = (tiles ?? []).map(
    tile => themeOfSlide(themes, tile.slide).purpose,
  );
  const pictures = content.filter(purpose => purpose !== 'title');
  return pictures.length > 0 && pictures.every(purpose => purpose === 'picture')
    ? 'image'
    : iconByKind[row.kind];
}
