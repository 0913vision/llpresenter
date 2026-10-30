import type {JSX} from 'react';
import {IconButton} from '../ui/IconButton';
import {
  Panel,
  PanelActions,
  PanelBody,
  PanelHeader,
  PanelTabs,
} from '../ui/Panel';
import {PropertyRow, Properties} from '../ui/PropertyRow';
import {SegmentedControl, type SegmentOption} from '../ui/SegmentedControl';
import styles from './SegmentedSection.module.css';
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
type Audience = 'audience' | 'stage';
type Fit = 'fit' | 'fill' | 'stretch';
type Screen = 'main' | 'stage' | 'captions';

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

const audiences: ReadonlyArray<SegmentOption<Audience>> = [
  {value: 'audience', label: '청중'},
  {value: 'stage', label: '무대'},
];

const fits: ReadonlyArray<SegmentOption<Fit>> = [
  {value: 'fit', label: '맞추기'},
  {value: 'fill', label: '채우기'},
  {value: 'stretch', label: '늘리기'},
];

const screens: ReadonlyArray<SegmentOption<Screen>> = [
  {value: 'main', label: '본 화면'},
  {value: 'stage', label: '무대'},
  {value: 'captions', label: '방송 자막'},
];

function FillRow<T extends string>({
  label,
  options,
  initial,
}: {
  readonly label: string;
  readonly options: ReadonlyArray<SegmentOption<T>>;
  readonly initial: T;
}): JSX.Element {
  return (
    <PropertyRow label={label}>
      {({controlId, labelId}) => (
        <Stateful<T> initial={initial}>
          {(value, setValue) => (
            <SegmentedControl
              id={controlId}
              labelledBy={labelId}
              fill
              options={options}
              value={value}
              onChange={setValue}
            />
          )}
        </Stateful>
      )}
    </PropertyRow>
  );
}

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
const HEADER_WIDTH = 420;

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
      <SpecGroup>
        <SpecItem
          label="Fill variant in property fields, equal widths, horizontal 8"
          width={FILL_WIDTH}
        >
          <Panel label="화면">
            <PanelBody>
              <Properties>
                <FillRow label="종류" options={audiences} initial="audience" />
                <FillRow label="방식" options={modes} initial="full" />
                <FillRow label="맞춤" options={fits} initial="fill" />
              </Properties>
            </PanelBody>
          </Panel>
        </SpecItem>
        <SpecItem
          label="In a panel header, screen tabs (aria-selected), 구성 picker (radio)"
          width={HEADER_WIDTH}
        >
          <Panel label="미리보기">
            <PanelHeader>
              <PanelTabs
                tabs={[{value: 'preview', label: '미리보기'}]}
                value="preview"
                onChange={ignore}
              />
              <PanelActions>
                <Stateful<Screen> initial="main">
                  {(value, setValue) => (
                    <SegmentedControl
                      label="미리 볼 화면"
                      kind="tabs"
                      options={screens}
                      value={value}
                      onChange={setValue}
                    />
                  )}
                </Stateful>
              </PanelActions>
            </PanelHeader>
            <div className={styles.arrangementRow}>
              <span className={styles.arrangementName}>구성</span>
              <Stateful<Arrangement> initial="base">
                {(value, setValue) => (
                  <SegmentedControl
                    label="구성"
                    options={arrangements}
                    value={value}
                    onChange={setValue}
                  />
                )}
              </Stateful>
              <IconButton icon="plus" label="구성 추가" />
            </div>
          </Panel>
        </SpecItem>
      </SpecGroup>
    </Section>
  );
}
