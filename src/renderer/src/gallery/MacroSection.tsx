import {useState, type JSX} from 'react';
import type {MacroColor} from '@core/labels/colors';
import {
  MacroGrid,
  MacroList,
  MacroRow,
  MacroTile,
  type MacroSchedule,
} from '../ui/MacroTile';
import {Panel, PanelBody, PanelHeader, PanelTabs} from '../ui/Panel';
import {ignore, Section, SpecGroup, SpecItem, type SpecPin} from './Spec';

const GRID_PANEL_WIDTH = 480;
const LIST_PANEL_WIDTH = 416;
const STATE_CELL_WIDTH = 84;
const AT_TEN_THIRTY: MacroSchedule = {kind: 'time', time: '10:30'};

interface Macro {
  readonly name: string;
  readonly icon: string;
  readonly color: MacroColor;
  readonly actionCount: number;
  readonly schedule?: MacroSchedule;
}

const macros: readonly Macro[] = [
  {
    name: '예배 시작',
    icon: 'sun',
    color: 'green',
    actionCount: 4,
    schedule: AT_TEN_THIRTY,
  },
  {name: '찬양', icon: 'song', color: 'teal', actionCount: 2},
  {name: '말씀', icon: 'mic', color: 'slate', actionCount: 3},
  {name: '광고', icon: 'notice', color: 'yellow', actionCount: 2},
  {name: '헌금', icon: 'coins', color: 'orange', actionCount: 2},
  {name: '영상', icon: 'film', color: 'rose', actionCount: 2},
  {name: '축도', icon: 'pray', color: 'violet', actionCount: 1},
  {name: '예배 끝', icon: 'stop', color: 'gray', actionCount: 3},
];

const LAST_RUN = 1;
const SELECTED = 2;
const LIST_LENGTH = 6;

const toolTabs = [
  {value: 'showing', label: '표시 중', count: 3},
  {value: 'audio', label: '오디오'},
  {value: 'stage', label: '무대'},
  {value: 'timer', label: '타이머'},
  {value: 'message', label: '메시지'},
  {value: 'notice', label: '공지'},
  {value: 'prop', label: '소품'},
  {value: 'macro', label: '매크로'},
];

const speech = macros[SELECTED] ?? {
  name: '말씀',
  icon: 'mic',
  color: 'slate',
  actionCount: 3,
};

interface TileState {
  readonly label: string;
  readonly macro: Macro;
  readonly lastRun?: boolean;
  readonly selected?: boolean;
  readonly pin?: SpecPin;
}

const tileStates: readonly TileState[] = [
  {label: 'Default', macro: speech},
  {label: 'Hover', macro: speech, pin: 'hover'},
  {
    label: 'Last run',
    macro: macros[LAST_RUN] ?? speech,
    lastRun: true,
  },
  {label: 'Selected', macro: speech, selected: true},
  {label: 'Focus', macro: macros[3] ?? speech, pin: 'focus'},
  {label: 'Scheduled', macro: macros[0] ?? speech},
  {
    label: 'Up to 2 lines',
    macro: {
      name: '설교 전 광고 영상과 헌금 안내',
      icon: 'film',
      color: 'rose',
      actionCount: 2,
    },
  },
];

function OneTile({state}: {readonly state: TileState}): JSX.Element {
  return (
    <MacroGrid
      label={state.label}
      selected={state.selected === true ? 0 : undefined}
      onRun={ignore}
      onMenu={ignore}
    >
      <MacroTile
        {...state.macro}
        lastRun={state.lastRun}
        selected={state.selected}
      />
    </MacroGrid>
  );
}

function TryGrid(): JSX.Element {
  const [lastRun, setLastRun] = useState(LAST_RUN);
  const [selected, setSelected] = useState<number | undefined>(SELECTED);
  return (
    <Panel label="매크로">
      <PanelHeader>
        <PanelTabs tabs={toolTabs} value="macro" onChange={ignore} />
      </PanelHeader>
      <PanelBody>
        <MacroGrid
          label="매크로"
          selected={selected}
          onRun={setLastRun}
          onMenu={index => setSelected(index)}
          onNew={ignore}
        >
          {macros.map((macro, index) => (
            <MacroTile
              key={macro.name}
              {...macro}
              lastRun={index === lastRun}
              selected={index === selected}
            />
          ))}
        </MacroGrid>
      </PanelBody>
    </Panel>
  );
}

function TryList(): JSX.Element {
  const [lastRun, setLastRun] = useState(LAST_RUN);
  return (
    <Panel label="매크로 목록">
      <PanelHeader>
        <PanelTabs
          tabs={[{value: 'macro', label: '매크로'}]}
          value="macro"
          onChange={ignore}
        />
      </PanelHeader>
      <PanelBody variant="list">
        <MacroList
          label="매크로"
          selected={SELECTED}
          onRun={setLastRun}
          onMenu={ignore}
        >
          {macros.slice(0, LIST_LENGTH).map((macro, index) => (
            <MacroRow
              key={macro.name}
              {...macro}
              lastRun={index === lastRun}
              selected={index === SELECTED}
            />
          ))}
        </MacroList>
      </PanelBody>
    </Panel>
  );
}

export function MacroSection(): JSX.Element {
  return (
    <Section title="MacroTile">
      <SpecGroup
        title="Grid view, tile 64, gap 16 vertical, 8 or more horizontal"
        alignTop
      >
        <SpecItem
          label="Try a click (runs), a right-click (selects)"
          width={GRID_PANEL_WIDTH}
        >
          <TryGrid />
        </SpecItem>
        <SpecItem
          label="List view, row 30, color cell 20"
          width={LIST_PANEL_WIDTH}
        >
          <TryList />
        </SpecItem>
      </SpecGroup>
      <SpecGroup title="Tile states" surface="panel" alignTop>
        {tileStates.map(state => (
          <SpecItem
            key={state.label}
            label={state.label}
            pin={state.pin}
            width={STATE_CELL_WIDTH}
          >
            <OneTile state={state} />
          </SpecItem>
        ))}
        <SpecItem label="New macro" width={STATE_CELL_WIDTH}>
          <MacroGrid
            label="새 매크로"
            selected={undefined}
            onRun={ignore}
            onMenu={ignore}
            onNew={ignore}
          >
            {null}
          </MacroGrid>
        </SpecItem>
        <SpecItem label="New, hover" pin="hover" width={STATE_CELL_WIDTH}>
          <MacroGrid
            label="새 매크로"
            selected={undefined}
            onRun={ignore}
            onMenu={ignore}
            onNew={ignore}
          >
            {null}
          </MacroGrid>
        </SpecItem>
      </SpecGroup>
    </Section>
  );
}
