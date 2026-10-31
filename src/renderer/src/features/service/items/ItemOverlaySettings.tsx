import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
  type JSX,
} from 'react';
import type {SongEditorStore} from '@renderer/features/songs/editor';
import {editorTask} from '@renderer/features/songs/editor/editorTask';
import type {ItemOverlay} from '@core/schema/itemOverlays';
import type {MediaItem} from '@core/schema/mediaList';
import type {Screen} from '@core/schema/screens';
import {thumbnailUrl} from '@contracts/ipc/mediaUrls';
import {Icon} from '@renderer/ui/Icon';
import {THEME_LIMITS} from '@core/themes/elementRules';
import {Button} from '@renderer/ui/Button';
import {Checkbox} from '@renderer/ui/Checkbox';
import {TextField} from '@renderer/ui/TextField';
import {SegmentedControl} from '@renderer/ui/SegmentedControl';
import {PropertyGroup, PropertyRow} from '@renderer/ui/PropertyRow';
import {useItemMedia, useItemSettings} from './useItemSources';
import type {ItemTarget, ServiceItemStore} from './serviceItemStore';
import {onShortcutCommit} from '@renderer/ui/commitDraft';
import {isComposing} from '@renderer/ui/ime';
import {hasModifier} from '@renderer/ui/modifierKeys';
import {ItemOverlayContent} from './ItemOverlayContent';
import {AlertDialog} from '@renderer/ui/AlertDialog';
import styles from './ItemOverlays.module.css';
import {ItemOverlayRange} from './ItemOverlayRange';

export function ItemOverlaySettings({
  items,
  editor,
  count,
  reason,
}: {
  readonly items: ServiceItemStore;
  readonly editor: SongEditorStore;
  readonly count: number;
  readonly reason: string | undefined;
}): JSX.Element | null {
  const state = useSyncExternalStore(items.subscribe, items.getSnapshot);
  const overlay = state.item?.overlays?.find(row => row.id === state.overlay);
  const media = useItemMedia(editor.api.media, overlay !== undefined);
  const screens = useItemSettings(
    editor.api.settings,
    'screens',
    overlay !== undefined,
  );
  if (overlay === undefined || state.service === null || state.item === null) {
    return null;
  }
  return (
    <OverlayFields
      key={`${state.service.service.id}:${state.item.id}:${overlay.id}`}
      overlay={overlay}
      rows={state.item.overlays ?? []}
      items={items}
      target={{serviceId: state.service.service.id, itemId: state.item.id}}
      media={media.document?.value.items ?? []}
      screens={
        screens.document?.name === 'screens'
          ? screens.document.value.screens
          : []
      }
      count={count}
      reason={reason}
    />
  );
}

