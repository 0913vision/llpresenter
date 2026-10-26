import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type JSX,
} from 'react';
import type {LlpApi} from '@shared/ipc';
import {mediaUrl} from '@shared/media';
import type {MediaDocument} from '@shared/schema/mediaEdit';
import type {ServiceItemOf} from '@shared/schema/service';
import type {SettingsDocument} from '@shared/schema/settingsDocuments';
import {editorTask} from '@renderer/prep/editor/editorTask';
import {TYPING_PAUSE_MS} from '@renderer/prep/editor/songHistory';
import type {SongSession} from '@renderer/prep/editor/songSession';
import {
  backgroundEntries,
  backgroundMedia,
  mediaName,
  SONG_DEFAULT_LABEL,
} from '@renderer/show/backgroundChoices';
import {Menu} from '@renderer/ui/Menu';
import {PropertyRow} from '@renderer/ui/PropertyRow';
import {Select} from '@renderer/ui/Select';
import {SelectMenu} from '@renderer/ui/SelectMenu';
import {TextArea} from '@renderer/ui/TextArea';
import type {ItemTarget, ServiceItemStore} from './serviceItemStore';
import {useFollowedDocument, type DocumentSource} from './useFollowedDocument';

const NONE = '없음';
const NO_MACRO = '';
const MACRO_META = '매크로';
const MISSING_BACKGROUND = '배경 파일 없음';
const MISSING_MACRO = '매크로 없음';
const LOADING_REASON = '불러오는 중';
const READ_FAILED_REASON = '불러오지 못했습니다';
const MACROS_FAILED_REASON = '매크로를 불러오지 못했습니다';

type MacrosDocument = Extract<SettingsDocument, {name: 'macros'}>;
type Macro = MacrosDocument['value']['macros'][number];

/** A reference names a 매크로 by ID, or by name in older files (spec 02). */
export function resolveMacro(
  macros: readonly Macro[],
  reference: string | undefined,
): Macro | undefined {
  if (reference === undefined) return undefined;
  return (
    macros.find(macro => macro.id === reference) ??
    macros.find(macro => macro.name === reference)
  );
}

function useMediaDocument(api: LlpApi['media']) {
  const source = useMemo<DocumentSource<MediaDocument>>(
    () => ({read: () => api.get(), follow: accept => api.subscribe(accept)}),
    [api],
  );
  return useFollowedDocument(source);
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
    }),
    [api],
  );
  return useFollowedDocument(source);
}

interface RowState {
  readonly items: ServiceItemStore;
  readonly api: Pick<LlpApi, 'media' | 'settings'>;
  /** Why the row can't change now, or `undefined`. */
  readonly lockReason: string | undefined;
}

/** 배경: the item's own background, or 곡 기본값 that follows the song. */
export function ItemBackgroundRow({
  items,
  api,
  lockReason,
  item,
  session,
}: RowState & {
  readonly item: ServiceItemOf<'song'>;
  readonly session: SongSession;
}): JSX.Element {
  const media = useMediaDocument(api.media);
  const [button, setButton] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const mediaId = item.background ?? session.background;
  const inherited = item.background === undefined;
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
            value={
              selected === undefined
                ? mediaId === undefined
                  ? NONE
                  : MISSING_BACKGROUND
                : mediaName(selected)
            }
            meta={inherited ? SONG_DEFAULT_LABEL : undefined}
            lead={
              selected === undefined
                ? undefined
                : {
                    kind: 'media',
                    src: mediaUrl(selected.id),
                    mediaType: selected.kind === 'video' ? 'video' : 'image',
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
            <Menu
              label="배경"
              anchor={{kind: 'element', element: button}}
              search={{value: query, onChange: setQuery}}
              minWidth={button.getBoundingClientRect().width}
              onClose={() => setOpen(false)}
              entries={backgroundEntries({
                items: list,
                query,
                mediaId,
                inherited,
                onChoose: choice => editorTask(items.setBackground(choice)),
              })}
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
  useEffect(() => () => flushOnLeave(), []);
  return (
    <TextArea
      aria-label="메모"
      value={typed ?? unsaved ?? saved}
      readOnly={lockReason !== undefined}
      title={lockReason}
      onChange={value => {
        setTyped(value);
        latest.current = value;
        clearTimeout(timer.current);
        timer.current = setTimeout(save, TYPING_PAUSE_MS);
      }}
      onBlur={save}
    />
  );
}
