import type {JSX} from 'react';
import {Button} from '../Button';
import {IconButton} from '../IconButton';
import {
  Panel,
  PanelActions,
  PanelBody,
  PanelFooter,
  PanelHeader,
  PanelMeta,
  PanelSwitch,
  PanelTabs,
  PanelTitle,
  type PanelTab,
} from '../Panel';
import {SelectMenu} from '../SelectMenu';
import {Slider} from '../Slider';
import {
  ignore,
  Section,
  SpecGroup,
  SpecItem,
  Stateful,
  type SpecPin,
} from './Spec';
import warmLight from '../../../../../design/system/upload/Media/warm-light.jpg';

type Tool = 'showing' | 'audio' | 'stage' | 'timer' | 'message';

const tools: ReadonlyArray<PanelTab<Tool>> = [
  {value: 'showing', label: '표시 중', count: 3},
  {value: 'audio', label: '오디오'},
  {value: 'stage', label: '무대'},
  {value: 'timer', label: '타이머'},
  {value: 'message', label: '메시지'},
];

const MINI_BODY_HEIGHT = 12;

function MiniBody(): JSX.Element {
  return (
    <PanelBody variant="flush">
      <div style={{height: MINI_BODY_HEIGHT}} />
    </PanelBody>
  );
}

function SingleTab({
  label,
  selected,
  disabled = false,
}: {
  readonly label: string;
  readonly selected: boolean;
  readonly disabled?: boolean | undefined;
}): JSX.Element {
  return (
    <Panel label={label}>
      <PanelHeader>
        <PanelTabs
          tabs={[{value: 'only', label, disabled}]}
          value={selected ? 'only' : 'none'}
          onChange={ignore}
        />
      </PanelHeader>
      <MiniBody />
    </Panel>
  );
}

interface TabState {
  readonly label: string;
  readonly selected: boolean;
  readonly pin?: SpecPin;
  readonly disabled?: boolean;
}

const tabStates: readonly TabState[] = [
  {label: 'Selected', selected: true},
  {label: 'Unselected', selected: false},
  {label: 'Hover', selected: false, pin: 'hover'},
  {label: 'Focus', selected: true, pin: 'focus'},
  {label: 'Disabled', selected: false, disabled: true},
];

interface SwitchState {
  readonly label: string;
  readonly expanded?: boolean;
  readonly pin?: SpecPin;
  readonly disabled?: boolean;
}

const switchStates: readonly SwitchState[] = [
  {label: 'Default'},
  {label: 'Hover', pin: 'hover'},
  {label: 'Open, pressed', expanded: true},
  {label: 'Focus', pin: 'focus'},
  {label: 'Disabled', disabled: true},
];

function ServiceHeader({
  state,
  withActions = false,
}: {
  readonly state: SwitchState;
  readonly withActions?: boolean;
}): JSX.Element {
  return (
    <Panel label="예배 순서">
      <PanelHeader>
        <PanelTabs
          tabs={[{value: 'order', label: '예배 순서'}]}
          value="order"
          onChange={ignore}
        />
        <Stateful<boolean> initial={state.expanded ?? false}>
          {(expanded, setExpanded) => (
            <PanelSwitch
              value="주일 예배"
              expanded={expanded}
              disabled={state.disabled}
              onExpandedChange={setExpanded}
            />
          )}
        </Stateful>
        {withActions ? (
          <PanelActions>
            <IconButton icon="plus" label="항목 추가" />
          </PanelActions>
        ) : null}
      </PanelHeader>
      <MiniBody />
    </Panel>
  );
}

export function PanelSection(): JSX.Element {
  return (
    <Section title="Panel">
      <SpecGroup title="Header 34px" alignTop>
        <SpecItem label="Tab + service switcher + controls" width={280}>
          <ServiceHeader state={{label: ''}} withActions />
        </SpecItem>
        <SpecItem label="Tab + count" width={280}>
          <Panel label="라이브러리">
            <PanelHeader>
              <PanelTabs
                tabs={[{value: 'library', label: '라이브러리'}]}
                value="library"
                onChange={ignore}
              />
              <PanelMeta>128</PanelMeta>
              <PanelActions>
                <IconButton icon="plus" label="새 곡" />
              </PanelActions>
            </PanelHeader>
            <MiniBody />
          </Panel>
        </SpecItem>
        <SpecItem label="Several tabs, gap 18" width={320}>
          <Stateful<Tool> initial="showing">
            {(tool, setTool) => (
              <Panel label="진행 도구">
                <PanelHeader>
                  <PanelTabs tabs={tools} value={tool} onChange={setTool} />
                </PanelHeader>
                <MiniBody />
              </Panel>
            )}
          </Stateful>
        </SpecItem>
        <SpecItem label="Title + position, dropdown on the right" width={440}>
          <Panel label="장">
            <PanelHeader>
              <PanelTitle title="만복의 근원 하나님" meta="2 / 9" />
              <PanelActions>
                <Stateful<string> initial="warm">
                  {(value, setValue) => (
                    <SelectMenu
                      size="sm"
                      aria-label="배경 따뜻한 빛"
                      lead={{kind: 'media', src: warmLight}}
                      options={[
                        {value: 'warm', label: '따뜻한 빛'},
                        {value: 'dawn', label: '새벽 하늘'},
                      ]}
                      value={value}
                      onChange={setValue}
                    />
                  )}
                </Stateful>
              </PanelActions>
            </PanelHeader>
            <MiniBody />
          </Panel>
        </SpecItem>
        <SpecItem label="Title + count, sm button on the right" width={440}>
          <Panel label="장">
            <PanelHeader>
              <PanelTitle title="만복의 근원 하나님" meta="9장" />
              <PanelActions>
                <Button icon="edit">라이브러리 곡 편집</Button>
              </PanelActions>
            </PanelHeader>
            <MiniBody />
          </Panel>
        </SpecItem>
      </SpecGroup>
      <SpecGroup title="Tab states">
        {tabStates.map(state => (
          <SpecItem
            key={state.label}
            label={state.label}
            pin={state.pin}
            width={150}
          >
            <SingleTab
              label="미리보기"
              selected={state.selected}
              disabled={state.disabled}
            />
          </SpecItem>
        ))}
      </SpecGroup>
      <SpecGroup title="Service switcher button">
        {switchStates.map(state => (
          <SpecItem
            key={state.label}
            label={state.label}
            pin={state.pin}
            pinIndex={1}
            width={166}
          >
            <ServiceHeader state={state} />
          </SpecItem>
        ))}
      </SpecGroup>
      <SpecGroup title="Footer row 32px">
        <SpecItem label="Count + thumbnail size (media)" width={440}>
          <Panel label="미디어">
            <MiniBody />
            <PanelFooter
              end={
                <Slider
                  label="썸네일 크기"
                  icon="grid"
                  min={1}
                  max={5}
                  value={3}
                  onChange={ignore}
                />
              }
            >
              7개 2.1GB
            </PanelFooter>
          </Panel>
        </SpecItem>
        <SpecItem label="Thumbnail size only (장 panel)" width={440}>
          <Panel label="장">
            <MiniBody />
            <PanelFooter
              end={
                <Slider
                  label="썸네일 크기"
                  icon="grid"
                  min={1}
                  max={5}
                  value={3}
                  onChange={ignore}
                />
              }
            />
          </Panel>
        </SpecItem>
      </SpecGroup>
    </Section>
  );
}
