import {useEffect, useRef, type JSX} from 'react';
import {IconButton} from '@renderer/ui/IconButton';
import styles from './SidebarToggle.module.css';

interface ToggleProps {
  readonly onPress: () => void;
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
      className={styles.collapse}
      onClick={onPress}
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
        onClick={onPress}
      />
    </div>
  );
}
