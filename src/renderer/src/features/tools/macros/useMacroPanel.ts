import {limitReason} from '@core/common/limitReason';
import {useWindowShortcuts} from '@renderer/platform/shortcuts/windowShortcuts';
import {useMenuHandoff} from '@renderer/ui/menus/useMenuHandoff';
import {useContext, useRef, useState, type RefObject} from 'react';
import {
  MACRO_FILE_LIMITS,
  type MacroActionKind,
  type Macro,
  type MacroCollection,
  type KnownMacroAction,
} from '@core/schema/tools/macros';
import {useSettingsDocument} from '@renderer/platform/documents/useSettingsDocument';
import {sendLive} from '@renderer/session/live';
import {WorkspaceNavigation} from '@renderer/platform/WorkspaceNavigation';
import {useShowToolTab} from '../showToolTab';
import {useMacroPalette} from './actions/useMacroPalette';
import type {Notice} from '@renderer/ui/popups/notices';
import type {MacroViewMode} from './MacroView';
import {deleteSelection} from '@renderer/ui/lists/selection/deleteSelection';
import {useUndoKeys} from '@renderer/platform/undo/useUndoKeys';
import {focusHistorySurface} from '@renderer/ui/lists/selection/focusHistorySurface';
import {toolMenuReason} from '../toolMenuEntries';
import {useOptimisticCreation} from './useOptimisticCreation';
import {
  newCollection,
  newMacro,
  withCreatingMacros,
  type CreatingMacro,
} from './newMacros';
import type {MacroMenuHandlers} from './menu/macroMenuEntries';
import {macroMenuHandlers, type MacroEditor} from './menu/macroMenuHandlers';
import {useMacroEditor} from './editor/useMacroEditor';
import {useMacroRemovals} from './useMacroRemovals';
import {useMacroLayout} from './useMacroLayout';
import {useMacroWrites} from './useMacroWrites';
import type {MenuAnchor} from '@renderer/ui/menus/menuModel';

/** The context menu of one 매크로, and the button that opened it, if any. */
interface MacroMenu {
  readonly item: Macro;
  readonly anchor: MenuAnchor;
  readonly trigger: HTMLElement | undefined;
}

/**
 * What the 매크로 panel shows and does: the macros and 모음 with the ones being
 * made already in place, the selection, the menu and editor that are open, and
 * every action, each saved against the file revision it was made on.
 */
export interface MacroPanelModel {
  readonly macros: readonly Macro[];
  readonly collections: readonly MacroCollection[];
  readonly currentCollection: MacroCollection['id'] | undefined;
  readonly mode: MacroViewMode;
  readonly selectedId: Macro['id'] | undefined;
  readonly menu: MacroMenu | null;
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

/**
 * The model of the 매크로 panel ({@link MacroPanelModel}). `root` is the
 * panel's surface, where 실행 취소 keys work and focus returns after a delete.
 */
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
  const macroCreation = useOptimisticCreation<CreatingMacro>(
    document?.value.macros ?? [],
  );
  const collectionCreation = useOptimisticCreation(
    document?.value.collections ?? [],
  );
  const macros = macroCreation.items;
  const collections = withCreatingMacros(
    collectionCreation.items,
    macroCreation.pending,
  );
  const [menu, setMenu] = useState<MacroMenu | null>(null);
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
    const item = newMacro(
      crypto.randomUUID(),
      new Set(macros.map(macro => macro.name)),
    );
    if (item === null) return;
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
    const item = newCollection(
      crypto.randomUUID(),
      new Set(collections.map(group => group.name)),
    );
    if (locked || item === null) return;
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
  /** Opens the editor of a new action of `actionKind` in `item`, below the cap. */
  const editNewAction = (item: Macro, actionKind: MacroActionKind): void => {
    if (locked || item.actions.length >= MACRO_FILE_LIMITS.actions) return;
    writes.moved();
    setEditor({kind: 'action', item, actionKind});
  };
  const dropAction: MacroPanelModel['dropAction'] = locked
    ? undefined
    : editNewAction;
  const choosePaletteAction = (actionKind: MacroActionKind): void => {
    const item = document?.value.macros.find(macro => macro.id === paletteFor);
    if (item !== undefined) editNewAction(item, actionKind);
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