function OverlayFields({
  overlay,
  rows,
  items,
  target,
  media,
  screens,
  count,
  reason,
}: {
  readonly overlay: ItemOverlay;
  readonly rows: readonly ItemOverlay[];
  readonly items: ServiceItemStore;
  readonly target: ItemTarget;
  readonly media: readonly MediaItem[];
  readonly screens: readonly Screen[];
  readonly count: number;
  readonly reason: string | undefined;
}): JSX.Element {
  const [name, setName] = useState<string | null>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const pendingName = useRef<string | null>(null);

  const [contentOpen, setContentOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const update = (patch: Partial<ItemOverlay>): void =>
    editorTask(
      items.changeOverlays(current =>
        current.map(row => (row.id === overlay.id ? {...row, ...patch} : row)),
      ),
    );

  const mediaContent = 'media' in overlay.content ? overlay.content : undefined;
  const file = media.find(item => item.id === mediaContent?.media);
  const saveName = (): void => {
    if (name === null || name.trim() === '' || pendingName.current === name) {
      return;
    }
    pendingName.current = name;
    editorTask(
      items
        .changeOverlays(
          current =>
            current.map(row => (row.id === overlay.id ? {...row, name} : row)),
          target,
        )
        .then(saved => {
          pendingName.current = null;
          if (saved) setName(current => (current === name ? null : current));
        }),
    );
  };
  const flushName = useEffectEvent(saveName);
  useEffect(() => {
    const node = nameInput.current;
    if (node === null) return undefined;
    const stop = onShortcutCommit(node, () => flushName());
    return () => {
      stop();
      flushName();
    };
  }, []);
  return (
    <PropertyGroup title="오버레이">
      <PropertyRow label="이름">
        {({controlId}) => (
          <TextField
            ref={nameInput}
            id={controlId}
            value={name ?? overlay.name}
            maxLength={THEME_LIMITS.name}
            readOnly={reason !== undefined}
            invalid={name?.trim() === ''}
            invalidReason={
              name?.trim() === '' ? '이름을 입력하세요' : undefined
            }
            title={reason}
            onChange={setName}
            onBlur={saveName}
            onKeyDown={event => {
              if (isComposing(event) || hasModifier(event)) return;
              if (event.key === 'Enter') {
                event.preventDefault();
                event.stopPropagation();
                saveName();
              } else if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                setName(null);
              }
            }}
          />
        )}
      </PropertyRow>
      <PropertyRow label="내용">
        {() => (
          <div className={styles.controls}>
            {file === undefined ? null : (
              <span
                className={styles.contentThumbnail}
                style={{backgroundImage: `url("${thumbnailUrl(file.id)}")`}}
                aria-hidden="true"
              >
                <Icon
                  name={file.kind === 'video' ? 'play' : 'image'}
                  size={14}
                />
              </span>
            )}
            <span className={styles.truncate}>
              {file?.name ??
                ('text' in overlay.content
                  ? overlay.content.text || '글자'
                  : '미디어 없음')}
            </span>
            <Button
              disabled={reason !== undefined}
              title={reason}
              onClick={() => setContentOpen(true)}
            >
              바꾸기…
            </Button>
          </div>
        )}
      </PropertyRow>
      <ItemOverlayRange
        overlay={overlay}
        rows={rows}
        items={items}
        count={count}
        reason={reason}
      />
      <PropertyRow label="화면" alignTop>
        {({controlId, labelId}) => (
          <div
            id={controlId}
            role="group"
            aria-labelledby={labelId}
            className={styles.checks}
          >
            {screens.map(screen => (
              <label key={screen.id} className={styles.controls}>
                <Checkbox
                  aria-label={screen.name}
                  checked={overlay.screens.includes(screen.id)}
                  disabled={reason !== undefined}
                  title={reason}
                  onChange={checked =>
                    update({
                      screens: checked
                        ? [...overlay.screens, screen.id]
                        : overlay.screens.filter(id => id !== screen.id),
                    })
                  }
                />
                {screen.name}
              </label>
            ))}
          </div>
        )}
      </PropertyRow>
      {mediaContent !== undefined && file?.kind === 'video' ? (
        <>
          <PropertyRow label="끝나면">
            {({controlId, labelId}) => (
              <SegmentedControl
                id={controlId}
                labelledBy={labelId}
                options={[
                  {value: 'loop', label: '반복'},
                  {value: 'stop', label: '멈춤'},
                ]}
                value={mediaContent.loop ? 'loop' : 'stop'}
                disabled={reason !== undefined}
                title={reason}
                onChange={value =>
                  update({
                    content: {
                      ...mediaContent,
                      media: file.id,
                      loop: value === 'loop',
                      sound: mediaContent.sound,
                    },
                  })
                }
              />
            )}
          </PropertyRow>
          <PropertyRow label="소리">
            {({controlId}) => (
              <Checkbox
                id={controlId}
                checked={mediaContent.sound}
                disabled={reason !== undefined}
                title={reason}
                onChange={sound =>
                  update({
                    content: {
                      ...mediaContent,
                      media: file.id,
                      loop: mediaContent.loop,
                      sound,
                    },
                  })
                }
              />
            )}
          </PropertyRow>
        </>
      ) : null}
      <Button
        icon="trash"
        disabled={reason !== undefined}
        title={reason}
        onClick={() => setDeleting(true)}
      >
        오버레이 삭제
      </Button>
      {deleting ? (
        <AlertDialog
          icon="layers"
          title={`‘${overlay.name}’ 오버레이를 삭제할까요?`}
          onCancel={() => setDeleting(false)}
          actions={[
            {
              label: '삭제',
              primary: true,
              disabled: reason !== undefined,
              title: reason,
              onSelect: () =>
                editorTask(
                  items
                    .changeOverlays(current =>
                      current.filter(row => row.id !== overlay.id),
                    )
                    .then(saved => {
                      if (saved) setDeleting(false);
                    }),
                ),
            },
          ]}
        />
      ) : null}
      {contentOpen ? (
        <ItemOverlayContent
          overlay={overlay}
          media={media}
          onClose={() => setContentOpen(false)}
          onSave={content =>
            items.changeOverlays(current =>
              current.map(row =>
                row.id === overlay.id ? {...row, content} : row,
              ),
            )
          }
        />
      ) : null}
    </PropertyGroup>
  );
}
