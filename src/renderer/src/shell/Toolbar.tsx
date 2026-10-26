import type {JSX} from 'react';
import type {SongId} from '@shared/schema/ids';
import {sendLive, useOutputs} from '@renderer/state/live';
import {
  OutputToggle,
  ToolbarButton,
  ToolbarTabs,
  type ToolbarTab,
} from '@renderer/ui';
import {defaultScreens} from './screens';
import {LookMenu} from './LookMenu';
import {ToolbarSearch} from './ToolbarSearch';
import type {Notice} from '@renderer/ui/notices';
import type {SizeClass} from './sizeClass';
import styles from './Toolbar.module.css';

export type Workspace = 'show' | 'prep' | 'screens';

const workspaceTabs: ReadonlyArray<ToolbarTab<Workspace>> = [
  {value: 'show', icon: 'slides', label: '진행'},
  {value: 'prep', icon: 'edit', label: '준비'},
  {value: 'screens', icon: 'gear', label: '화면 설정'},
];

export interface ToolbarProps {
  readonly sizeClass: SizeClass;
  readonly workspace: Workspace;
  readonly onWorkspace: (workspace: Workspace) => void;
  readonly onProblem?: ((notice: Notice) => void) | undefined;
  readonly onOpenPrepSong?: ((songId: SongId) => void) | undefined;
  readonly mediaOpen?: boolean | undefined;
  readonly onMediaOpenChange?: ((open: boolean) => void) | undefined;
}

function OutputToggles({compact}: {readonly compact: boolean}): JSX.Element {
  const outputs = useOutputs();
  return (
    <div role="group" aria-label="화면 출력" className={styles.group}>
      {defaultScreens.map(screen => {
        const on = outputs[screen.id] === true;
        return (
          <OutputToggle
            key={screen.id}
            icon={screen.icon}
            label={screen.toolbarLabel}
            screenName={screen.statusLabel}
            target={screen.target}
            state={on ? 'live' : 'off'}
            compact={compact}
            onToggle={() =>
              sendLive({type: 'output.set', screenId: screen.id, on: !on})
            }
          />
        );
      })}
    </div>
  );
}

/** The toolbar: workspace tabs, search, the Look picker, and output toggles. */
export function Toolbar({
  sizeClass,
  workspace,
  onWorkspace,
  onProblem,
  onOpenPrepSong,
  mediaOpen = false,
  onMediaOpenChange,
}: ToolbarProps): JSX.Element {
  const compact = sizeClass === 'narrow';
  const barClass = compact ? `${styles.bar} ${styles.barCompact}` : styles.bar;

  return (
    <header className={barClass}>
      <ToolbarTabs
        tabs={workspaceTabs}
        value={workspace}
        onChange={onWorkspace}
        label="작업 공간"
        compact={compact}
        className={styles.group}
      />
      <span className={styles.divider} />
      <ToolbarButton
        icon="film"
        label="미디어"
        title={
          onMediaOpenChange
            ? '미디어'
            : '현재 작업 공간에서는 미디어를 열 수 없음'
        }
        compact={compact}
        iconOnly={compact}
        pressed={mediaOpen}
        onPressedChange={onMediaOpenChange}
        disabled={onMediaOpenChange === undefined}
      />
      <ToolbarSearch
        key={workspace}
        enabled={
          workspace === 'show' ||
          (workspace === 'prep' && onOpenPrepSong !== undefined)
        }
        onOpenPrepSong={workspace === 'prep' ? onOpenPrepSong : undefined}
        onProblem={onProblem}
      />
      <LookMenu compact={compact} onProblem={onProblem} />
      <span className={styles.divider} />
      <OutputToggles compact={compact} />
    </header>
  );
}
