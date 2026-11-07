import {useLayoutEffect, useRef, type JSX, type ReactNode} from 'react';
import {PreviewFrame, type PreviewScreen} from '@renderer/ui/PreviewFrame';
import {usePreviewRoom} from '@renderer/ui/usePreviewRoom';
import {PREVIEW_ROLES, type PreviewRole} from './songPreviewModel';
import styles from './RolePreview.module.css';

const SCREENS: ReadonlyArray<PreviewScreen<PreviewRole>> = PREVIEW_ROLES.map(
  role => ({
    id: role.value,
    name: role.label,
    status: {kind: 'on'},
  }),
);

/** The height of the rows an item adds under the picture area. */
function extraHeight(anchor: HTMLElement): number {
  let height = 0;
  for (const row of anchor.querySelectorAll('[data-preview-extra]')) {
    height += row.getBoundingClientRect().height;
  }
  return height;
}

/**
 * The 준비 picture of one item as the three screens: the chosen one large, the
 * other two as small tiles, the same rule as 진행 미리보기. A short panel drops
 * the tiles first and tells its header through `onRoom`, which then offers a
 * picker instead.
 */
export function RolePreview({
  big,
  onBigChange,
  renderRole,
  caption,
  onRoom,
  blank = false,
  children,
}: {
  readonly big: PreviewRole;
  readonly onBigChange: (role: PreviewRole) => void;
  readonly renderRole: (role: PreviewRole) => ReactNode;
  readonly caption: (role: PreviewRole) => ReactNode;
  readonly onRoom: (room: boolean) => void;
  /** An empty picture: no tiles and an empty caption. */
  readonly blank?: boolean;
  /** Rows under the picture area; mark each with `data-preview-extra`. */
  readonly children?: ReactNode;
}): JSX.Element {
  const root = useRef<HTMLDivElement>(null);
  const room = usePreviewRoom(root, {
    tiles: SCREENS.length - 1,
    extra: extraHeight,
  });
  useLayoutEffect(() => {
    onRoom(room);
  }, [room, onRoom]);
  return (
    <div
      ref={root}
      className={styles.body}
      data-preview-tiles={room ? 'on' : 'off'}
    >
      <PreviewFrame
        screens={SCREENS}
        big={big}
        sizing="content"
        tiles={room && !blank}
        caption={screen =>
          blank ? <span aria-hidden="true">&nbsp;</span> : caption(screen.id)
        }
        onBigChange={onBigChange}
        renderScreen={screen => renderRole(screen.id)}
      />
      {children}
    </div>
  );
}
