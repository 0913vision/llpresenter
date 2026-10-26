import type {JSX} from 'react';
import {isItemOfKind, type ServiceItem} from '@shared/schema/service';
import type {MediaItem} from '@shared/schema/mediaList';
import {MediaPreview} from '@renderer/show/MediaPreview';
import {mediaName} from '@renderer/show/backgroundChoices';
import {
  defaultThumbnailColumns,
  type SizeClass,
} from '@renderer/shell/sizeClass';
import {MediaGrid, MediaTile} from '@renderer/ui/MediaTile';
import {Panel, PanelBody, PanelHeader, PanelTitle} from '@renderer/ui/Panel';
import styles from './OtherItemPanel.module.css';
import {useOtherSources} from './useOtherSources';

export const ITEM_PANEL_LABEL = '예배 순서 항목';

const NOTHING = (): void => undefined;

function Empty(): JSX.Element {
  return (
    <Panel label={ITEM_PANEL_LABEL} className={styles.panel}>
      <PanelHeader>{null}</PanelHeader>
    </Panel>
  );
}

function NoticePanel({
  setId,
  sizeClass,
}: {
  readonly setId: string;
  readonly sizeClass: SizeClass;
}): JSX.Element {
  const {media, notices} = useOtherSources(true);
  const set = notices.find(candidate => candidate.id === setId);
  if (set === undefined) return <Empty />;
  const tiles = set.media
    .map(id => media.find(candidate => candidate.id === id))
    .filter((tile): tile is MediaItem => tile !== undefined);
  return (
    <Panel label={ITEM_PANEL_LABEL} className={styles.panel}>
      <PanelHeader>
        <PanelTitle title={set.name} meta={`슬라이드 ${tiles.length}개`} />
      </PanelHeader>
      <PanelBody variant="flush">
        <MediaGrid
          label={set.name}
          selected={undefined}
          columns={defaultThumbnailColumns[sizeClass]}
          onSelect={NOTHING}
          onActivate={NOTHING}
          onOutput={NOTHING}
        >
          {tiles.map(tile => (
            <MediaTile
              key={tile.id}
              name={mediaName(tile)}
              picture={<MediaPreview item={tile} onError={NOTHING} />}
            />
          ))}
        </MediaGrid>
      </PanelBody>
    </Panel>
  );
}

/**
 * The center panel of 준비 for an item that is not a song: the 공지 images, a
 * header for a Bible passage or a media file, or an empty panel.
 */
export function OtherItemPanel({
  item,
  sizeClass,
}: {
  readonly item: ServiceItem | null;
  readonly sizeClass: SizeClass;
}): JSX.Element {
  if (item !== null && isItemOfKind(item, 'notice')) {
    return <NoticePanel setId={item.notice} sizeClass={sizeClass} />;
  }
  if (item !== null && isItemOfKind(item, 'bible')) {
    // TODO(0913vision): Show the Bible panel of 진행 without the output buttons
    // (spec 05, 예배 순서 panel in 준비).
    return (
      <Panel label={ITEM_PANEL_LABEL} className={styles.panel}>
        <PanelHeader>
          <PanelTitle title={item.bible.ref} />
        </PanelHeader>
      </Panel>
    );
  }
  if (item !== null && isItemOfKind(item, 'media')) {
    return <MediaItemPanel mediaId={item.media} />;
  }
  return <Empty />;
}

function MediaItemPanel({mediaId}: {readonly mediaId: string}): JSX.Element {
  const {media} = useOtherSources(true);
  const found = media.find(candidate => candidate.id === mediaId);
  // TODO(0913vision): Show the media properties of the media (spec 05, 예배
  // 순서 panel in 준비).
  return (
    <Panel label={ITEM_PANEL_LABEL} className={styles.panel}>
      <PanelHeader>
        <PanelTitle title={found === undefined ? '' : mediaName(found)} />
      </PanelHeader>
    </Panel>
  );
}
