import {
  use,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type JSX,
} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import {thumbnailSrc} from '@contracts/ipc/thumbnailRevisions';
import type {MediaDocument} from '@core/schema/mediaEdit';
import type {ItemBackgroundChoice} from '@renderer/session/serviceBackground';
import type {StartItem} from '@core/services/itemFieldChanges';
import type {SettingsDocument} from '@core/schema/settingsDocuments';
import {editorTask} from '@renderer/features/songs/editor/editorTask';
import {TYPING_PAUSE_MS} from '@core/songs/songHistory';
import type {SongSession} from '@renderer/features/songs/editor/songSession';
import {
  backgroundName,
  backgroundMedia,
  SONG_DEFAULT_LABEL,
} from '@renderer/features/media/backgroundChoices';
import {MediaPicker} from '@renderer/features/songs/editor/MediaPicker';
import {PropertyRow} from '@renderer/ui/PropertyRow';
import {Select} from '@renderer/ui/Select';
import {usePrepPictureSwitch} from '@renderer/rendering/PrepPictureSwitch';
import {pictures} from '@renderer/rendering/pictures/pictureService';
import {thumbnailReady} from '@renderer/rendering/pictures/thumbnailReady';
import {SelectMenu} from '@renderer/ui/SelectMenu';
import {TextArea} from '@renderer/ui/TextArea';
import type {ItemTarget, ServiceItemStore} from '../items/serviceItemStore';
import {
  useFollowedDocument,
  type DocumentSource,
  type FollowedDocument,
} from '../items/useFollowedDocument';

const NONE = '없음';
const NO_MACRO = '';
const MACRO_META = '매크로';
const MISSING_MACRO = '매크로 없음';
const LOADING_REASON = '불러오는 중';
const READ_FAILED_REASON = '불러오지 못했습니다';
const MACROS_FAILED_REASON = '매크로를 불러오지 못했습니다';

type MacrosDocument = Extract<SettingsDocument, {name: 'macros'}>;
type Macro = MacrosDocument['value']['macros'][number];

/** A reference names a 매크로 by its ID. */
export function resolveMacro(
  macros: readonly Macro[],
  reference: string | undefined,
): Macro | undefined {
  if (reference === undefined) return undefined;
  return macros.find(macro => macro.id === reference);
}

function useMediaDocument(api: LlpApi['media'], enabled: boolean) {
  const source = useMemo<DocumentSource<MediaDocument>>(
    () => ({
      read: () => api.get(),
      follow: accept => api.subscribe(accept),
      // NOTE(0913vision): The window keeps the media list, so the rows show
      // their choices in the panel's first frame.
      kept: {
        owner: api,
        name: 'media',
        is: (document: {
          readonly revision: number;
        }): document is MediaDocument =>
          'name' in document && document.name === 'media',
      },
    }),
    [api],
  );
  return useFollowedDocument(source, enabled);
}

function useMacros(api: LlpApi['settings']) {
  const source = useMemo<DocumentSource<MacrosDocument>>(
    () => ({
      read: async () => {
        const document = await api.get({name: 'macros'});
        if (document.name !== 'macros') {
          throw new Error('The macros read answered another document');
        }
        return document;
      },
      follow: accept =>
        api.subscribe(document => {
          if (document.name === 'macros') accept(document);
        }),
      // NOTE(0913vision): The window keeps the 매크로 list, so 시작할 때 is
      // ready in the panel's first frame instead of disabled for a moment.
      kept: {
        owner: api,
        name: 'macros',
        is: (document: {
          readonly revision: number;
        }): document is MacrosDocument =>
          'name' in document && document.name === 'macros',
      },
    }),
    [api],
  );
  return useFollowedDocument(source);
}

interface RowState {
  readonly items: ServiceItemStore;
  readonly api: Pick<LlpApi, 'media' | 'settings'>;
  readonly lockReason: string | undefined;
}

