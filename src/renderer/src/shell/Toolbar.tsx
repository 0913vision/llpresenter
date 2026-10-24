import type {JSX} from 'react';
import {Icon, type IconSize} from '@renderer/ui/Icon';
import {sendLive, useOutputs} from '@renderer/state/live';
import {defaultScreens, type ScreenSummary} from './screens';
import type {SizeClass} from './sizeClass';
import styles from './Toolbar.module.css';

export type Workspace = 'show' | 'prep' | 'screens';

interface WorkspaceTab {
  readonly id: Workspace;
  readonly icon: string;
  readonly label: string;
}

const workspaceTabs: readonly WorkspaceTab[] = [
  {id: 'show', icon: 'slides', label: '진행'},
  {id: 'prep', icon: 'edit', label: '준비'},
  {id: 'screens', icon: 'gear', label: '화면 설정'},
];

export interface ToolbarProps {
  readonly sizeClass: SizeClass;
  readonly workspace: Workspace;
  readonly onWorkspace: (workspace: Workspace) => void;
}

interface ButtonLook {
  readonly className: string;
  readonly iconSize: IconSize;
  readonly compact: boolean;
}

function buttonLook(sizeClass: SizeClass): ButtonLook {
  const compact = sizeClass === 'compact';
  return {
    className: compact
      ? `${styles.button} ${styles.compact}`
      : `${styles.button}`,
    iconSize: compact ? 16 : 18,
    compact,
  };
}

function WorkspaceTabs({
  look,
  workspace,
  onWorkspace,
}: {
  readonly look: ButtonLook;
  readonly workspace: Workspace;
  readonly onWorkspace: (workspace: Workspace) => void;
}): JSX.Element {
  return (
    <div className={styles.group} role="tablist" aria-label="작업 공간">
      {workspaceTabs.map(tab => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={tab.id === workspace}
          className={`${look.className} ${styles.tab}`}
          onClick={() => onWorkspace(tab.id)}
        >
          <Icon name={tab.icon} size={look.iconSize} />
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}

function Search(): JSX.Element {
  return (
    <div className={styles.center}>
      <label className={styles.search}>
        <Icon name="search" size={16} />
        <input type="search" placeholder="곡, 가사, 초성" aria-label="검색" />
      </label>
    </div>
  );
}

function OutputToggle({
  look,
  screen,
  on,
}: {
  readonly look: ButtonLook;
  readonly screen: ScreenSummary;
  readonly on: boolean;
}): JSX.Element {
  const action = on ? '끄기' : '켜기';
  return (
    <button
      type="button"
      aria-pressed={on}
      data-state={on ? 'live' : 'off'}
      className={`${look.className} ${styles.output}`}
      title={`${screen.statusLabel} 출력 ${action} (${screen.target})`}
      onClick={() =>
        sendLive({type: 'output.set', screenId: screen.id, on: !on})
      }
    >
      <span className={styles.outputIcon}>
        <Icon name={screen.icon} size={look.iconSize} />
        {on ? <span className={styles.dot} /> : null}
      </span>
      <span>{screen.toolbarLabel}</span>
    </button>
  );
}

/** The toolbar: workspace tabs, search, the Look picker, and output toggles. */
export function Toolbar({
  sizeClass,
  workspace,
  onWorkspace,
}: ToolbarProps): JSX.Element {
  const outputs = useOutputs();
  const look = buttonLook(sizeClass);
  const barClass = look.compact
    ? `${styles.bar} ${styles.barCompact}`
    : styles.bar;

  return (
    <header className={barClass}>
      <WorkspaceTabs
        look={look}
        workspace={workspace}
        onWorkspace={onWorkspace}
      />
      <span className={styles.divider} />
      <button type="button" className={look.className} title="미디어">
        <Icon name="film" size={look.iconSize} />
        {look.compact ? null : <span>미디어</span>}
      </button>
      <Search />
      <button type="button" className={look.className} aria-haspopup="menu">
        <span className={styles.look}>
          <Icon name="layers" size={look.iconSize} />
          <Icon name="down" size={12} className={styles.chevron} />
        </span>
        <span>평상시</span>
      </button>
      <span className={styles.divider} />
      {defaultScreens.map(screen => (
        <OutputToggle
          key={screen.id}
          look={look}
          screen={screen}
          on={outputs[screen.id] === true}
        />
      ))}
    </header>
  );
}
