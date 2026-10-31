import {
  createContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import {classNames} from './classNames';
import {clickFocusProps} from './clickFocus';
import {hasModifier} from './modifierKeys';
import type {Workspace} from './workspace';
import styles from './ListRow.module.css';

const ANY_OPTION = '[role="option"]';
const OPTION = '[role="option"]:not([aria-disabled="true"])';
const ACTIVATION_KEYS: ReadonlySet<string> = new Set([' ', 'Enter']);

/** Activation keys shared by list rows in each workspace. */
export const workspaceActivationKeys: Readonly<
  Record<Workspace, ReadonlySet<string>>
> = {
  show: new Set(['Enter']),
  prep: ACTIVATION_KEYS,
};

interface SelectionStore {
  readonly get: () => string | undefined;
  readonly set: (value: string | undefined) => void;
  readonly subscribe: (listener: () => void) => () => void;
}

// NOTE(0913vision): Each row reads only whether it is the selected one, so a
// selection change redraws the old and the new selected row and no other.
function createSelectionStore(initial: string | undefined): SelectionStore {
  let selected = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => selected,
    set: value => {
      if (value === selected) return;
      selected = value;
      for (const listener of listeners) listener();
    },
    subscribe: listener => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** Shared cursor, selection callback, and workspace for one list. */
export interface ListBoxState {
  readonly selection: SelectionStore;
  readonly onSelect: (value: string) => void;
  readonly workspace: Workspace;
}

/** The list state read by rows without rerendering unrelated selections. */
export const ListBoxContext = createContext<ListBoxState>({
  selection: createSelectionStore(undefined),
  onSelect: () => undefined,
  workspace: 'prep',
});

const listKeyTargets: Readonly<
  Record<
    string,
    (options: HTMLElement[], index: number) => HTMLElement | undefined
  >
> = {
  ArrowDown: (options, index) =>
    options[Math.min(index + 1, options.length - 1)],
  ArrowUp: (options, index) => options[Math.max(index - 1, 0)],
  Home: options => options[0],
  End: options => options.at(-1),
};

function enabledOptions(list: HTMLElement): HTMLElement[] {
  return [...list.querySelectorAll<HTMLElement>(OPTION)];
}

// NOTE(0913vision): Tab enters the list once, on the selected row or the
// first row, and Shift Tab leaves it; the list itself never takes focus.
function keepOneTabStop(list: HTMLElement, selected: string | undefined): void {
  const enabled = enabledOptions(list);
  const stop =
    enabled.find(option => option.dataset['value'] === selected) ?? enabled[0];
  for (const option of list.querySelectorAll<HTMLElement>(ANY_OPTION)) {
    option.tabIndex = option === stop ? 0 : -1;
  }
}

function useListBoxState(
  selected: string | undefined,
  onSelect: (value: string) => void,
  workspace: Workspace,
): ListBoxState {
  const [selection] = useState(() => createSelectionStore(selected));
  const latestOnSelect = useRef(onSelect);
  useLayoutEffect(() => {
    latestOnSelect.current = onSelect;
    selection.set(selected);
  });
  return useMemo(
    () => ({
      selection,
      onSelect: (value: string) => latestOnSelect.current(value),
      workspace,
    }),
    [selection, workspace],
  );
}

function useOneTabStop(
  list: RefObject<HTMLDivElement | null>,
  selection: SelectionStore,
): void {
  useLayoutEffect(() => {
    const element = list.current;
    if (element === null) return;
    const update = (): void => keepOneTabStop(element, selection.get());
    update();
    const observer = new MutationObserver(update);
    observer.observe(element, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-disabled', 'data-value'],
    });
    const unsubscribe = selection.subscribe(update);
    return () => {
      observer.disconnect();
      unsubscribe();
    };
  }, [list, selection]);
}

/** Controlled selection and contents of a single-cursor list box. */
export interface ListBoxProps {
  readonly multiple?: boolean;
  /** The list name for assistive technology, such as 예배 순서. */
  readonly label: string;
  readonly selected: string | undefined;
  readonly onSelect: (value: string) => void;
  /** The pick list in a dialog: 8px padding and rounded rows. */
  readonly inset?: boolean | undefined;
  /**
   * `show` for the 예배 순서 list of 진행, where Space goes on to 다음 슬라이드 and
   * only Enter selects; `prep` (the default) everywhere else, dialogs included.
   * 진행 keeps keyboard focus without drawing a row focus outline.
   */
  readonly workspace?: Workspace | undefined;
  readonly className?: string | undefined;
  readonly children: ReactNode;
}

/**
 * A list that selects one row. Tab enters it once, on the selected row; the
 * up and down arrows, Home, and End move and select at once, skipping passive
 * group headers and disabled rows. Keys with Ctrl, Alt, Shift, or the Windows key
 * pass on to the window.
 */
export function ListBox({
  multiple = false,
  label,
  selected,
  onSelect,
  inset = false,
  workspace = 'prep',
  className,
  children,
}: ListBoxProps): JSX.Element {
  const state = useListBoxState(selected, onSelect, workspace);
  const listRef = useRef<HTMLDivElement>(null);
  useOneTabStop(listRef, state.selection);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const target = listKeyTargets[event.key];
    if (target === undefined || hasModifier(event)) return;
    event.preventDefault();
    const options = enabledOptions(event.currentTarget);
    const current =
      event.target instanceof Element ? event.target.closest(OPTION) : null;
    const index = options.findIndex(option => option === current);
    const next = target(options, index);
    if (next === undefined) return;
    next.focus();
    const value = next.dataset['value'];
    if (value !== undefined) onSelect(value);
  };
  return (
    <ListBoxContext value={state}>
      <div
        {...clickFocusProps}
        ref={listRef}
        role="listbox"
        aria-multiselectable={multiple || undefined}
        data-workspace={workspace}
        aria-label={label}
        className={classNames(styles.list, inset && styles.inset, className)}
        onKeyDown={onKeyDown}
      >
        {children}
      </div>
    </ListBoxContext>
  );
}

/** Reports the activation and navigation keys isolated by row end controls. */
export function isRowKey(key: string): boolean {
  return ACTIVATION_KEYS.has(key) || Object.hasOwn(listKeyTargets, key);
}
