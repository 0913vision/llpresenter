import type {ItemKind} from '@core/presentation/model';

/** Icons shared by the order table and its insertable item palette. */
export const iconByKind: Readonly<Record<ItemKind, string>> = {
  song: 'song',
  bible: 'book',
  media: 'film',
  slides: 'monitor',
  unknown: 'filex',
};
