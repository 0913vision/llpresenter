import {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import type {ScreenId, ThemeId} from '@core/schema/common/ids';
import type {ThemeFile, ThemeScreen} from '@core/schema/screens/theme';
import {ownScreenOf, withScreen, themeScreenOf} from '@core/theme';
import {
  pendingWritesOf,
  type DraftOutcome,
} from '@renderer/platform/documents/pendingWrites';
import {
  NOTHING_TO_REDO,
  NOTHING_TO_UNDO,
} from '@renderer/platform/problemReasons';
import {useWindowShortcuts} from '@renderer/platform/shortcuts/windowShortcuts';
import {
  takeThemeRequest,
  useThemeRequest,
} from '@renderer/session/themeRequests';
import type {Notice} from '@renderer/ui/popups/notices';
import {sampleDrawing} from './themeDrawing';
import type {ThemeLeaveGuard} from './saving/themeLeaveGuard';
import {useThemeElements} from './elements/useThemeElements';
import {useThemePlacement} from './elements/useThemePlacement';
import {useThemeResources} from './useThemeResources';
import {useThemeSaveFlow} from './saving/useThemeSaveFlow';
import {useThemeSelection} from './useThemeSelection';
import {useThemeWrites} from './saving/useThemeWrites';

export {
  themeCanvasBounds,
  type ThemeAddPlacement,
} from './elements/useThemeElements';

/** One session of the theme editor, shared by its three panels. */
export function useThemeEditor(
  active: boolean,
  onProblem: ((notice: Notice) => void) | undefined,
  leaveGuard?: ThemeLeaveGuard,
) {
  const resources = useThemeResources(active, onProblem);
  const writes = useThemeWrites(resources.document, onProblem);
  const {list, reason, edit} = writes;
  const {screens} = resources;
  const [themeId, setThemeId] = useState<ThemeId | null>(null);
  const [screenId, setScreenId] = useState<ScreenId | null>(null);

  const theme =
    list?.themes.find(entry => entry.id === themeId) ?? list?.themes[0];
  const screen = screens.find(entry => entry.id === screenId) ?? screens[0];
  const target = useMemo(
    () =>
      theme === undefined || screen === undefined
        ? undefined
        : {theme, screen, screens},
    [theme, screen, screens],
  );
  const own =
    target === undefined
      ? undefined
      : ownScreenOf(target.theme, target.screen, target.screens);
  const layout =
    target === undefined ? null : themeScreenOf(target.theme, target.screen);
  const drawing = useMemo(
    () =>
      target === undefined
        ? null
        : sampleDrawing(target.theme, target.screen, {screens}),
    [target, screens],
  );
  const placement = useThemePlacement(drawing?.drawing ?? null);
  const scope =
    target === undefined ? '' : `${target.theme.id}:${target.screen.id}`;
  const elementReason =
    reason ??
    (own?.mode !== 'own' ? '직접 배치에서만 바꿀 수 있습니다.' : undefined);
  const selection = useThemeSelection(scope, layout?.elements ?? []);
  const actions = useThemeElements(
    {target, layout, placement, elementReason},
    writes,
    selection,
  );
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
  const chooseTheme = (id: ThemeId): void => {
    if (writes.dirtyThemeId === null || writes.dirtyThemeId === id) choose(id);
    else flow.askLeave(() => choose(id));
  };
  const requested = useThemeRequest(view => view.theme);
  const answer = useRef(chooseTheme);
  useLayoutEffect(() => {
    answer.current = chooseTheme;
  });
  useEffect(() => {
    if (!active || list === null || requested === null) return;
    const id = takeThemeRequest();
    if (id !== null) answer.current(id);
  }, [active, list, requested]);
  return {
    ...resources,
    ...writes,
    ...selection,
    ...actions,
    theme,
    screen,
    target,
    own,
    layout,
    drawing,
    placement,
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
    chooseTheme,
    chooseScreen: (id: ScreenId) => {
      setScreenId(id);
      select(null);
    },
    /** Changes the theme itself: its boxes, background and next text. */
    themeChange: (change: (theme: ThemeFile) => ThemeFile | undefined) =>
      theme === undefined ? false : edit(theme.id, change),
    /** Changes what the theme says for the open screen. */
    screenChange: (next: ThemeScreen) => {
      if (target === undefined) return;
      edit(target.theme.id, current =>
        withScreen(current, target.screen, {layout: next, screens}),
      );
    },
  };
}
export type ThemeModel = ReturnType<typeof useThemeEditor>;
