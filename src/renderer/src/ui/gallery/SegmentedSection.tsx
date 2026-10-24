import type {JSX} from 'react';
import {SegmentedControl, type SegmentOption} from '../SegmentedControl';
import {
  ignore,
  Section,
  SpecGroup,
  SpecItem,
  Stateful,
  type SpecPin,
} from './Spec';

type Arrangement = 'base' | 'sunday' | 'short';
type View = 'grid' | 'list';
type Filter = 'all' | 'changed' | 'conflict';
type Mode = 'full' | 'window' | 'capture' | 'ndi';

const arrangements: ReadonlyArray<SegmentOption<Arrangement>> = [
  {value: 'base', label: '기본'},
  {value: 'sunday', label: '주일용'},
  {value: 'short', label: '짧게'},
];

const views: ReadonlyArray<SegmentOption<View>> = [
  {value: 'grid', icon: 'grid', label: '격자 보기'},
  {value: 'list', icon: 'rows', label: '목록 보기'},
];

const filters: ReadonlyArray<SegmentOption<Filter>> = [
  {value: 'all', label: '전체'},
  {value: 'changed', label: '바꾼 것', count: 3},
  {
    value: 'conflict',
    label: '겹침',
    count: 1,
    warning: true,
    title: '겹치는 단축키 1개',
  },
];

const modes: ReadonlyArray<SegmentOption<Mode>> = [
  {value: 'full', label: '전체 화면'},
  {value: 'window', label: '창'},
  {value: 'capture', label: '캡처용 창'},
  {value: 'ndi', label: 'NDI'},
];

interface ArrangementState {
  readonly label: string;
  readonly pin?: SpecPin;
  readonly pinIndex?: number;
  readonly disabled?: boolean;
}

const arrangementStates: readonly ArrangementState[] = [
  {label: 'Default'},
  {label: 'Hover on 주일용', pin: 'hover', pinIndex: 1},
  {label: 'Pressed', pin: 'pressed', pinIndex: 1},
  {label: 'Focus', pin: 'focus'},
  {label: 'Disabled', disabled: true},
];

const FILL_WIDTH = 400;

export function SegmentedSection(): JSX.Element {
  return (
    <Section title="SegmentedControl">
      <SpecGroup title="Text segments, segment 22, track 26" surface="panel">
        {arrangementStates.map(state => (
          <SpecItem
            key={state.label}
            label={state.label}
            pin={state.pin}
            pinIndex={state.pinIndex}
          >
            <Stateful<Arrangement> initial="base">
              {(value, setValue) => (
                <SegmentedControl
                  label="구성"
                  options={arrangements}
                  value={value}
                  disabled={state.disabled}
                  onChange={setValue}
                />
              )}
            </Stateful>
          </SpecItem>
        ))}
      </SpecGroup>
      <SpecGroup
        title="Icon segments, 22×28, icon 14, segments with counts"
        surface="panel"
      >
        <SpecItem label="Grid view">
          <Stateful<View> initial="grid">
            {(value, setValue) => (
              <SegmentedControl
                label="보기"
                kind="toggle"
                options={views}
                value={value}
                onChange={setValue}
              />
            )}
          </Stateful>
        </SpecItem>
        <SpecItem label="List view">
          <SegmentedControl
            label="보기"
            kind="toggle"
            options={views}
            value="list"
            onChange={ignore}
          />
        </SpecItem>
        <SpecItem label="Hover" pin="hover" pinIndex={1}>
          <SegmentedControl
            label="보기"
            kind="toggle"
            options={views}
            value="grid"
            onChange={ignore}
          />
        </SpecItem>
        <SpecItem label="Counts, 겹침 in warning">
          <Stateful<Filter> initial="all">
            {(value, setValue) => (
              <SegmentedControl
                label="보기"
                options={filters}
                value={value}
                onChange={setValue}
              />
            )}
          </Stateful>
        </SpecItem>
        <SpecItem label="바꾼 것 selected">
          <SegmentedControl
            label="보기"
            options={filters}
            value="changed"
            onChange={ignore}
          />
        </SpecItem>
      </SpecGroup>
      <SpecGroup title="Fill variant and screen tabs" surface="panel">
        <SpecItem label="Fill, 방식" width={FILL_WIDTH}>
          <Stateful<Mode> initial="full">
            {(value, setValue) => (
              <SegmentedControl
                label="방식"
                fill
                options={modes}
                value={value}
                onChange={setValue}
              />
            )}
          </Stateful>
        </SpecItem>
        <SpecItem label="Screen tabs (aria-selected)">
          <Stateful<'main' | 'stage' | 'captions'> initial="main">
            {(value, setValue) => (
              <SegmentedControl
                label="미리 볼 화면"
                kind="tabs"
                options={[
                  {value: 'main', label: '본 화면'},
                  {value: 'stage', label: '무대'},
                  {value: 'captions', label: '방송 자막'},
                ]}
                value={value}
                onChange={setValue}
              />
            )}
          </Stateful>
        </SpecItem>
      </SpecGroup>
    </Section>
  );
}
