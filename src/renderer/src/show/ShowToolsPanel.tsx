import type {JSX} from 'react';
import type {SizeClass} from '@renderer/shell/sizeClass';
import {useShowToolTab} from '@renderer/state/showToolTab';
import {Panel, PanelBody, PanelHeader, PanelTabs} from '@renderer/ui/Panel';
import type {Notice} from '@renderer/ui/notices';
import {AVAILABLE_TOOL_TABS} from './showTools';
import {StageTab} from './tools/StageTab';
import {MessageTab} from './tools/MessageTab';
import styles from './ShowToolsPanel.module.css';

/** Shows the 진행 도구 tabs whose panels have working controls. */
export function ShowToolsPanel({
  onProblem,
}: {
  readonly sizeClass: SizeClass;
  readonly onProblem?: ((notice: Notice) => void) | undefined;
}): JSX.Element {
  const tool = useShowToolTab(state => state.tool);
  const setTool = useShowToolTab(state => state.setTool);
  const selected = AVAILABLE_TOOL_TABS.some(tab => tab.value === tool)
    ? tool
    : 'stage';
  return (
    <div className={styles.root}>
      <Panel label="진행 도구" className={styles.panel}>
        <PanelHeader>
          <PanelTabs
            tabs={AVAILABLE_TOOL_TABS}
            value={selected}
            onChange={setTool}
          />
        </PanelHeader>
        <PanelBody variant="flush" tab={selected}>
          {selected === 'stage' ? <StageTab onProblem={onProblem} /> : null}
          {selected === 'message' ? <MessageTab onProblem={onProblem} /> : null}
        </PanelBody>
      </Panel>
    </div>
  );
}
