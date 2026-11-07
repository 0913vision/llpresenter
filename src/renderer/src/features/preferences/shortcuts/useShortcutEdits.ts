import {useMemo} from 'react';
import type {KeyBinding} from '@core/schema/shortcuts';
import type {ShortcutCommand} from '@core/shortcuts/registry';
import {useSettingsDocument} from '@renderer/platform/useSettingsDocument';
import type {Notice} from '@renderer/ui/notices';
import {NEWER_FILE_REASON} from '../usePreferenceEdits';
import {useQueuedWrites} from '../useQueuedWrites';
import {
  allCommands,
  withBinding,
  withoutShownOverrides,
  withoutOverride,
  type ObjectNames,
  type Overrides,
} from './shortcutsModel';

const TITLE = '단축키';
const NO_OVERRIDES: Overrides = {};
const NO_NAMES: ObjectNames['themes'] = [];
const SAVE_FAILURE: Notice = {
  key: 'preferences:shortcuts-save',
  kind: 'warning',
  icon: 'warning',
  title: '단축키 저장 실패',
  time: '',
};

export interface ShortcutEdits {
  readonly commands: readonly ShortcutCommand[];
  /** The stored keys that differ from the defaults. */
  readonly overrides: Overrides;
  /** Why nothing can change, such as a file of a newer version. */
  readonly lockedReason: string | undefined;
  /** Sets one command to a new key, or to none with null. */
  readonly record: (
    command: ShortcutCommand,
    binding: KeyBinding | null,
  ) => void;
  /** Returns one command to its default. */
  readonly reset: (id: string) => void;
  /** Returns every command to its default. */
  readonly resetAll: () => void;
}

/** Reads the shortcuts and the objects that have their own, and saves changes. */
export function useShortcutEdits(
  onProblem: (notice: Notice) => void,
): ShortcutEdits {
  const document = useSettingsDocument('shortcuts', TITLE, onProblem);
  const themes = useSettingsDocument('themes', '테마', onProblem);
  const props = useSettingsDocument('props', '그래픽', onProblem);
  const macros = useSettingsDocument('macros', '매크로', onProblem);
  const timers = useSettingsDocument('timers', '타이머', onProblem);
  const screens = useSettingsDocument('screens', '화면', onProblem);
  const commands = useMemo(
    () =>
      allCommands({
        themes: themes?.value.themes ?? NO_NAMES,
        props: props?.value.props ?? NO_NAMES,
        macros: macros?.value.macros ?? NO_NAMES,
        timers: timers?.value.timers ?? NO_NAMES,
        screens: screens?.value.screens ?? NO_NAMES,
      }),
    [themes, props, macros, timers, screens],
  );
  const change = useQueuedWrites({
    document,
    send: (base, value) =>
      window.llp === undefined
        ? Promise.reject(new Error('The window has no api'))
        : window.llp.settings.edit({
            type: 'settings.update',
            name: 'shortcuts',
            baseRevision: base.revision,
            value,
          }),
    failure: SAVE_FAILURE,
    onProblem,
  });
  const overrides = document?.value.bindings ?? NO_OVERRIDES;
  return {
    commands,
    overrides,
    lockedReason:
      document?.access === 'readOnly' ? NEWER_FILE_REASON : undefined,
    record: (command, binding) =>
      change(stored => ({
        ...stored,
        bindings: withBinding(stored.bindings, command, binding),
      })),
    reset: id =>
      change(stored => ({
        ...stored,
        bindings: withoutOverride(stored.bindings, id),
      })),
    resetAll: () =>
      change(stored => ({
        ...stored,
        bindings: withoutShownOverrides(stored.bindings, commands),
      })),
  };
}
