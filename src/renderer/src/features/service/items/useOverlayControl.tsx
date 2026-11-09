import {useState, type JSX} from 'react';
import {createItemOverlayId, type ItemOverlayId} from '@core/schema/ids';
import type {ItemOverlay} from '@core/schema/itemOverlays';
import type {MediaId} from '@core/schema/ids';
import {THEME_LIMITS} from '@core/themes/elementRules';
import {newOverlaySpan, overlayAt} from '@core/themes/overlayRanges';
import {editorTask} from '@renderer/features/songs/editor/editorTask';
import {menuAvailability, type MenuEntry} from '@renderer/ui/menuModel';
import {ItemOverlayContent} from './ItemOverlayContent';
import type {OverlayEditing} from './overlayEditing';

type Dialog =
  | {readonly kind: 'add'; readonly position: number}
  | {readonly kind: 'replace'; readonly id: ItemOverlayId};

/** The state and commands that the clips, the slide menu, and drops share. */
export interface OverlayControl {
  readonly editing: OverlayEditing;
  /** The clip the operator chose; Delete removes it. */
  readonly chosen: ItemOverlayId | null;
  readonly choose: (id: ItemOverlayId | null) => void;
  /** 오버레이 추가…, 오버레이 바꾸기…, and 오버레이 삭제 for a slide, by place from 1. */
  readonly entries: (position: number) => readonly MenuEntry[];
  /** Puts a dropped media file on a slide as an 오버레이, or replaces its media. */
  readonly dropMedia: (position: number, media: MediaId) => void;
  readonly replaceContent: (id: ItemOverlayId) => void;
  readonly remove: (id: ItemOverlayId) => void;
  /** The dialog of the command in progress; render it once. */
  readonly dialog: JSX.Element | null;
}

function nameOf(editing: OverlayEditing, media: MediaId): string | undefined {
  return editing.media
    .find(item => item.id === media)
    ?.name.slice(0, THEME_LIMITS.name);
}

export function useOverlayControl(editing: OverlayEditing): OverlayControl {
  const [chosen, choose] = useState<ItemOverlayId | null>(null);
  const [open, setOpen] = useState<Dialog | null>(null);
  const {overlays, count, reason} = editing;

  const addReason = (position: number): string | undefined =>
    reason ??
    (overlays.length >= THEME_LIMITS.overlays
      ? `오버레이는 ${THEME_LIMITS.overlays}개까지 추가할 수 있습니다`
      : newOverlaySpan(overlays, position, count) === undefined
        ? '이 슬라이드에 오버레이가 있습니다'
        : undefined);

  const add = (
    position: number,
    content: ItemOverlay['content'],
    name: string | undefined,
  ): Promise<boolean> => {
    const span = newOverlaySpan(overlays, position, count);
    if (span === undefined) return Promise.resolve(false);
    const overlay: ItemOverlay = {
      id: createItemOverlayId(crypto.randomUUID()),
      name: name ?? `오버레이 ${overlays.length + 1}`,
      from: span.from,
      to: span.to,
      screens: [...editing.defaultScreens],
      content,
    };
    return editing
      .change(current => [...current, overlay])
      .then(saved => {
        if (saved) choose(overlay.id);
        return saved;
      });
  };
  const setContent = (
    id: ItemOverlayId,
    content: ItemOverlay['content'],
  ): Promise<boolean> =>
    editing.change(current =>
      current.map(row => (row.id === id ? {...row, content} : row)),
    );
  const remove = (id: ItemOverlayId): void => {
    if (reason !== undefined) return;
    editorTask(
      editing
        .change(current => current.filter(row => row.id !== id))
        .then(saved => {
          if (saved) choose(current => (current === id ? null : current));
        }),
    );
  };
  const dropMedia = (position: number, media: MediaId): void => {
    if (reason !== undefined) return;
    const existing = overlayAt(overlays, position);
    if (existing === undefined) {
      if (addReason(position) !== undefined) return;
      editorTask(
        add(
          position,
          {media, loop: false, sound: false},
          nameOf(editing, media),
        ),
      );
      return;
    }
    const same =
      'media' in existing.content && existing.content.media === media;
    if (same) return;
    const kept =
      'media' in existing.content
        ? {loop: existing.content.loop, sound: existing.content.sound}
        : {loop: false, sound: false};
    editorTask(setContent(existing.id, {media, ...kept}));
  };
  const entries = (position: number): readonly MenuEntry[] => {
    const existing = overlayAt(overlays, position);
    if (existing === undefined) {
      return [
        {
          kind: 'item',
          id: 'overlay-add',
          label: '오버레이 추가…',
          ...menuAvailability(addReason(position)),
          onSelect: () => setOpen({kind: 'add', position}),
        },
      ];
    }
    return [
      {
        kind: 'item',
        id: 'overlay-replace',
        label: '오버레이 바꾸기…',
        ...menuAvailability(reason),
        onSelect: () => setOpen({kind: 'replace', id: existing.id}),
      },
      {
        kind: 'item',
        id: 'overlay-remove',
        contextGroup: 'delete',
        label: '오버레이 삭제',
        danger: true,
        ...menuAvailability(reason),
        onSelect: () => remove(existing.id),
      },
    ];
  };

  const target =
    open === null
      ? undefined
      : open.kind === 'replace'
        ? overlays.find(row => row.id === open.id)
        : ({
            id: createItemOverlayId(crypto.randomUUID()),
            name: '',
            from: open.position,
            to: open.position,
            screens: [],
            content: {text: ''},
          } satisfies ItemOverlay);
  const dialog =
    open === null || target === undefined ? null : (
      <ItemOverlayContent
        overlay={target}
        media={editing.media}
        onClose={() => setOpen(null)}
        onSave={content => {
          if (open.kind === 'replace') return setContent(open.id, content);
          const file =
            'media' in content ? nameOf(editing, content.media) : undefined;
          return add(open.position, content, file);
        }}
      />
    );
  return {
    editing,
    chosen,
    choose,
    entries,
    dropMedia,
    replaceContent: id => setOpen({kind: 'replace', id}),
    remove,
    dialog,
  };
}
