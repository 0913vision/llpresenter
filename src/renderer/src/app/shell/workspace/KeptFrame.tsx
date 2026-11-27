import {
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type JSX,
  type ReactNode,
  type RefObject,
} from 'react';
import {CommandScope} from '@renderer/ui/keys/commandDispatcher';
import {classNames} from '@renderer/ui/classNames';
import type {Workspace as WorkspaceId} from '@renderer/platform/WorkspaceNavigation';
import styles from './Workspace.module.css';

/** Whether the focus is somewhere the keys can act: not on the page, not in a hidden frame. */
function focusInUse(): boolean {
  const active = document.activeElement;
  return (
    active instanceof HTMLElement &&
    active !== document.body &&
    active.closest('[inert]') === null
  );
}

/**
 * Gives the focus back to where it was in the frame when the frame shows
 * again, as a browser tab does, so the keys act there at once after a switch
 * by the mouse, whose tab buttons leave the focus where it was. A focus in use
 * elsewhere, such as the search field, stays.
 */
function useFocusMemory(visible: boolean): {
  readonly frame: RefObject<HTMLDivElement | null>;
  readonly onFocus: (event: FocusEvent<HTMLDivElement>) => void;
} {
  const frame = useRef<HTMLDivElement | null>(null);
  const last = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const element = last.current;
    if (
      !visible ||
      element === null ||
      !element.isConnected ||
      frame.current?.contains(element) !== true ||
      focusInUse()
    ) {
      return;
    }
    element.focus({preventScroll: true});
  }, [visible]);
  return {
    frame,
    onFocus: event => {
      if (event.target instanceof HTMLElement) last.current = event.target;
    },
  };
}

/**
 * A workspace's frame that stays built while another workspace shows: hidden,
 * out of the focus order, and with its commands' keys off, so going back
 * shows it in the next frame instead of building it again, with the focus
 * where it was. Every workspace has one, built once: a switch never builds a
 * view again nor shows another one on the way (USER Nov 21, Nov 27).
 */
export function KeptFrame({
  workspace,
  visible,
  children,
}: {
  readonly workspace: WorkspaceId;
  readonly visible: boolean;
  readonly children: ReactNode;
}): JSX.Element {
  // NOTE(0913vision): A hidden frame keeps the content it last showed, the
  // same elements, so React leaves it alone on a switch and only the frame
  // coming up is drawn again; what its parts follow on their own still
  // reaches them.
  const [kept, setKept] = useState(children);
  if (visible && kept !== children) setKept(children);
  const {frame, onFocus} = useFocusMemory(visible);
  return (
    <div
      ref={frame}
      className={classNames(styles.frameSlot, !visible && styles.hiddenFrame)}
      data-workspace-frame={workspace}
      inert={!visible}
      aria-hidden={!visible}
      onFocus={onFocus}
    >
      <CommandScope value={visible ? 'visible' : 'hidden'}>
        {visible ? children : kept}
      </CommandScope>
    </div>
  );
}
