import {limitReason} from '@core/common/limitReason';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {useMenuHandoff} from '@renderer/ui/useMenuHandoff';
import {useContext, useRef, useState, type RefObject} from 'react';
import {parseMacroCollectionId, parseMacroId} from '@core/schema/ids';
import {freeName} from '@core/common/freeName';
import {
  MACRO_FILE_LIMITS,
  type MacroActionKind,
  type Macro,
  type MacroCollection,
  type KnownMacroAction,
} from '@core/schema/macros';
import {useSettingsDocument} from '@renderer/platform/useSettingsDocument';
import {sendLive} from '@renderer/session/live';
import {WorkspaceNavigation} from '@renderer/platform/WorkspaceNavigation';
import {useShowToolTab} from './state/showToolTab';
import {useMacroPalette} from './state/macroPalette';
import type {MenuAnchor} from '@renderer/ui/Menu';
import type {Notice} from '@renderer/ui/notices';
import type {MacroViewMode} from './MacroView';
import {deleteSelection} from '@renderer/ui/deleteSelection';
import {useUndoKeys} from '@renderer/platform/useUndoKeys';
import {focusHistorySurface} from '@renderer/ui/focusHistorySurface';
import {toolMenuReason} from './toolMenuEntries';
import {useOptimisticCreation} from './useOptimisticCreation';
import type {MacroMenuHandlers} from './macroMenuEntries';
import {macroMenuHandlers, type MacroEditor} from './macroMenuHandlers';
import {useMacroEditor} from './useMacroEditor';
import {useMacroRemovals} from './useMacroRemovals';
import {useMacroLayout} from './useMacroLayout';
import {useMacroWrites} from './useMacroWrites';

export type {MacroEditor} from './macroMenuHandlers';

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
  const layout = useMacroLayout();
  const {collection, mode} = layout;
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
  const [menu, setMenu] = useState<{
    item: Macro;
    anchor: MenuAnchor;
    trigger: HTMLElement | undefined;
  } | null>(null);
  const palette = useMacroPalette();
  const paletteFor = palette.target;
  const writes = useMacroWrites(onProblem);
  const {busy, run, commit, commitCollection} = writes;
  useUndoKeys(root ?? fallbackRoot);
  const locked = busy || document?.access !== 'editable' || !window.llp;
  const currentGroup = collections.find(item => item.id === collection);
  const currentCollection = currentGroup?.id;
  const editorState = useMacroEditor({
    onClose: writes.moved,
    commit,
    commitCollection,
    saveName: (id, name) => run({kind: 'update', id, changes: {name}}, 'saved'),
  });
  const {editor, setEditor, close} = editorState;
  const renameAfterMenu = useMenuHandoff<Macro>(menu !== null, item =>
    setEditor({kind: 'rename', item}),
  );
  const start = (item: Macro): void => {
    writes.moved();
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
    writes.moved();
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
    const saved = writes.runCollection({kind: 'add', collection: item});
    layout.showUnsaved(item.id, writes.heldUntouched(saved));
    collectionCreation.create(item, saved, () =>
      layout.restoreCollection(item.id, collection),
    );
  };
  const focusGrid = (): void => {
    focusHistorySurface(root?.current ?? null);
  };
  const {askDelete, askRemoveActions} = useMacroRemovals({
    macros,
    locked,
    menuOpen: menu !== null,
    closeMenu: () => setMenu(null),
    focusGrid,
    commit: edit => commit(edit),
  });
  const menuHandlers = (item: Macro): MacroMenuHandlers =>
    macroMenuHandlers(item, {
      start,
      rename: renameAfterMenu,
      edit: setEditor,
      trigger: menu?.trigger,
      shown: currentCollection,
      commit: edit => commit(edit),
      removeActions: askRemoveActions,
      remove: askDelete,
      openPalette: id => palette.show(id),
      open: place => {
        if (place.kind === 'screens') navigate?.('screens');
        else useShowToolTab.getState().setTool(place.tool);
      },
    });
  const askDeleteCollection = (item: MacroCollection): void => {
    writes.moved();
    deleteSelection(
      1,
      () => !locked && collections.some(value => value.id === item.id),
      () => {
        focusGrid();
        commitCollection({kind: 'delete', id: item.id}, () =>
          layout.leaveCollection(item.id),
        );
      },
    );
  };
  const selectCollection = (id: MacroCollection['id'] | undefined): void => {
    writes.moved();
    layout.showCollection(id);
  };
  const changeMode = (value: MacroViewMode): void => {
    writes.moved();
    layout.changeMode(value);
  };
  const openMenu = (
    item: Macro,
    anchor: MenuAnchor,
    trigger: HTMLElement | undefined,
  ): void => {
    writes.moved();
    setSelected(item.id);
    setMenu({item, anchor, trigger});
  };
  const closeMenu = (): void => setMenu(null);
  const dropAction: MacroPanelModel['dropAction'] = locked
    ? undefined
    : (item, actionKind) => {
        if (item.actions.length >= MACRO_FILE_LIMITS.actions) return;
        writes.moved();
        setEditor({kind: 'action', item, actionKind});
      };
  const choosePaletteAction = (actionKind: MacroActionKind): void => {
    const item = document?.value.macros.find(macro => macro.id === paletteFor);
    if (!locked && item && item.actions.length < MACRO_FILE_LIMITS.actions) {
      writes.moved();
      setEditor({kind: 'action', item, actionKind});
    }
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
    lockReason: toolMenuReason(locked, busy),
    onProblem,
    newDisabledReason:
      toolMenuReason(locked, busy) ??
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
    saveIcon: editorState.saveIcon,
    saveColor: editorState.saveColor,
    saveAction: editorState.saveAction,
    saveNewCollection: editorState.saveNewCollection,
    rename: editorState.rename,
  };
}
