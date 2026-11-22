import {useMemo, type JSX} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import {displayReference} from '@core/bible/displayReference';
import {withLiveBible} from '@core/bible/liveTranslation';
import type {BiblePassage} from '@core/schema/biblePassage';
import type {SongId} from '@core/schema/ids';
import {isItemOfKind, type SlidesItem} from '@core/schema/service';
import {useSettingsDocument} from '@renderer/platform/useSettingsDocument';
import type {Report} from '@renderer/session/serviceEdit';
import {songUsage} from '@renderer/features/songs/library/songUsage';
import {useSongDraft} from '@renderer/features/songs/songDraft';
import {useShow} from '@renderer/session/show';
import {Button} from '@renderer/ui/Button';
import {
  Properties,
  PropertyGroup,
  PropertyRow,
  PropertyValue,
} from '@renderer/ui/PropertyRow';
import {Tooltip} from '@renderer/ui/Tooltip';
import {LiturgyVersion} from '../editor/ItemTools';
import {useServiceSongMenu} from '../order/useServiceSongMenu';
import {ItemMemo, ItemStartRow} from './ItemSettingsRows';
import styles from './DetailsInfo.module.css';

function SongSource({
  songId,
  itemId,
  onOpenSong,
  report,
}: {
  readonly songId: SongId;
  /** The item that uses the song; none for the song of the library itself. */
  readonly itemId: string | null;
  readonly onOpenSong: (songId: SongId) => void;
  readonly report: Report;
}): JSX.Element {
  const serviceId = useShow(view => view.serviceId);
  const library = useSongDraft(view => view.library);
  const status = useSongDraft(view => view.libraryStatus);
  const target = useMemo(
    () => (itemId === null ? null : {id: itemId, serviceId}),
    [itemId, serviceId],
  );
  const transfer = useServiceSongMenu(target, report);
  const usage = songUsage(library, status, songId);
  const song = library.find(entry => entry.id === songId);
  const reason = transfer.reason ?? (transfer.locked ? '저장 중' : undefined);
  return (
    <PropertyGroup title="원본">
      {itemId === null ? null : (
        <PropertyValue
          label="곡"
          value={song?.title ?? '없는 곡'}
          action={
            <Button
              disabled={song === undefined}
              title={song === undefined ? '곡을 찾을 수 없습니다' : undefined}
              onClick={() => onOpenSong(songId)}
            >
              열기
            </Button>
          }
        />
      )}
      <Tooltip text={usage.tooltip}>
        <div tabIndex={0}>
          <PropertyValue label="쓰는 곳" value={usage.text} />
        </div>
      </Tooltip>
      {itemId === null ? null : (
        <>
          <PropertyRow label="라이브러리에 저장">
            {() => (
              <Button
                className={styles.button}
                disabled={reason !== undefined}
                title={reason}
                onClick={transfer.save}
              >
                라이브러리에 저장…
              </Button>
            )}
          </PropertyRow>
          <PropertyRow label="다시 불러오기">
            {() => (
              <Button
                className={styles.button}
                disabled={reason !== undefined}
                title={reason}
                onClick={transfer.reload}
              >
                라이브러리에서 다시 불러오기
              </Button>
            )}
          </PropertyRow>
        </>
      )}
      {transfer.dialog}
    </PropertyGroup>
  );
}

/** The passage the slides of an item were made of. */
function PassageSource({
  passage,
}: {
  readonly passage: BiblePassage;
}): JSX.Element {
  const bible = useSettingsDocument('bible', '성경', undefined);
  const translation = withLiveBible(bible?.value.translations ?? []).find(
    entry => entry.id === passage.translation,
  );
  return (
    <PropertyGroup title="원본">
      <PropertyValue label="구절" value={displayReference(passage.ref)} />
      <PropertyValue
        label="성경"
        value={translation?.name ?? passage.translation}
      />
    </PropertyGroup>
  );
}

/** What the selected source is made of, and how it plays in this service. */
export function DetailsInfo({
  item,
  songId,
  api,
  reason,
  onOpenSong,
  report,
}: {
  readonly item: SlidesItem | undefined;
  /** The song of the library that is selected instead of an item. */
  readonly songId: SongId | null;
  readonly api: LlpApi;
  readonly reason: string | undefined;
  readonly onOpenSong: (songId: SongId) => void;
  readonly report: Report;
}): JSX.Element {
  const song = item !== undefined && isItemOfKind(item, 'song') ? item : null;
  return (
    <Properties className={styles.properties}>
      {item === undefined ? null : (
        <PropertyGroup title="이번 예배">
          {isItemOfKind(item, 'liturgy') ? (
            <PropertyRow label="예식문 버전">
              {() => (
                <LiturgyVersion
                  item={item}
                  disabled={reason !== undefined}
                  report={report}
                />
              )}
            </PropertyRow>
          ) : null}
          <ItemStartRow
            api={api}
            item={item}
            lockReason={reason}
            report={report}
          />
          <PropertyRow label="메모" alignTop>
            {() => (
              <ItemMemo
                key={item.id}
                item={item}
                lockReason={reason}
                report={report}
              />
            )}
          </PropertyRow>
        </PropertyGroup>
      )}
      {song !== null ? (
        <SongSource
          songId={song.song}
          itemId={song.id}
          onOpenSong={onOpenSong}
          report={report}
        />
      ) : songId !== null ? (
        <SongSource
          songId={songId}
          itemId={null}
          onOpenSong={onOpenSong}
          report={report}
        />
      ) : item !== undefined && 'passage' in item ? (
        <PassageSource passage={item.passage} />
      ) : null}
    </Properties>
  );
}
