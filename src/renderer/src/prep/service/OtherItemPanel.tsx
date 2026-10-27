import {useMemo, type JSX} from 'react';
import {thumbnailUrl} from '@shared/media';
import {isItemOfKind, type ServiceItem} from '@shared/schema/service';
import type {MediaItem} from '@shared/schema/mediaList';
import {mediaName} from '@renderer/show/backgroundChoices';
import {
  defaultThumbnailColumns,
  type SizeClass,
} from '@renderer/shell/sizeClass';
import {MediaTile} from '@renderer/ui/MediaTile';
import {VirtualMediaGrid} from '@renderer/prep/media/VirtualMediaGrid';
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
  const byId = useMemo(
    () => new Map(media.map(item => [item.id, item])),
    [media],
  );
  const tiles = useMemo(
    () =>
      set?.media
        .map(id => byId.get(id))
        .filter((tile): tile is MediaItem => tile !== undefined) ?? [],
    [set, byId],
  );
  if (set === undefined) return <Empty />;
  return (
    <Panel label={ITEM_PANEL_LABEL} className={styles.panel}>
      <PanelHeader>
        <PanelTitle title={set.name} meta={`슬라이드 ${tiles.length}개`} />
      </PanelHeader>
      <PanelBody variant="flush" className={styles.body}>
        <VirtualMediaGrid
          key={setId}
          arrowsMove="focus"
          label={set.name}
          count={tiles.length}
          selected={undefined}
          columns={defaultThumbnailColumns[sizeClass]}
          onSelect={NOTHING}
          onActivate={NOTHING}
          onOutput={NOTHING}
          onMenu={NOTHING}
          tile={index => {
            const tile = tiles[index];
            return tile === undefined ? null : (
              <MediaTile
                key={tile.id}
                name={mediaName(tile)}
                picture={
                  tile.kind === 'audio' ? undefined : thumbnailUrl(tile.id)
                }
              />
            );
          }}
        />
      </PanelBody>
    </Panel>
  );
}

/**
 * The center panel of 준비 for an item that is not a song: the 공지 images, a
 * header for a media file, or an empty panel.
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
