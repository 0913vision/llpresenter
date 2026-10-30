import type {JSX} from 'react';
import {Button} from '../ui/Button';
import {IconButton} from '../ui/IconButton';
import {Icon} from '../ui/Icon';
import {Tooltip} from '../ui/Tooltip';
import {classNames} from '../ui/classNames';
import styles from './PanelSection.module.css';
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
} from '../ui/Panel';
import {SelectMenu} from '../ui/SelectMenu';
import {Slider} from '../ui/Slider';
import {
  ignore,
  Section,
  SpecGroup,
  SpecItem,
  Stateful,
  type SpecPin,
} from './Spec';
import warmLight from '../../../../design/system/upload/Media/warm-light.jpg';

type Tool = 'showing' | 'audio' | 'stage' | 'timer' | 'message';

const tools: ReadonlyArray<PanelTab<Tool>> = [
  {value: 'showing', label: '표시 중', count: 3},
  {value: 'audio', label: '오디오'},
  {value: 'stage', label: '무대'},
  {value: 'timer', label: '타이머'},
  {value: 'message', label: '메시지'},
];

const MINI_BODY_HEIGHT = 12;
const usageStates = [
  {
    label: 'Pending usage',
    text: '예배 순서 …',
    tip: '사용처를 불러오는 중입니다',
    failed: false,
  },
  {
    label: 'Unavailable usage',
    text: '예배 순서 ?',
    tip: '곡 사용처 정보를 확인할 수 없습니다',
    failed: true,
  },
  {
    label: 'Known zero',
    text: '예배 순서 0곳',
    tip: '사용 중인 예배 순서 없음',
    failed: false,
  },
];

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

const narrowTools: ReadonlyArray<PanelTab<Tool>> = [
  {value: 'showing', label: '표시 중'},
  {value: 'stage', label: '무대'},
];

const moreTools: ReadonlyArray<PanelTab<Tool>> = [
  {value: 'audio', label: '오디오'},
  {value: 'timer', label: '타이머'},
  {value: 'message', label: '메시지'},
];

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
        <SpecItem label="Narrow tabs + 더 보기 (try it)" width={320}>
          <Stateful<Tool> initial="message">
            {(tool, setTool) => (
              <Panel label="진행 도구">
                <PanelHeader>
                  <PanelTabs
                    tabs={narrowTools}
                    value={tool}
                    onChange={setTool}
                    more={{label: '더 보기', tabs: moreTools}}
                  />
                </PanelHeader>
                <MiniBody />
              </Panel>
            )}
          </Stateful>
        </SpecItem>
        <SpecItem label="Title + position, dropdown on the right" width={440}>
          <Panel label="슬라이드">
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
          <Panel label="슬라이드">
            <PanelHeader>
              <PanelTitle title="만복의 근원 하나님" meta="슬라이드 9개" />
              <PanelActions>
                <Button icon="edit">라이브러리 곡 편집</Button>
              </PanelActions>
            </PanelHeader>
            <MiniBody />
          </Panel>
        </SpecItem>
      </SpecGroup>
      <SpecGroup title="Workspace heading labels use the panel title scale">
        {['슬라이드', '화면', '배치', '속성'].map(label => (
          <SpecItem key={label} label={label} width={150}>
            <SingleTab label={label} selected />
          </SpecItem>
        ))}
      </SpecGroup>
      <SpecGroup title="Reference count readiness">
        {usageStates.map(state => (
          <SpecItem key={state.label} label={state.label} width={320}>
            <Panel label={state.label}>
              <PanelHeader>
                <PanelTitle title="곡 정보" />
                <PanelMeta>
                  <Tooltip text={state.tip}>
                    <span
                      className={classNames(
                        styles.usage,
                        state.failed && styles.unavailable,
                      )}
                      tabIndex={0}
                    >
                      <Icon
                        name={state.failed ? 'warning' : 'link'}
                        size={14}
                      />
                      {state.text}
                    </span>
                  </Tooltip>
                </PanelMeta>
              </PanelHeader>
              <MiniBody />
            </Panel>
          </SpecItem>
        ))}
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
        <SpecItem label="Thumbnail size only (슬라이드 panel)" width={440}>
          <Panel label="슬라이드">
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
