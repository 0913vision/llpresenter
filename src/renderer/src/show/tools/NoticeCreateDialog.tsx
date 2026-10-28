import {useState, type JSX} from 'react';
import {createNoticeSetId} from '@shared/schema/ids';
import type {MediaList} from '@shared/schema/mediaList';
import {MAX_NOTICE_IMAGES} from '@shared/schema/overlayState';
import type {NoticeSet} from '@shared/schema/notices';
import type {Screen} from '@shared/schema/screens';
import {
  Button,
  Dialog,
  Properties,
  PropertyRow,
  SelectMenu,
  TextField,
} from '@renderer/ui';
import {noticeReason} from './noticeEdits';

export function NoticeCreateDialog({
  media,
  screens,
  locked,
  onCancel,
  onSave,
}: {
  readonly media: MediaList;
  readonly screens: readonly Screen[];
  readonly locked: boolean;
  readonly onCancel: () => void;
  readonly onSave: (item: NoticeSet) => void;
}): JSX.Element {
  const [id] = useState(() => createNoticeSetId(crypto.randomUUID()));
  const [playlistId, setPlaylistId] = useState<string>();
  const [name, setName] = useState('');
  const [targets, setTargets] = useState<NoticeSet['targets']>([]);
  const images = new Set(
    media.items.filter(item => item.kind === 'image').map(item => item.id),
  );
  const playlists = media.playlists.filter(
    playlist =>
      playlist.items.length > 0 &&
      playlist.items.length <= MAX_NOTICE_IMAGES &&
      playlist.items.every(id => images.has(id)),
  );
  const playlist = playlists.find(value => value.id === playlistId);
  const currentTargets = targets.filter(id =>
    screens.some(screen => screen.id === id),
  );
  const item: NoticeSet | undefined = playlist
    ? {
        id,
        name,
        media: playlist.items,
        interval: 8,
        loop: true,
        targets: currentTargets,
      }
    : undefined;
  const reason = item ? noticeReason(item) : '이미지 재생목록을 선택하세요';
  return (
    <Dialog
      title="공지 추가"
      size="s"
      onCancel={onCancel}
      primary={{
        label: '추가',
        disabled: locked || reason !== undefined,
        title: reason,
        onSelect: () => {
          if (item) onSave(item);
        },
      }}
    >
      <Properties placement="window">
        <PropertyRow label="이미지 재생목록">
          {({controlId}) => (
            <SelectMenu
              id={controlId}
              block
              value={playlistId}
              disabled={!playlists.length || locked}
              options={playlists.map(value => ({
                value: value.id,
                label: value.name,
              }))}
              onChange={value => {
                setPlaylistId(value);
                setName(
                  playlists.find(entry => entry.id === value)?.name ?? '',
                );
              }}
            />
          )}
        </PropertyRow>
        <PropertyRow label="이름">
          {({controlId}) => (
            <TextField
              id={controlId}
              block
              value={name}
              maxLength={256}
              readOnly={locked}
              onChange={setName}
            />
          )}
        </PropertyRow>
        <PropertyRow label="보낼 화면" alignTop>
          {() => (
            <div role="group" aria-label="보낼 화면">
              {screens.map(screen => (
                <Button
                  key={screen.id}
                  aria-pressed={targets.includes(screen.id)}
                  onClick={() =>
                    setTargets(current =>
                      current.includes(screen.id)
                        ? current.filter(id => id !== screen.id)
                        : [...current, screen.id],
                    )
                  }
                >
                  {screen.name || '이름 없음'}
                </Button>
              ))}
            </div>
          )}
        </PropertyRow>
      </Properties>
    </Dialog>
  );
}
