import {useEffect, useState, type JSX} from 'react';
import {mediaUrl} from '@contracts/ipc/media';
import {
  MAX_OVERLAY_TIMER_MS,
  nextNoticeChange,
  noticePosition,
} from '@core/overlays/noticeClock';
import type {NoticePlayback as Playback} from '@core/live/state';
import type {MediaItem} from '@core/schema/mediaList';
import type {NoticeSet} from '@core/schema/notices';
import {sendLive, useLive} from '@renderer/state/live';
import {Button, MediaTile, TileList, gridMoves} from '@renderer/ui';
import {noticeReason} from './noticeEdits';
import styles from './NoticePlayback.module.css';

function usePosition(playback: Playback | undefined): number | undefined {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!playback) return undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = (): void => {
      const wall = Date.now();
      setNow(wall);
      const delay = nextNoticeChange(playback, wall);
      if (delay !== null) {
        timer = setTimeout(tick, Math.min(delay, MAX_OVERLAY_TIMER_MS));
      }
    };
    tick();
    return () => {
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [playback]);
  return playback ? noticePosition(playback, now) : undefined;
}

export function NoticePlayback({
  item,
  media,
}: {
  readonly item: NoticeSet;
  readonly media: readonly MediaItem[];
}): JSX.Element {
  const layer = useLive(view => view.state?.layers.notice);
  const playback = layer?.noticeId === item.id ? layer.playback : undefined;
  const position = usePosition(playback);
  const paused = playback?.pausedAt !== null && playback !== undefined;
  const reason = noticeReason(item);
  const toggle = (): void => {
    if (playback && !paused) sendLive({type: 'notice.pause'});
    else sendLive({type: 'notice.start', noticeId: item.id});
  };
  return (
    <div>
      <div className={styles.controls}>
        <span>{`슬라이드 ${item.media.length}개`}</span>
        <Button
          disabled={reason !== undefined && !(playback && !paused)}
          title={reason}
          onClick={toggle}
        >
          {playback && !paused ? '일시 정지' : '재생'}
        </Button>
      </div>
      <TileList
        label="공지 이미지"
        workspace="show"
        moves={gridMoves}
        columns="auto"
        arrowsMove="focus"
        spaceKey="press"
        selected={undefined}
        className={styles.grid}
        onActivate={index => {
          if (!reason && item.media[index]) {
            sendLive({
              type: 'notice.start',
              noticeId: item.id,
              position: index,
            });
          }
        }}
      >
        {item.media.map((id, index) => {
          const source = media.find(entry => entry.id === id);
          return (
            <MediaTile
              key={`${id}-${index}`}
              name={source?.name ?? `이미지 ${index + 1}`}
              picture={mediaUrl(id)}
              live={position === index}
            />
          );
        })}
      </TileList>
    </div>
  );
}
