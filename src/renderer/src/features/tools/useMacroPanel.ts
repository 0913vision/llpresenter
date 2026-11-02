import {limitReason} from '@core/common/limitReason';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {useMenuHandoff} from '@renderer/ui/useMenuHandoff';
import {useContext, useEffect, useRef, useState} from 'react';
import {parseMacroCollectionId, parseMacroId} from '@core/schema/ids';
import {freeName} from '@core/common/freeName';
import {
  MACRO_FILE_LIMITS,
  type MacroActionKind,
  type Macro,
  type MacroCollection,
  type KnownMacroAction,
} from '@core/schema/macros';
import type {MacroActionDraft} from '@core/macros/macroActionDraft';
import {prepareMacroAction} from '@core/macros/macroActionDraft';
import {useSettingsDocument} from '@renderer/platform/useSettingsDocument';
import {sendLive} from '@renderer/session/live';
import {WorkspaceNavigation} from '@renderer/platform/WorkspaceNavigation';
import {useShowToolTab} from './state/showToolTab';
import {useMacroPalette} from './state/macroPalette';
import type {MenuAnchor} from '@renderer/ui/Menu';
import type {Notice} from '@renderer/ui/notices';
import type {MacroViewMode} from './MacroView';
import {saveMacroEdit, type MacroEdit} from './macroEdits';
import {countMacroUses} from './macroUsage';
import {useToolEditing} from './useToolEditing';
import {toolMenuReason} from './toolMenuEntries';
import {useOptimisticCreation} from './useOptimisticCreation';
import {saveMacroCollectionEdit} from './macroCollectionEdits';
import type {MacroMenuHandlers} from './macroMenuEntries';

/** Captures the macro and action snapshot used by the active editor. */
export type MacroEditor =
  | {kind: 'color'; item: Macro; anchor: HTMLElement}
  | {kind: 'icon'; item: Macro}
  | {kind: 'new-collection'; item: Macro}
  | {
      kind: 'action';
      item: Macro;
      actionKind: MacroActionKind;
      index?: number | undefined;
      initial?: MacroActionDraft | undefined;
    }
  | {kind: 'rename'; item: Macro}
  | {kind: 'delete'; item: Macro; uses: number | null; failed: boolean};

/** Owns panel snapshots and revision-guarded writes without delaying optimistic creates. */
export interface MacroPanelModel {
  readonly macros: readonly Macro[];
  readonly collections: readonly MacroCollection[];
  readonly currentCollection: MacroCollection['id'] | undefined;
  readonly mode: MacroViewMode;
  readonly selectedId: Macro['id'] | undefined;
  readonly menu: {
    item: Macro;
    anchor: MenuAnchor;
    trigger: HTMLElement | undefined;
  } | null;
  readonly editor: MacroEditor | null;
  readonly collectionDialog: {kind: 'delete'; item: MacroCollection} | null;
  readonly palette: ReturnType<typeof useMacroPalette.getState>;
  readonly locked: boolean;
  readonly newDisabledReason: string | undefined;
  readonly onProblem: ((notice: Notice) => void) | undefined;
  readonly create: () => void;
  readonly createCollection: () => void;
  readonly selectCollection: (id: MacroCollection['id'] | undefined) => void;
  readonly changeMode: (value: MacroViewMode) => void;
  readonly start: (item: Macro) => void;
  readonly openMenu: (
    item: Macro,
    anchor: MenuAnchor,
    trigger: HTMLElement | undefined,
  ) => void;
  readonly closeMenu: () => void;
  readonly askDeleteCollection: (item: MacroCollection) => void;
  readonly dropAction:
    ((item: Macro, actionKind: MacroActionKind) => void) | undefined;
  readonly choosePaletteAction: (actionKind: MacroActionKind) => void;
  readonly menuHandlers: (item: Macro) => MacroMenuHandlers;
  readonly close: () => void;
  readonly closeCollection: () => void;
  readonly saveIcon: (icon: string) => void;
  readonly saveColor: (color: Macro['color']) => void;
  readonly saveAction: (action: KnownMacroAction) => void;
  readonly saveNewCollection: (name: string) => void;
  readonly rename: (name: string) => Promise<boolean>;
  readonly deleteCollection: () => void;
  readonly deleteMacro: () => void;
}