/** 배경: the item's own background, or 곡 기본값 that follows the song. */
export function ItemBackgroundRow({
  items,
  api,
  lockReason,
  item,
  session,
  mediaDocument,
  setBackground,
}: RowState & {
  readonly setBackground?:
    ((id: ItemBackgroundChoice) => Promise<boolean>) | undefined;
  readonly item: StartItem;
  readonly session?: SongSession;
  readonly mediaDocument?: FollowedDocument<MediaDocument>;
}): JSX.Element {
  const ownMedia = useMediaDocument(api.media, mediaDocument === undefined);
  const media = mediaDocument ?? ownMedia;
  const [button, setButton] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const mediaId =
    item.backgroundNone === true
      ? undefined
      : (item.background ?? session?.background);
  const switching = usePrepPictureSwitch();
  if (switching && mediaId !== undefined && !pictures.drawInPlace) {
    use(thumbnailReady(thumbnailSrc(mediaId)));
  }
  const inherited =
    item.backgroundNone !== true && item.background === undefined;
  const list = media.document?.value.items ?? [];
  const selected = backgroundMedia(list).find(entry => entry.id === mediaId);
  const reason =
    lockReason ??
    (media.failed
      ? READ_FAILED_REASON
      : media.document === null
        ? LOADING_REASON
        : undefined);
  const disabled = lockReason !== undefined || media.document === null;
  return (
    <PropertyRow label="배경">
      {({controlId}) => (
        <>
          <Select
            ref={setButton}
            id={controlId}
            block
            value={backgroundName(list, mediaId)}
            meta={
              inherited
                ? session === undefined
                  ? '테마 기본값'
                  : SONG_DEFAULT_LABEL
                : undefined
            }
            lead={
              selected === undefined
                ? undefined
                : {
                    kind: 'media',
                    src: thumbnailSrc(selected.id),
                  }
            }
            title={reason}
            disabled={disabled && !media.failed}
            expanded={open && !disabled}
            onExpandedChange={next => {
              if (media.failed) media.retry();
              else {
                setQuery('');
                setOpen(next);
              }
            }}
          />
          {open && !disabled && button !== null ? (
            <MediaPicker
              label="배경"
              anchor={button}
              items={list}
              selected={item.background}
              defaultChoice={{
                label:
                  session === undefined ? '테마 기본값' : SONG_DEFAULT_LABEL,
                detail:
                  session === undefined
                    ? ''
                    : backgroundName(list, session.background),
              }}
              explicitNone={{
                selected: item.backgroundNone === true,
                onSelect: () =>
                  editorTask(
                    (setBackground ?? items.setBackground.bind(items))('none'),
                  ),
              }}
              query={query}
              onQueryChange={setQuery}
              onSelect={choice =>
                editorTask(
                  (setBackground ?? items.setBackground.bind(items))(
                    choice ?? null,
                  ),
                )
              }
              onClose={restore => {
                setOpen(false);
                if (restore) button.focus();
              }}
            />
          ) : null}
        </>
      )}
    </PropertyRow>
  );
}

/** 시작할 때: the 매크로 that runs when the item starts, or 없음. */
export function ItemStartRow({
  items,
  api,
  lockReason,
  macroId,
}: RowState & {readonly macroId: string | undefined}): JSX.Element {
  const macros = useMacros(api.settings);
  const list = macros.document?.value.macros ?? [];
  const current = resolveMacro(list, macroId);
  if (macros.failed && lockReason === undefined) {
    return (
      <PropertyRow label="시작할 때">
        {({controlId}) => (
          <Select
            id={controlId}
            block
            value={NONE}
            title={MACROS_FAILED_REASON}
            expanded={false}
            onExpandedChange={() => macros.retry()}
          />
        )}
      </PropertyRow>
    );
  }
  const reason =
    lockReason ?? (macros.document === null ? LOADING_REASON : undefined);
  return (
    <PropertyRow label="시작할 때">
      {({controlId}) => (
        <SelectMenu
          id={controlId}
          block
          menuLabel="시작할 때"
          options={[
            {value: NO_MACRO, label: NONE},
            ...list.map(macro => ({value: macro.id, label: macro.name})),
          ]}
          value={current?.id ?? macroId ?? NO_MACRO}
          valueText={
            current?.name ?? (macroId === undefined ? NONE : MISSING_MACRO)
          }
          lead={
            current === undefined
              ? undefined
              : {kind: 'tile', color: current.color, icon: current.icon}
          }
          meta={current === undefined ? undefined : MACRO_META}
          title={reason}
          disabled={reason !== undefined}
          onChange={value =>
            editorTask(
              items.setStartMacro(value === NO_MACRO ? undefined : value),
            )
          }
        />
      )}
    </PropertyRow>
  );
}

/**
 * 메모: saved after a typing pause and on blur, always to the item it was
 * typed for. Text that isn't saved yet stays on screen, also after the item
 * changes, until a save succeeds.
 */
export function ItemMemo({
  items,
  target,
  saved,
  lockReason,
}: {
  readonly items: ServiceItemStore;
  readonly target: ItemTarget;
  readonly saved: string;
  readonly lockReason: string | undefined;
}): JSX.Element {
  const unsaved = useSyncExternalStore(items.subscribe, () =>
    items.memoDraft(target),
  );
  const hasRoom = useSyncExternalStore(items.subscribe, () =>
    items.hasMemoRoom(target),
  );
  const activeItem = useSyncExternalStore(
    items.subscribe,
    () => items.getSnapshot().item?.id,
  );
  const reason = lockReason ?? (hasRoom ? undefined : items.memoRoomReason);
  const [typed, setTyped] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef<string | null>(null);
  const save = (): void => {
    clearTimeout(timer.current);
    timer.current = undefined;
    const value = latest.current;
    if (value === null) return;
    latest.current = null;
    editorTask(
      items.setMemo(target, value).then(saved => {
        if (saved) setTyped(current => (current === value ? null : current));
      }),
    );
  };
  const flushOnLeave = useEffectEvent(save);
  useEffect(() => {
    if (activeItem !== target.itemId) flushOnLeave();
  }, [activeItem, target.itemId]);
  useEffect(() => () => flushOnLeave(), []);
  return (
    <TextArea
      aria-label="메모"
      value={typed ?? unsaved ?? saved}
      readOnly={reason !== undefined}
      title={reason}
      onChange={value => {
        if (!items.typeMemo(target, value)) return;
        setTyped(value);
        latest.current = value;
        clearTimeout(timer.current);
        timer.current = setTimeout(save, TYPING_PAUSE_MS);
      }}
      onBlur={save}
    />
  );
}
