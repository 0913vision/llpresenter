import type {JSX, ReactNode} from 'react';
import {PanelFooter} from '@renderer/ui/Panel';
import type {ItemEditorAdapter} from './itemEditorAdapter';

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
  readonly adapter: ItemEditorAdapter;
  readonly count: number;
  readonly end?: ReactNode;
  readonly slide?: ReactNode;
  readonly picture?: ReactNode;
  readonly verse?: ReactNode;
  readonly title?: ReactNode;
}): JSX.Element {
  return (
    <PanelFooter count={count} end={end}>
      {adapter.addSlide ? slide : null}
      {adapter.addPicture ? picture : null}
      {adapter.addVerse ? verse : null}
      {adapter.addTitle ? title : null}
    </PanelFooter>
  );
}