/** Keeps subscriptions, pending usage cancellation, optimistic items and save guards together. */
export function useMacroPanel({
  onProblem,
}: {
  readonly onProblem?: ((notice: Notice) => void) | undefined;
}): MacroPanelModel {
  const navigate = useContext(WorkspaceNavigation);
  const document = useSettingsDocument('macros', '매크로', onProblem);
  const [collection, setCollection] = useState<MacroCollection['id']>();
  const [selected, setSelected] = useState<Macro['id']>();
  const macroCreation = useOptimisticCreation<
    Macro & {readonly collection?: MacroCollection['id'] | undefined}
  >(document?.value.macros ?? []);
  const collectionCreation = useOptimisticCreation(
    document?.value.collections ?? [],
  );
  const macros = macroCreation.items;
  const collections = collectionCreation.items.map(group => ({
    ...group,
    macroIds: [
      ...group.macroIds,
      ...macroCreation.pending
        .filter(
          item =>
            item.collection === group.id && !group.macroIds.includes(item.id),
        )
        .map(item => item.id),
    ],
  }));
  const [mode, setMode] = useState<MacroViewMode>('grid');
  const [menu, setMenu] = useState<{
    item: Macro;
    anchor: MenuAnchor;
    trigger: HTMLElement | undefined;
  } | null>(null);
  const [editor, setEditor] = useState<MacroEditor | null>(null);
  const renameAfterMenu = useMenuHandoff<Macro>(menu !== null, item =>
    setEditor({kind: 'rename', item}),
  );
  const [collectionDialog, setCollectionDialog] = useState<{
    kind: 'delete';
    item: MacroCollection;
  } | null>(null);
  const palette = useMacroPalette();
  const paletteFor = palette.target;
  const revision = useRef(0);
  const pendingCount = useRef<AbortController | null>(null);
  useEffect(() => () => pendingCount.current?.abort(), []);
  const {busy, run} = useToolEditing({
    api: window.llp,
    write: saveMacroEdit,
    onProblem,
    area: {key: 'macros', label: '매크로', log: 'Could not edit macros'},
  });
  const collectionEdit = useToolEditing({
    api: window.llp,
    write: saveMacroCollectionEdit,
    onProblem,
    area: {
      key: 'macro-collections',
      label: '\ubaa8\uc74c',
      log: 'Could not edit macro collections',
    },
  });
  const locked =
    busy ||
    collectionEdit.busy ||
    document?.access !== 'editable' ||
    !window.llp;
  const currentGroup = collections.find(item => item.id === collection);
  const currentCollection = currentGroup?.id;
  const closeCollection = (): void => {
    revision.current++;
    setCollectionDialog(null);
  };
  const commitCollection = (
    edit: import('./macroCollectionEdits').MacroCollectionEdit,
    after: () => void,
  ): void => {
    const at = revision.current;
    collectionEdit.run(edit).then(
      saved => {
        if (saved && at === revision.current) after();
      },
      (cause: unknown) =>
        window.llp?.log.write({
          level: 'error',
          message: 'Macro collection callback failed',
          detail: String(cause),
        }),
    );
  };
  const close = (): void => {
    revision.current++;
    pendingCount.current?.abort();
    pendingCount.current = null;
    setEditor(null);
  };
  const commit = (edit: MacroEdit, after?: () => void): void => {
    const at = revision.current;
    run(edit).then(
      saved => {
        if (saved && at === revision.current) after?.();
      },
      (cause: unknown) =>
        window.llp?.log.write({
          level: 'error',
          message: 'Macro edit callback failed',
          detail: String(cause),
        }),
    );
  };
  const start = (item: Macro): void => {
    revision.current++;
    setSelected(undefined);
    sendLive({type: 'macro.run', macroId: item.id});
  };
  const create = (): void => {
    if (locked) return;
    const parsed = parseMacroId(crypto.randomUUID());
    if (!parsed.ok) return;
    const item: Macro = {
      id: parsed.value,
      name: freeName('새 매크로', new Set(macros.map(item => item.name))),
      icon: 'macro',
      color: 'teal',
      actions: [],
    };
    revision.current++;
    setSelected(item.id);
    macroCreation.create(
      {...item, collection: currentCollection},
      run({kind: 'add', item, collection: currentCollection}),
      () => setSelected(current => (current === item.id ? selected : current)),
    );
  };
  useWindowShortcuts([
    {id: 'macro.new', run: create},
    ...macros.map(item => ({id: `macro.${item.id}`, run: () => start(item)})),
  ]);
  const createCollection = (): void => {
    const parsed = parseMacroCollectionId(crypto.randomUUID());
    if (locked || !parsed.ok) return;
    const item: MacroCollection = {
      id: parsed.value,
      name: freeName('새 모음', new Set(collections.map(item => item.name))),
      macroIds: [],
    };
    revision.current++;
    setCollection(item.id);
    collectionCreation.create(
      item,
      collectionEdit.run({kind: 'add', collection: item}),
      () =>
        setCollection(current => (current === item.id ? collection : current)),
    );
  };
  const askDelete = (item: Macro): void => {
    const api = window.llp;
    if (!api) return;
    pendingCount.current?.abort();
    const controller = new AbortController();
    pendingCount.current = controller;
    setEditor({kind: 'delete', item, uses: null, failed: false});
    countMacroUses(api, item.id, controller.signal).then(
      uses => {
        if (!controller.signal.aborted) {
          setEditor(current =>
            current?.kind === 'delete' && current.item.id === item.id
              ? {...current, uses}
              : current,
          );
        }
      },
      (cause: unknown) => {
        if (controller.signal.aborted) return;
        api.log.write({
          level: 'error',
          message: 'Could not count macro uses',
          detail: String(cause),
        });
        setEditor(current =>
          current?.kind === 'delete' && current.item.id === item.id
            ? {...current, failed: true}
            : current,
        );
      },
    );
  };
  const membership = (
    change: {
      readonly item: Macro;
      readonly collection: MacroCollection['id'];
      readonly member: boolean;
    },
    after?: () => void,
  ): void => {
    const {item, collection, member} = change;
    commit({kind: 'membership', id: item.id, collection, member}, after);
  };
  const menuHandlers = (item: Macro): MacroMenuHandlers => ({
    rename: () => renameAfterMenu(item),
    changeIcon: () => setEditor({kind: 'icon', item}),
    changeColor: () => {
      if (menu?.trigger) setEditor({kind: 'color', item, anchor: menu.trigger});
    },
    toggleStartup: () =>
      commit({
        kind: 'update',
        id: item.id,
        changes: {runOnStartup: item.runOnStartup !== true},
      }),
    addTo: collection => membership({item, collection, member: true}),
    moveTo: collection => {
      const from = currentCollection;
      if (from === undefined) return;
      commit({kind: 'move', id: item.id, from, to: collection});
    },
    newCollection: () => setEditor({kind: 'new-collection', item}),
    addAction: actionKind => setEditor({kind: 'action', item, actionKind}),
    chooseAction: (draft, index) => {
      if (draft.kind === 'message') {
        setEditor({
          kind: 'action',
          item,
          actionKind: draft.kind,
          index,
          initial: draft,
        });
        return;
      }
      const action = prepareMacroAction(draft);
      if (action) {
        commit({
          kind: 'action',
          id: item.id,
          action:
            index === undefined
              ? {kind: 'append', action}
              : {kind: 'replace', index, action, expected: item.actions},
        });
      }
    },
    openAction: action => {
      if (action.kind === 'theme') {
        navigate?.('screens');
      } else if (
        action.kind === 'timer' ||
        action.kind === 'prop' ||
        action.kind === 'message' ||
        action.kind === 'notice' ||
        action.kind === 'audio' ||
        action.kind === 'macro'
      ) {
        useShowToolTab.getState().setTool(action.kind);
      } else if (action.kind === 'audioPlaylist') {
        useShowToolTab.getState().setTool('audio');
      }
    },
    removeAllActions: () =>
      commit({
        kind: 'action',
        id: item.id,
        action: {kind: 'removeAll', expected: item.actions},
      }),
    openPalette: () => palette.show(item.id),
    removeAction: index =>
      commit({
        kind: 'action',
        id: item.id,
        action: {kind: 'remove', index, expected: item.actions},
      }),
    duplicate: () => {
      const copyId = parseMacroId(crypto.randomUUID());
      if (copyId.ok) {
        commit({kind: 'duplicate', id: item.id, copyId: copyId.value});
      }
    },
    remove: () => askDelete(item),
  });
  const askDeleteCollection = (item: MacroCollection): void => {
    revision.current++;
    setCollectionDialog({kind: 'delete', item});
  };
  const selectCollection = (id: MacroCollection['id'] | undefined): void => {
    revision.current++;
    setCollection(id);
  };
  const changeMode = (value: MacroViewMode): void => {
    revision.current++;
    setMode(value);
  };
  const openMenu = (
    item: Macro,
    anchor: MenuAnchor,
    trigger: HTMLElement | undefined,
  ): void => {
    revision.current++;
    setSelected(undefined);
    setMenu({item, anchor, trigger});
  };
  const closeMenu = (): void => setMenu(null);
  const dropAction: MacroPanelModel['dropAction'] = locked
    ? undefined
    : (item, actionKind) => {
        if (item.actions.length >= MACRO_FILE_LIMITS.actions) return;
        revision.current++;
        setEditor({kind: 'action', item, actionKind});
      };
  const choosePaletteAction = (actionKind: MacroActionKind): void => {
    const item = document?.value.macros.find(macro => macro.id === paletteFor);
    if (!locked && item && item.actions.length < MACRO_FILE_LIMITS.actions) {
      revision.current++;
      setEditor({kind: 'action', item, actionKind});
    }
  };
  const saveIcon = (icon: string): void => {
    if (editor?.kind !== 'icon') return;
    commit({kind: 'update', id: editor.item.id, changes: {icon}}, close);
  };
  const saveColor = (color: Macro['color']): void => {
    if (editor?.kind !== 'color') return;
    commit({kind: 'update', id: editor.item.id, changes: {color}}, close);
  };
  const saveAction = (action: KnownMacroAction): void => {
    if (editor?.kind !== 'action') return;
    commit(
      {
        kind: 'action',
        id: editor.item.id,
        action:
          editor.index === undefined
            ? {kind: 'append', action}
            : {
                kind: 'replace',
                index: editor.index,
                action,
                expected: editor.item.actions,
              },
      },
      close,
    );
  };
  const saveNewCollection = (name: string): void => {
    if (editor?.kind !== 'new-collection') return;

    const id = parseMacroCollectionId(crypto.randomUUID());
    if (!id.ok) return;
    const at = revision.current;
    collectionEdit
      .run({
        kind: 'add',
        collection: {id: id.value, name, macroIds: [editor.item.id]},
        requireMember: editor.item.id,
      })
      .then(
        saved => {
          if (saved && at === revision.current) close();
        },
        (cause: unknown) =>
          window.llp?.log.write({
            level: 'error',
            message: 'Macro collection callback failed',
            detail: String(cause),
          }),
      );
  };
  const deleteCollection = (): void => {
    if (collectionDialog?.kind !== 'delete') return;
    commitCollection({kind: 'delete', id: collectionDialog.item.id}, () => {
      setCollection(current =>
        current === collectionDialog.item.id ? undefined : current,
      );
      closeCollection();
    });
  };
  const deleteMacro = (): void => {
    if (editor?.kind !== 'delete') return;
    commit({kind: 'delete', id: editor.item.id}, close);
  };
  const rename = (name: string): Promise<boolean> => {
    if (editor?.kind !== 'rename') return Promise.resolve(false);
    return run({kind: 'update', id: editor.item.id, changes: {name}}, 'saved');
  };
  return {
    macros,
    collections,
    currentCollection,
    mode,
    selectedId: editor?.item.id ?? menu?.item.id ?? selected,
    menu,
    editor,
    collectionDialog,
    palette,
    locked,
    onProblem,
    newDisabledReason:
      toolMenuReason(locked, busy || collectionEdit.busy) ??
      (macros.length >= MACRO_FILE_LIMITS.macros
        ? limitReason('매크로', MACRO_FILE_LIMITS.macros)
        : undefined),
    create,
    createCollection,
    selectCollection,
    changeMode,
    start,
    openMenu,
    closeMenu,
    askDeleteCollection,
    dropAction,
    choosePaletteAction,
    menuHandlers,
    close,
    closeCollection,
    saveIcon,
    saveColor,
    saveAction,
    saveNewCollection,
    rename,
    deleteCollection,
    deleteMacro,
  };
}
