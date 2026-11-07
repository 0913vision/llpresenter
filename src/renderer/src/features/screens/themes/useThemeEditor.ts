import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import type {ScreenId, ThemeId} from '@core/schema/ids';
import {
  editThemeLayout,
  findTheme,
  themeLayout,
  type ThemeTarget,
} from '@core/themes/themeEdits';
import {withStageStandby} from '@core/themes/output';
import {resolveThemeScreen} from '@core/themes/resolve';
import {
  pendingWritesOf,
  type DraftOutcome,
} from '@renderer/platform/pendingWrites';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import type {Notice} from '@renderer/ui/notices';
import {useThemeResources} from './useThemeResources';
import {useThemeWrites} from './useThemeWrites';
import {useThemeSelection} from './useThemeSelection';
import {
  NOTHING_TO_REDO,
  NOTHING_TO_UNDO,
} from '@renderer/platform/problemReasons';
import {useThemeElements} from './useThemeElements';
import {useThemeSaveFlow} from './useThemeSaveFlow';
import type {ThemeLeaveGuard} from './themeLeaveGuard';
export {themeCanvasBounds, type ThemeAddPlacement} from './useThemeElements';
/** One workspace session owns selection and all three panels' queued theme changes. */
export function useThemeEditor(
  active: boolean,
  onProblem: ((notice: Notice) => void) | undefined,
  leaveGuard?: ThemeLeaveGuard,
) {
  const resources = useThemeResources(active, onProblem);
  const writes = useThemeWrites(resources.document, onProblem);
  const {file, reason, edit} = writes;
  const {screens} = resources;

  const [themeId, setThemeId] = useState<ThemeId | null>(null);

  const [screenId, setScreenId] = useState<ScreenId | null>(null);

  const chosen =
    file === null
      ? undefined
      : ((themeId === null ? undefined : findTheme(file, themeId)) ??
        file.themes[0] ??
        file.standby);
  // NOTE(0913vision): The 대기 화면 of an older file may have no 무대 화면
  // layout; the editor shows the built-in one that output draws.
  const theme =
    file !== null && chosen?.id === file.standby.id
      ? withStageStandby(chosen, screens)
      : chosen;

  const screen = screens.find(value => value.id === screenId) ?? screens[0];

  const target: ThemeTarget | undefined =
    theme === undefined || screen === undefined
      ? undefined
      : {theme: theme.id, screen, screens};

  const layout =
    target === undefined || file === null
      ? undefined
      : themeLayout(file, target);

  const visibleElements =
    theme === undefined || screen === undefined
      ? []
      : resolveThemeScreen(theme, screen.id, screens).layout.elements;

  const scope =
    theme === undefined || screen === undefined
      ? ''
      : `${theme.id}:${screen.id}`;

  const elementReason =
    reason ??
    (layout?.mode.kind !== 'own'
      ? '직접 배치에서만 바꿀 수 있습니다'
      : undefined);
  const selection = useThemeSelection(scope, visibleElements);
  const actions = useThemeElements({target, elementReason}, writes, selection);
  const {select} = selection;
  const flow = useThemeSaveFlow({
    dirtyThemeId: writes.dirtyThemeId,
    hasDraft: writes.hasDraft,
    save: writes.save,
    discard: writes.discard,
    reportError: writes.reportError,
  });
  const askLeave = useRef(flow.askLeave);
  useLayoutEffect(() => {
    askLeave.current = flow.askLeave;
  });
  useEffect(
    () => leaveGuard?.attach(proceed => askLeave.current(proceed)),
    [leaveGuard],
  );
  const reportError = useRef(writes.reportError);
  useLayoutEffect(() => {
    reportError.current = writes.reportError;
  });
  const api = window.llp;
  useEffect(
    () =>
      api === undefined
        ? undefined
        : pendingWritesOf(api).addDraft(
            () =>
              new Promise<DraftOutcome>(resolve => {
                askLeave.current(
                  () => resolve('settled'),
                  () => resolve('canceled'),
                );
              }),
            error => reportError.current(error),
          ),
    [api],
  );
  useWindowShortcuts([
    {id: 'theme.save', when: () => active, run: flow.askOverwrite},
    {id: 'theme.saveAs', when: () => active, run: flow.askSaveAs},
    {
      id: 'edit.undo',
      when: () => active,
      unavailable: () => (writes.canUndo() ? undefined : NOTHING_TO_UNDO),
      run: writes.undo,
    },
    {
      id: 'edit.redo',
      when: () => active,
      unavailable: () => (writes.canRedo() ? undefined : NOTHING_TO_REDO),
      run: writes.redo,
    },
  ]);
  const choose = (id: ThemeId): void => {
    setThemeId(id);
    select(null);
  };
  return {
    ...resources,
    ...writes,
    ...selection,
    ...actions,
    theme,
    screen,
    target,
    layout,
    visibleElements,
    elementReason,
    dialog: flow.dialog,
    saving: flow.saving,
    askOverwrite: flow.askOverwrite,
    askSaveAs: flow.askSaveAs,
    closeDialog: flow.close,
    confirmOverwrite: flow.overwrite,
    saveAndLeave: flow.saveAndLeave,
    discardAndLeave: flow.discardAndLeave,
    chooseSaved: choose,
    chooseTheme: (id: ThemeId) => {
      if (writes.dirtyThemeId === null || writes.dirtyThemeId === id) {
        choose(id);
      } else flow.askLeave(() => choose(id));
    },
    chooseScreen: (id: ScreenId) => {
      setScreenId(id);
      select(null);
    },
    layoutChange: (transform: Parameters<typeof editThemeLayout>[2]) => {
      if (target !== undefined) {
        edit(target.theme, value => editThemeLayout(value, target, transform));
      }
    },
  };
}
export type ThemeModel = ReturnType<typeof useThemeEditor>;
