import {useState, type JSX} from 'react';
import warmLight from '../../../../../design/system/upload/Media/warm-light.jpg';
import {Panel, PanelBody, PanelHeader, PanelTabs} from '../Panel';
import {PreviewFrame, type PreviewScreen} from '../PreviewFrame';
import {ignore, Section, SpecGroup, SpecItem, type SpecPin} from './Spec';
import styles from './PreviewSection.module.css';

type ScreenName = 'main' | 'stage' | 'broadcast';

const REGULAR_WIDTH = 480;
const NARROW_WIDTH = 360;
const CELL_WIDTH = 168;
const SMALL_ROW_GAP = 10;
const SMALL_ROW_WIDTH = CELL_WIDTH * 2 + SMALL_ROW_GAP;
const LYRICS = '저 천사여 찬송하세\n찬송 성부 성자 성령';

const main: PreviewScreen<ScreenName> = {
  id: 'main',
  name: '본 화면',
  target: {kind: 'display', label: '모니터 2'},
  look: '기본',
  status: {kind: 'on'},
};
const stage: PreviewScreen<ScreenName> = {
  id: 'stage',
  name: '무대 화면',
  target: {kind: 'display', label: '모니터 3'},
  look: '현재와 다음',
  status: {kind: 'on'},
};
const broadcast: PreviewScreen<ScreenName> = {
  id: 'broadcast',
  name: '방송 자막',
  target: {kind: 'ndi', label: 'NDI'},
  look: '하단 자막',
  status: {kind: 'on'},
  chroma: true,
};
const screens = [main, stage, broadcast];

function SampleScreen({
  screen,
}: {
  readonly screen: PreviewScreen<ScreenName>;
}): JSX.Element {
  switch (screen.id) {
    case 'main':
      return (
        <>
          <img className={styles.picture} src={warmLight} alt="" />
          <span className={styles.lyrics}>{LYRICS}</span>
        </>
      );
    case 'stage':
      return (
        <>
          <span className={styles.stage}>
            <span>{LYRICS}</span>
            <span>11:24</span>
          </span>
          <span className={styles.stageBar}>후렴 한 번 더</span>
        </>
      );
    case 'broadcast':
      return <span className={styles.caption}>{LYRICS}</span>;
  }
}

function renderSample(screen: PreviewScreen<ScreenName>): JSX.Element {
  return <SampleScreen screen={screen} />;
}

function TryPreview({
  compact = false,
  initial = 'main',
}: {
  readonly compact?: boolean;
  readonly initial?: ScreenName;
}): JSX.Element {
  const [big, setBig] = useState<ScreenName>(initial);
  return (
    <Panel label="미리보기">
      <PanelHeader>
        <PanelTabs
          tabs={[{value: 'preview', label: '미리보기'}]}
          value="preview"
          onChange={ignore}
        />
      </PanelHeader>
      <PanelBody>
        <PreviewFrame
          screens={screens}
          big={big}
          compact={compact}
          onBigChange={setBig}
          renderScreen={renderSample}
        />
      </PanelBody>
    </Panel>
  );
}

interface CellState {
  readonly label: string;
  readonly screen: PreviewScreen<ScreenName>;
  readonly pin?: SpecPin;
}

const cellStates: readonly CellState[] = [
  {label: 'Hover, 1px line-control', screen: stage, pin: 'hover'},
  {label: 'Focus', screen: broadcast, pin: 'focus'},
  {
    label: 'Off, name text-off, frame line-strong',
    screen: {...broadcast, status: {kind: 'off'}},
  },
  {
    label: 'Monitor missing, warning',
    screen: {
      ...stage,
      status: {
        kind: 'warning',
        reason: '모니터 3 연결 끊김',
        detail: '창으로 표시 중',
      },
    },
  },
];

function OneCell({
  screen,
}: {
  readonly screen: PreviewScreen<ScreenName>;
}): JSX.Element {
  return (
    <PreviewFrame
      screens={[screen]}
      big={screen.id === 'main' ? 'stage' : 'main'}
      onBigChange={ignore}
      renderScreen={renderSample}
    />
  );
}

export function PreviewSection(): JSX.Element {
  return (
    <Section title="PreviewFrame">
      <SpecGroup title="Regular window, right column 480" alignTop>
        <SpecItem label="Try a click on a small preview" width={REGULAR_WIDTH}>
          <TryPreview />
        </SpecItem>
      </SpecGroup>
      <SpecGroup
        title="Narrow window, right column 360, small previews as 64px rows"
        alignTop
      >
        <SpecItem label="Small previews as rows" width={NARROW_WIDTH}>
          <TryPreview compact />
        </SpecItem>
      </SpecGroup>
      <SpecGroup
        title="A click on a small preview swaps places, 무대 화면 large"
        alignTop
      >
        <SpecItem label="무대 화면 large" width={REGULAR_WIDTH}>
          <TryPreview initial="stage" />
        </SpecItem>
      </SpecGroup>
      <SpecGroup title="States" surface="panel" alignTop>
        {cellStates.map(state => (
          <SpecItem
            key={state.label}
            label={state.label}
            pin={state.pin}
            width={SMALL_ROW_WIDTH}
          >
            <OneCell screen={state.screen} />
          </SpecItem>
        ))}
        <SpecItem label="Large preview, output off" width={NARROW_WIDTH}>
          <PreviewFrame
            screens={[{...main, status: {kind: 'off'}}]}
            big="main"
            onBigChange={ignore}
            renderScreen={renderSample}
          />
        </SpecItem>
        <SpecItem
          label="Large preview name row, monitor missing"
          width={NARROW_WIDTH}
        >
          <PreviewFrame
            screens={[
              {
                ...main,
                status: {
                  kind: 'warning',
                  reason: '모니터 2 연결 끊김',
                  detail: '창으로 표시 중',
                },
              },
            ]}
            big="main"
            onBigChange={ignore}
            renderScreen={renderSample}
          />
        </SpecItem>
      </SpecGroup>
    </Section>
  );
}
