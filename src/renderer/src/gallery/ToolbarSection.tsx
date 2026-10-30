import type {JSX} from 'react';
import {OutputToggle, type OutputState} from '../ui/OutputToggle';
import {ToolbarButton} from '../ui/ToolbarButton';
import {ToolbarTabs, type ToolbarTab} from '../ui/ToolbarTabs';
import {
  ignore,
  Section,
  SpecGroup,
  SpecItem,
  Stateful,
  type SpecPin,
} from './Spec';

type Workspace = 'show' | 'prep' | 'screens';

const showTab: ToolbarTab<Workspace> = {
  value: 'show',
  icon: 'slides',
  label: '진행',
};
const prepTab: ToolbarTab<Workspace> = {
  value: 'prep',
  icon: 'edit',
  label: '준비',
};
const screensTab: ToolbarTab<Workspace> = {
  value: 'screens',
  icon: 'gear',
  label: '화면 설정',
};

function SingleTab({
  tab,
  selected,
  compact = false,
}: {
  readonly tab: ToolbarTab<Workspace>;
  readonly selected: boolean;
  readonly compact?: boolean;
}): JSX.Element {
  return (
    <ToolbarTabs
      label="작업 공간"
      tabs={[tab]}
      value={selected ? tab.value : 'show'}
      compact={compact}
      onChange={ignore}
    />
  );
}

interface OutputSpec {
  readonly label: string;
  readonly name: string;
  readonly screenName: string;
  readonly target: string;
  readonly state: OutputState;
  readonly pin?: SpecPin;
}

const outputs: readonly OutputSpec[] = [
  {
    label: 'On',
    name: '본 화면',
    screenName: '본 화면',
    target: '모니터 2',
    state: 'live',
  },
  {
    label: 'Off',
    name: '본 화면',
    screenName: '본 화면',
    target: '모니터 2',
    state: 'off',
  },
  {
    label: 'No monitor',
    name: '본 화면',
    screenName: '본 화면',
    target: '모니터 2',
    state: 'warning',
  },
  {
    label: 'On + hover',
    name: '무대',
    screenName: '무대 화면',
    target: '모니터 3',
    state: 'live',
    pin: 'hover',
  },
  {
    label: 'Off + hover',
    name: '무대',
    screenName: '무대 화면',
    target: '모니터 3',
    state: 'off',
    pin: 'hover',
  },
  {
    label: 'Focus',
    name: '방송 자막',
    screenName: '방송 자막',
    target: 'NDI',
    state: 'live',
    pin: 'focus',
  },
];

const compactOutputs: readonly OutputSpec[] = [
  {
    label: 'On',
    name: '본 화면',
    screenName: '본 화면',
    target: '모니터 2',
    state: 'live',
  },
  {
    label: 'Off',
    name: '무대',
    screenName: '무대 화면',
    target: '모니터 3',
    state: 'off',
  },
  {
    label: 'No monitor',
    name: '무대',
    screenName: '무대 화면',
    target: '모니터 3',
    state: 'warning',
  },
];

function OutputItem({
  spec,
  icon,
  compact = false,
}: {
  readonly spec: OutputSpec;
  readonly icon: string;
  readonly compact?: boolean;
}): JSX.Element {
  return (
    <SpecItem label={spec.label} pin={spec.pin}>
      <Stateful initial={spec.state}>
        {(state, setState) => (
          <OutputToggle
            icon={icon}
            label={spec.name}
            screenName={spec.screenName}
            target={spec.target}
            state={state}
            compact={compact}
            onToggle={() => setState(state === 'off' ? 'live' : 'off')}
          />
        )}
      </Stateful>
    </SpecItem>
  );
}

function outputIcon(name: string): string {
  return name === '방송 자막' ? 'capture' : 'mplay';
}

