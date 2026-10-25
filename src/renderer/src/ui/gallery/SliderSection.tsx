import type {JSX} from 'react';
import {Slider, type SliderProps} from '../Slider';
import {ThumbnailSizeControl} from '../ThumbnailSizeControl';
import {SlideThumbnail, ThumbnailGrid} from '../SlideThumbnail';
import {
  DEFAULT_THUMBNAIL_SCALE_PERCENT,
  thumbnailWidth,
} from '../thumbnailSize';
import {ignore, Section, SpecGroup, SpecItem, Stateful} from './Spec';
import styles from './SliderSection.module.css';

function percentText(value: number): string {
  return `${value}%`;
}

const THUMBNAIL = {label: '썸네일 크기', min: 1, max: 5} as const;
const VOLUME = {
  label: '음량',
  min: 0,
  max: 100,
  formatValue: percentText,
} as const;
const BLOCK_WIDTH = 360;
const SCALE_EXAMPLE_WIDTH = 440;
const SCALE_EXAMPLE_COLUMNS = 3;
const SCALE_EXAMPLE_GAP = 12;

function ScaleExample(): JSX.Element {
  return (
    <Stateful initial={DEFAULT_THUMBNAIL_SCALE_PERCENT}>
      {(value, setValue) => (
        <div className={styles.example}>
          <ThumbnailSizeControl
            value={value}
            onChange={setValue}
            onCommit={setValue}
          />
          <ThumbnailGrid
            workspace="prep"
            label="크기 비교 슬라이드"
            columns={SCALE_EXAMPLE_COLUMNS}
            tileWidth={thumbnailWidth({
              gridWidth: SCALE_EXAMPLE_WIDTH,
              columns: SCALE_EXAMPLE_COLUMNS,
              gap: SCALE_EXAMPLE_GAP,
              scalePercent: value,
            })}
            selected={undefined}
            onSelect={ignore}
          >
            {Array.from({length: 6}, (_, index) => (
              <SlideThumbnail
                key={index}
                number={index + 1}
                text="새로운 노래를 부르리"
              />
            ))}
          </ThumbnailGrid>
        </div>
      )}
    </Stateful>
  );
}

function Live({
  initial,
  formatValue,
  ...props
}: Omit<SliderProps, 'value' | 'onChange' | 'valueText'> & {
  readonly initial: number;
  readonly formatValue?: (value: number) => string;
}): JSX.Element {
  return (
    <Stateful initial={initial}>
      {(value, setValue) => (
        <Slider
          {...props}
          value={value}
          valueText={formatValue?.(value)}
          onChange={setValue}
        />
      )}
    </Stateful>
  );
}

export function SliderSection(): JSX.Element {
  return (
    <Section title="Slider">
      <SpecGroup title="Slider, track 4, knob 12" surface="panel">
        <SpecItem label="Default">
          <Live {...THUMBNAIL} initial={3} />
        </SpecItem>
        <SpecItem label="Far left">
          <Live {...THUMBNAIL} initial={1} />
        </SpecItem>
        <SpecItem label="Far right">
          <Live {...THUMBNAIL} initial={5} />
        </SpecItem>
        <SpecItem label="Focus" pin="focus">
          <Live {...THUMBNAIL} initial={3} />
        </SpecItem>
        <SpecItem label="Disabled">
          <Live {...VOLUME} initial={40} disabled />
        </SpecItem>
      </SpecGroup>
      <SpecGroup title="Placement" surface="panel">
        <SpecItem label="Under the 진행 슬라이드 grid, 120">
          <Live {...THUMBNAIL} icon="grid" initial={2} />
        </SpecItem>
        <SpecItem label="Narrow window, 96">
          <Live {...THUMBNAIL} icon="grid" width="compact" initial={2} />
        </SpecItem>
        <SpecItem label="진행 도구 audio, volume 96">
          <Live {...VOLUME} icon="audio" width="compact" initial={70} />
        </SpecItem>
        <SpecItem
          label="Media properties, cell width, disabled while sound is off"
          width={BLOCK_WIDTH}
        >
          <Live
            {...VOLUME}
            icon="audio"
            width="block"
            disabled
            title="소리가 꺼져 있습니다"
            initial={0}
          />
        </SpecItem>
      </SpecGroup>
      <SpecGroup title="Continuous slide size, spec-13" surface="panel">
        <SpecItem
          label="Continuous percentage and fixed-width wrapping"
          width={SCALE_EXAMPLE_WIDTH}
        >
          <ScaleExample />
        </SpecItem>
      </SpecGroup>
    </Section>
  );
}
