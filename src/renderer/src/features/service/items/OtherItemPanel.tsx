import type {JSX, ReactNode} from 'react';
import {isItemOfKind, type ServiceItem} from '@core/schema/service';
import {mediaName} from '@renderer/features/media/backgroundChoices';
import {Panel, PanelBody, PanelHeader, PanelTitle} from '@renderer/ui/Panel';
import type {SizeClass} from '@renderer/ui/sizeClass';
import styles from './OtherItemPanel.module.css';
import {useOtherSources} from './useOtherSources';

export const ITEM_PANEL_LABEL = '예배 순서 항목';

function Empty(): JSX.Element {
  return (
    <Panel label={ITEM_PANEL_LABEL} className={styles.panel}>
      <PanelHeader>{null}</PanelHeader>
    </Panel>
  );
}

/**
 * The center panel of 준비 for a media file, or an empty panel.
 */
export function OtherItemPanel({
  item,
  children,
}: {
  readonly item: ServiceItem | null;
  readonly sizeClass: SizeClass;
  readonly children?: ReactNode;
}): JSX.Element {
  if (item !== null && isItemOfKind(item, 'media')) {
    return <MediaItemPanel mediaId={item.media}>{children}</MediaItemPanel>;
  }
  return <Empty />;
}

function MediaItemPanel({
  mediaId,
  children,
}: {
  readonly mediaId: string;
  readonly children?: ReactNode;
}): JSX.Element {
  const {media} = useOtherSources(true);
  const found = media.find(candidate => candidate.id === mediaId);
  // TODO(0913vision): Show the media properties of the media (spec 05, 예배
  // 순서 panel in 준비).
  return (
    <Panel label={ITEM_PANEL_LABEL} className={styles.panel}>
      <PanelHeader>
        <PanelTitle title={found === undefined ? '' : mediaName(found)} />
      </PanelHeader>
      <PanelBody variant="flush" className={styles.body}>
        {children}
      </PanelBody>
    </Panel>
  );
}
