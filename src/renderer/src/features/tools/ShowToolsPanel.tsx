import {useState, type JSX} from 'react';
import {useShowToolTab} from '@renderer/features/tools/showToolTab';
import {Panel, PanelBody, PanelHeader} from '@renderer/ui/panels/Panel';
import {ResponsivePanelTabs} from '@renderer/ui/panels/ResponsivePanelTabs';
import {
  PanelActionScope,
  PanelActionTarget,
} from '@renderer/ui/panels/PanelActionSlot';
import type {Notice} from '@renderer/ui/popups/notices';
import {SHOW_TOOLS, showTool} from './showTools';
import {AudioTab} from './audio/AudioTab';
import {StageTab} from './stage/StageTab';
import {MessageTab} from './messages/MessageTab';
import {TimerTab} from './timers/TimerTab';
import {PropTab} from './props/PropTab';
import {MacroTab} from './macros/MacroTab';
import styles from './ShowToolsPanel.module.css';
import type {SizeClass} from '@core/schema/app/appConfig';

/** Shows the 진행 도구 tabs whose panels have working controls. */
export function ShowToolsPanel({
  onProblem,
}: {
  readonly sizeClass: SizeClass;
  readonly onProblem?: ((notice: Notice) => void) | undefined;
}): JSX.Element {
  const tool = useShowToolTab(state => state.tool);
  const setTool = useShowToolTab(state => state.setTool);
  const selectedTab = showTool(tool);
  const selected = selectedTab.value;
  const [actions, setActions] = useState<HTMLElement | null>(null);

  return (
    <div className={styles.root}>
      <Panel label="진행 도구" className={styles.panel}>
        <PanelHeader>
          <ResponsivePanelTabs
            tabs={SHOW_TOOLS}
            value={selected}
            onChange={setTool}
            moreLabel="더 보기"
          />
          <PanelActionTarget onPlace={setActions} />
        </PanelHeader>
        <PanelBody
          variant={selectedTab.scrolls ? 'flush' : 'fixed'}
          tab={selected}
        >
          <PanelActionScope place={actions}>
            {selected === 'audio' ? <AudioTab onProblem={onProblem} /> : null}
            {selected === 'stage' ? <StageTab onProblem={onProblem} /> : null}
            {selected === 'timer' ? <TimerTab onProblem={onProblem} /> : null}
            {selected === 'message' ? (
              <MessageTab onProblem={onProblem} />
            ) : null}
            {selected === 'prop' ? <PropTab onProblem={onProblem} /> : null}
            {selected === 'macro' ? <MacroTab onProblem={onProblem} /> : null}
          </PanelActionScope>
        </PanelBody>
      </Panel>
    </div>
  );
}
