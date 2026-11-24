import {useCallback, useEffect, useRef, type JSX} from 'react';
import {IconButton} from '@renderer/ui/buttons/IconButton';
import {returnFocus} from '@renderer/ui/keys/returnFocus';
import type {SidebarCollapse} from './useSidebarCollapse';
import styles from './SidebarToggle.module.css';

interface ToggleProps {
  /** Receives the pressed button, so the caller can tell whether it had focus. */
  readonly onPress: (button: HTMLButtonElement, keyboard: boolean) => void;
  /**
   * Called once when the button appears; `true` means the other button left
   * with the keyboard focus, so this one takes it.
   */
  readonly claimFocus: () => boolean;
}

function useClaimedFocus(claimFocus: () => boolean) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (claimFocus()) ref.current?.focus();
  }, [claimFocus]);
  return ref;
}

/** 사이드바 접기 at the right end of the 예배 순서 header. */
export function SidebarCollapseButton({
  onPress,
  claimFocus,
}: ToggleProps): JSX.Element {
  const ref = useClaimedFocus(claimFocus);
  return (
    <IconButton
      ref={ref}
      icon="arrow"
      label="사이드바 접기"
      data-preserve-click-focus
      className={styles.collapse}
      onClick={event => onPress(event.currentTarget, event.detail === 0)}
    />
  );
}

/** The collapsed left column: an edge strip with 사이드바 펼치기. */
export function CollapsedSidebar({
  onPress,
  claimFocus,
}: ToggleProps): JSX.Element {
  const ref = useClaimedFocus(claimFocus);
  return (
    <div className={styles.strip}>
      <IconButton
        ref={ref}
        icon="arrow"
        label="사이드바 펼치기"
        data-preserve-click-focus
        onClick={event => onPress(event.currentTarget, event.detail === 0)}
      />
    </div>
  );
}

/** Folds and unfolds the left column, handing the keyboard focus between its two buttons. */
export interface SidebarToggle {
  readonly claimFocus: () => boolean;
  readonly collapsible: boolean;
  readonly collapsed: boolean;
  readonly toggle: (
    collapsed: boolean,
    button: HTMLButtonElement,
    keyboard: boolean,
  ) => void;
}

// NOTE(0913vision): The button that replaces a pressed sidebar button takes
// the keyboard focus only when the pressed one had it (a key press, not a
// click in 진행); otherwise the focus falls to the body, where the 진행 keys
// work.
/**
 * Folds and unfolds the left column, and puts the focus where the operator's
 * keys still work.
 */
export function useSidebarToggle(
  sidebar: SidebarCollapse | undefined,
): SidebarToggle {
  const pendingFocus = useRef(false);
  const claimFocus = useCallback((): boolean => {
    const pending = pendingFocus.current;
    pendingFocus.current = false;
    return pending;
  }, []);
  const setCollapsed = sidebar?.setCollapsed;
  const toggle = (
    collapsed: boolean,
    button: HTMLButtonElement,
    keyboard: boolean,
  ): void => {
    const focused = document.activeElement === button;
    pendingFocus.current = keyboard && focused;
    if (!keyboard && focused) returnFocus(null);
    setCollapsed?.(collapsed);
  };
  return {
    claimFocus,
    collapsible: setCollapsed !== undefined,
    collapsed: setCollapsed !== undefined && sidebar?.collapsed === true,
    toggle,
  };
}
