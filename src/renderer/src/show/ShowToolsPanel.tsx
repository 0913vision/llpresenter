import {useState, type JSX} from 'react';
import type {SizeClass} from '@renderer/shell/sizeClass';
import {useShowToolTab} from '@renderer/state/showToolTab';
import {Icon} from '@renderer/ui/Icon';
import {Menu} from '@renderer/ui/Menu';
import {openOnArrowDown} from '@renderer/ui/menuButton';
import {Panel, PanelBody, PanelHeader, PanelTabs} from '@renderer/ui/Panel';
import {
  showToolGroups,
  showToolLabel,
  type ShowTool,
  type ShowToolEntry,
} from './showTools';
import styles from './ShowToolsPanel.module.css';

const CHEVRON_SIZE = 12;
const MORE_LABEL = '더 보기';

function MoreTools({
  tools,
  value,
  onChange,
}: {
  readonly tools: readonly ShowToolEntry[];
  readonly value: ShowTool;
  readonly onChange: (tool: ShowTool) => void;
}): JSX.Element {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const expanded = anchor !== null;
  const active = tools.some(tool => tool.value === value);
  const setExpanded = (next: boolean, button: HTMLButtonElement): void => {
    setAnchor(next ? button : null);
  };
  return (
    <>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={expanded}
        data-active={active || undefined}
        className={styles.more}
        onClick={event => setExpanded(!expanded, event.currentTarget)}
        onKeyDown={event =>
          openOnArrowDown(event, {
            expanded,
            onExpandedChange: next => setExpanded(next, event.currentTarget),
          })
        }
      >
        {MORE_LABEL}
        <Icon name="down" size={CHEVRON_SIZE} className={styles.chevron} />
      </button>
      {anchor ? (
        <Menu
          label={MORE_LABEL}
          anchor={{kind: 'element', element: anchor}}
          onClose={() => setAnchor(null)}
          entries={tools.map(tool => ({
            kind: 'item',
            id: tool.value,
            label: tool.label,
            check: 'radio',
            checked: tool.value === value,
            onSelect: () => onChange(tool.value),
          }))}
        />
      ) : null}
    </>
  );
}

/**
 * The 진행 도구 panel frame: the tabs for the size class, the 더 보기 menu in
 * a narrow window, and the tab panel of the chosen tool.
 */
export function ShowToolsPanel({
  sizeClass,
}: {
  readonly sizeClass: SizeClass;
}): JSX.Element {
  const tool = useShowToolTab(state => state.tool);
  const setTool = useShowToolTab(state => state.setTool);
  const {tabs, more} = showToolGroups(sizeClass);
  // TODO(0913vision): Mount the tools role's content in the tab panel.
  return (
    <Panel label="진행 도구" className={styles.panel}>
      <PanelHeader>
        <PanelTabs tabs={tabs} value={tool} onChange={setTool} />
        {more.length > 0 ? (
          <MoreTools tools={more} value={tool} onChange={setTool} />
        ) : null}
      </PanelHeader>
      <PanelBody variant="flush">
        <div role="tabpanel" aria-label={showToolLabel(tool)} />
      </PanelBody>
    </Panel>
  );
}
