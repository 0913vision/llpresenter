import type {JSX} from 'react';
import type {SongId} from '@core/schema/common/ids';
import {sendLive, useOutputs} from '@renderer/session/live';
import {OutputToggle} from '@renderer/ui/buttons/OutputToggle';
import {ToolbarTabs, type ToolbarTab} from '@renderer/ui/buttons/ToolbarTabs';
import {useScreenSummaries} from '@renderer/platform/screens/ScreenSummaries';
import {OutputOverflow} from './OutputOverflow';
import {ThemeMenu} from './ThemeMenu';
import {ToolbarSearch} from './ToolbarSearch';
import type {Notice} from '@renderer/ui/popups/notices';
import styles from './Toolbar.module.css';

import type {WorkspaceTab} from '@renderer/app/useWorkspaceTabs';
import type {SizeClass} from '@core/schema/app/appConfig';

const workspaceTabs: ReadonlyArray<ToolbarTab<WorkspaceTab>> = [
  {value: 'show', icon: 'slides', label: '진행'},
  {value: 'prep', icon: 'edit', label: '준비'},
  {value: 'library', icon: 'song', label: '라이브러리'},
  {value: 'screens', icon: 'layers', label: '테마'},
];

const INLINE_OUTPUT_LIMIT = 3;

export interface ToolbarProps {
  readonly sizeClass: SizeClass;
  readonly workspace: WorkspaceTab;
  readonly onWorkspace: (workspace: WorkspaceTab) => void;
  readonly onProblem?: ((notice: Notice) => void) | undefined;
  readonly onOpenPrepSong?: ((songId: SongId) => void) | undefined;
  readonly focusSearch?: boolean | undefined;
  readonly onSearchFocused?: (() => void) | undefined;
}

function OutputToggles({compact}: {readonly compact: boolean}): JSX.Element {
  const outputs = useOutputs();
  const screens = useScreenSummaries();
  const overflow = screens.slice(INLINE_OUTPUT_LIMIT);
  return (
    <div
      role="group"
      aria-label="화면 출력"
      className={`${styles.group} ${styles.outputs}`}
    >
      {screens.slice(0, INLINE_OUTPUT_LIMIT).map(screen => {
        const on = outputs[screen.id] === true;
        return (
          <OutputToggle
            className={styles.output}
            key={screen.id}
            icon={screen.icon}
            label={screen.toolbarLabel}
            screenName={screen.statusLabel}
            target={screen.target}
            state={on ? 'live' : 'off'}
            compact={compact}
            onToggle={() =>
              sendLive({type: 'output.toggle', screenId: screen.id})
            }
          />
        );
      })}
      {overflow.length > 0 ? (
        <OutputOverflow
          screens={overflow}
          outputs={outputs}
          compact={compact}
        />
      ) : null}
    </div>
  );
}

/** The toolbar: workspace tabs, search, the theme picker, and output toggles. */
export function Toolbar({
  sizeClass,
  workspace,
  onWorkspace,
  onProblem,
  onOpenPrepSong,
  focusSearch,
  onSearchFocused,
}: ToolbarProps): JSX.Element {
  const compact = sizeClass === 'narrow';
  /** 라이브러리 is 준비 with a song open; search there works as in 준비. */
  const frame = workspace === 'library' ? 'prep' : workspace;
  const barClass = compact ? `${styles.bar} ${styles.barCompact}` : styles.bar;

  return (
    <header className={barClass} data-workspace-toolbar>
      <ToolbarTabs
        tabs={workspaceTabs}
        value={workspace}
        onChange={onWorkspace}
        label="화면 전환"
        compact={compact}
        className={styles.group}
        keepPointerFocus
      />
      <ToolbarSearch
        focusSearch={focusSearch}
        onSearchFocused={onSearchFocused}
        key={frame}
        tab={workspace}
        addsToOrder={frame === 'prep'}
        enabled={
          frame === 'show' || (frame === 'prep' && onOpenPrepSong !== undefined)
        }
        onOpenPrepSong={frame === 'prep' ? onOpenPrepSong : undefined}
        onProblem={onProblem}
      />
      <ThemeMenu
        compact={compact}
        onProblem={onProblem}
        onEdit={() => onWorkspace('screens')}
      />
      <span className={styles.divider} />
      <OutputToggles compact={compact} />
    </header>
  );
}
