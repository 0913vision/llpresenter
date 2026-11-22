import {displayReference} from '@core/bible/displayReference';
import type {JSX, ReactNode} from 'react';
import type {ServiceItemOf} from '@core/schema/service';
import type {SizeClass} from '@renderer/ui/sizeClass';
import {useShow} from '@renderer/session/show';
import {SlideSizeControl} from '@renderer/platform/SlideSizeControl';
import {Panel, PanelBody, PanelHeader, PanelTitle} from '@renderer/ui/Panel';
import {GridFooter} from '@renderer/ui/GridFooter';
import {ITEM_PANEL_LABEL} from './OtherItemPanel';
import styles from './OtherItemPanel.module.css';

/** The slides of a saved passage, beside the service order. */
export function BibleItemPanel({
  item,
  sizeClass,
  children,
}: {
  readonly item: ServiceItemOf<'bible'>;
  readonly sizeClass: SizeClass;
  readonly children: ReactNode;
}): JSX.Element {
  const count = useShow(view => view.tiles[item.id]?.length ?? 0);
  return (
    <Panel label={ITEM_PANEL_LABEL} className={styles.panel}>
      <PanelHeader>
        <PanelTitle title={displayReference(item.bible.ref)} />
      </PanelHeader>
      <PanelBody variant="flush">{children}</PanelBody>
      <GridFooter
        count={count}
        zoom={<SlideSizeControl sizeClass={sizeClass} workspace="prep" />}
      />
    </Panel>
  );
}