export function ToolbarSection(): JSX.Element {
  return (
    <Section title="ToolbarButton">
      <SpecGroup title="Workspace tabs, 64×48, name under icon 18">
        <SpecItem label="Selected">
          <SingleTab tab={showTab} selected />
        </SpecItem>
        <SpecItem label="Default">
          <SingleTab tab={prepTab} selected={false} />
        </SpecItem>
        <SpecItem label="Hover" pin="hover">
          <SingleTab tab={prepTab} selected={false} />
        </SpecItem>
        <SpecItem label="Pressed" pin="pressed">
          <SingleTab tab={prepTab} selected={false} />
        </SpecItem>
        <SpecItem label="Focus" pin="focus">
          <SingleTab tab={screensTab} selected={false} />
        </SpecItem>
        <SpecItem label="All three, try the arrow keys">
          <Stateful<Workspace> initial="show">
            {(value, setValue) => (
              <ToolbarTabs
                label="작업 공간"
                tabs={[showTab, prepTab, screensTab]}
                value={value}
                onChange={setValue}
              />
            )}
          </Stateful>
        </SpecItem>
      </SpecGroup>
      <SpecGroup title="Action buttons, view toggle (미디어), menu opener (Look)">
        <SpecItem label="On">
          <Stateful<boolean> initial>
            {(pressed, setPressed) => (
              <ToolbarButton
                icon="film"
                label="미디어"
                title={pressed ? '미디어 닫기' : '미디어 열기'}
                pressed={pressed}
                onPressedChange={setPressed}
              />
            )}
          </Stateful>
        </SpecItem>
        <SpecItem label="Off">
          <ToolbarButton
            icon="film"
            label="미디어"
            title="미디어 열기"
            pressed={false}
          />
        </SpecItem>
        <SpecItem label="Hover" pin="hover">
          <ToolbarButton icon="film" label="미디어" pressed={false} />
        </SpecItem>
        <SpecItem label="Pressed" pin="pressed">
          <ToolbarButton icon="film" label="미디어" pressed={false} />
        </SpecItem>
        <SpecItem label="Focus" pin="focus">
          <ToolbarButton icon="film" label="미디어" pressed />
        </SpecItem>
        <SpecItem label="Disabled">
          <ToolbarButton icon="film" label="미디어" pressed={false} disabled />
        </SpecItem>
        <SpecItem label="Look, default">
          <ToolbarButton
            icon="layers"
            label="평상시"
            title="Look 고르기"
            menu
          />
        </SpecItem>
        <SpecItem label="Hover" pin="hover">
          <ToolbarButton icon="layers" label="평상시" menu />
        </SpecItem>
        <SpecItem label="Menu open, pressed">
          <ToolbarButton icon="layers" label="평상시" menu expanded />
        </SpecItem>
        <SpecItem label="Focus" pin="focus">
          <ToolbarButton icon="layers" label="평상시" menu />
        </SpecItem>
        <SpecItem label="Disabled">
          <ToolbarButton icon="layers" label="평상시" menu disabled />
        </SpecItem>
      </SpecGroup>
      <SpecGroup title="Screen output: on has a 6px live dot (ring-dot-cut), off a line-strong dot, no monitor a warning icon and dot">
        {outputs.map(spec => (
          <OutputItem
            key={spec.label}
            spec={spec}
            icon={outputIcon(spec.name)}
          />
        ))}
      </SpecGroup>
      <SpecGroup title="Narrow window: workspace buttons 32px, separate media toggle 30px">
        <SpecItem label="Tab selected">
          <SingleTab tab={showTab} selected compact />
        </SpecItem>
        <SpecItem label="Tab hover" pin="hover">
          <SingleTab tab={prepTab} selected={false} compact />
        </SpecItem>
        <SpecItem label="미디어: label stays visible">
          <ToolbarButton
            icon="film"
            label="미디어"
            title="미디어 열기"
            compact
            pressed={false}
          />
        </SpecItem>
        <SpecItem label="Look">
          <ToolbarButton icon="layers" label="평상시" compact menu />
        </SpecItem>
        {compactOutputs.map(spec => (
          <OutputItem key={spec.label} spec={spec} icon="mplay" compact />
        ))}
      </SpecGroup>
    </Section>
  );
}
