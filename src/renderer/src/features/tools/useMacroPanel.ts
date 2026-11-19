import {limitReason} from '@core/common/limitReason';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {useMenuHandoff} from '@renderer/ui/useMenuHandoff';
import {useContext, useEffect, useRef, useState, type RefObject} from 'react';
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
import {deleteSelection} from '@renderer/ui/useSelectionDelete';
import {useToolEditing} from './useToolEditing';
import {useToolDeleteShortcuts} from '@renderer/platform/useToolDeleteShortcuts';
import {focusHistorySurface} from '@renderer/ui/focusHistorySurface';
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
  | {kind: 'rename'; item: Macro};

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
  readonly palette: ReturnType<typeof useMacroPalette.getState>;
  readonly locked: boolean;
  readonly lockReason: string | undefined;
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
  readonly saveIcon: (icon: string) => void;
  readonly saveColor: (color: Macro['color']) => void;
  readonly saveAction: (action: KnownMacroAction) => void;
  readonly saveNewCollection: (name: string) => void;
  readonly rename: (name: string) => Promise<boolean>;
}

/** Keeps subscriptions, pending usage cancellation, optimistic items and save guards together. */
export function useMacroPanel({
  onProblem,
  root,
}: {
  readonly onProblem?: ((notice: Notice) => void) | undefined;
  readonly root?: RefObject<HTMLElement | null> | undefined;
}): MacroPanelModel {
  const fallbackRoot = useRef<HTMLElement>(null);
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
  const touchedView = useRef(false);
  const touchedCollection = useRef(false);
  useEffect(() => {
    let active = true;
    window.llp?.ui
      .get()
      .then(state => {
        if (!active) return;
        if (!touchedView.current && state.macroView !== undefined) {
          setMode(state.macroView);
        }
        if (!touchedCollection.current && state.macroCollection !== undefined) {
          setCollection(state.macroCollection);
        }
      })
      .catch((error: unknown) =>
        console.error('Could not restore macro view', error),
      );
    return () => {
      active = false;
    };
  }, []);
  const [menu, setMenu] = useState<{
    item: Macro;
    anchor: MenuAnchor;
    trigger: HTMLElement | undefined;
  } | null>(null);
  const [editor, setEditor] = useState<MacroEditor | null>(null);
  const renameAfterMenu = useMenuHandoff<Macro>(menu !== null, item =>
    setEditor({kind: 'rename', item}),
  );
  const palette = useMacroPalette();
  const paletteFor = palette.target;
  const revision = useRef(0);
  const editing = useToolEditing({
    api: window.llp,
    write: saveMacroEdit,
    onProblem,
    area: {
      key: 'macros',
      label: '매크로',
      log: 'Could not edit macros',
      history: 'macros',
    },
  });
  const {busy, run} = editing;
  useToolDeleteShortcuts(root ?? fallbackRoot, editing);
  const collectionEdit = useToolEditing({
    api: window.llp,
    write: saveMacroCollectionEdit,
    onProblem,
    area: {
      key: 'macro-collections',
      label: '\ubaa8\uc74c',
      log: 'Could not edit macro collections',
      history: 'macros',
    },
  });
  const locked =
    busy ||
    collectionEdit.busy ||
    document?.access !== 'editable' ||
    !window.llp;
  const currentGroup = collections.find(item => item.id === collection);
  const currentCollection = currentGroup?.id;
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
    touchedCollection.current = true;
    const at = revision.current;
    collectionCreation.create(
      item,
      collectionEdit.run({kind: 'add', collection: item}).then(saved => {
        if (saved && at === revision.current) {
          window.llp?.ui.setRememberedView({macroCollection: item.id});
        }
        return saved;
      }),
      () =>
        setCollection(current => (current === item.id ? collection : current)),
    );
  };
  const focusGrid = (): void => {
    focusHistorySurface(root?.current ?? null);
  };
  const removeMacro = (item: Macro): void =>
    deleteSelection(
      1,
      () => !locked && macros.some(value => value.id === item.id),
      () => {
        focusGrid();
        commit({kind: 'delete', id: item.id});
      },
    );
  const removeAfterMenu = useMenuHandoff<Macro>(menu !== null, removeMacro);
  const askDelete = (item: Macro): void => {
    if (menu) {
      removeAfterMenu(item);
      setMenu(null);
    } else removeMacro(item);
  };
  const removeActions = ({
    item,
    index,
  }: {
    item: Macro;
    index: number | null;
  }): void => {
    deleteSelection(
      index === null
        ? item.actions.length
        : Number(index >= 0 && index < item.actions.length),
      () => !locked && macros.some(value => value.id === item.id),
      () => {
        focusGrid();
        commit({
          kind: 'action',
          id: item.id,
          action:
            index === null
              ? {kind: 'removeAll', expected: item.actions}
              : {kind: 'remove', index, expected: item.actions},
        });
      },
    );
  };
  const removeActionsAfterMenu = useMenuHandoff<{
    item: Macro;
    index: number | null;
  }>(menu !== null, removeActions);
  const askRemoveActions = (item: Macro, index: number | null): void => {
    if (menu) {
      removeActionsAfterMenu({item, index});
      setMenu(null);
    } else removeActions({item, index});
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
    start: () => start(item),
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
        action.kind === 'audio' ||
        action.kind === 'macro'
      ) {
        useShowToolTab.getState().setTool(action.kind);
      } else if (action.kind === 'audioPlaylist') {
        useShowToolTab.getState().setTool('audio');
      }
    },
    removeAllActions: () => askRemoveActions(item, null),
    openPalette: () => palette.show(item.id),
    removeAction: index => askRemoveActions(item, index),
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
    deleteSelection(
      1,
      () => !locked && collections.some(value => value.id === item.id),
      () => {
        focusGrid();
        commitCollection({kind: 'delete', id: item.id}, () => {
          if (collection === item.id) {
            touchedCollection.current = true;
            window.llp?.ui.setRememberedView({macroCollection: null});
          }
          setCollection(current => (current === item.id ? undefined : current));
        });
      },
    );
  };
  const selectCollection = (id: MacroCollection['id'] | undefined): void => {
    revision.current++;
    touchedCollection.current = true;
    setCollection(id);
    window.llp?.ui.setRememberedView({macroCollection: id ?? null});
  };
  const changeMode = (value: MacroViewMode): void => {
    revision.current++;
    touchedView.current = true;
    setMode(value);
    window.llp?.ui.setRememberedView({macroView: value});
  };
  const openMenu = (
    item: Macro,
    anchor: MenuAnchor,
    trigger: HTMLElement | undefined,
  ): void => {
    revision.current++;
    setSelected(item.id);
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
    palette,
    locked,
    lockReason: toolMenuReason(locked, busy || collectionEdit.busy),
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
    saveIcon,
    saveColor,
    saveAction,
    saveNewCollection,
    rename,
  };
}
