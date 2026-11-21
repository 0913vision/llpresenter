import type {JSX, ReactNode} from 'react';
import {GridFooter} from '@renderer/ui/GridFooter';
import type {ItemEditorCapabilities} from './itemEditorAdapter';

/** One command order and one footer for every item editor. */
export function ItemEditorAddBar({
  adapter,
  count,
  end,
  slide,
  picture,
  verse,
  title,
}: {
  readonly adapter: ItemEditorCapabilities;
  readonly count: number;
  readonly end?: ReactNode;
  readonly slide?: ReactNode;
  readonly picture?: ReactNode;
  readonly verse?: ReactNode;
  readonly title?: ReactNode;
}): JSX.Element {
  return (
    <GridFooter count={count} zoom={end}>
      {adapter.addSlide ? slide : null}
      {adapter.addPicture ? picture : null}
      {adapter.addVerse ? verse : null}
      {adapter.addTitle ? title : null}
    </GridFooter>
  );
}
