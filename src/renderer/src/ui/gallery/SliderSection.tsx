import type {JSX} from 'react';
import {Slider, type SliderProps} from '../Slider';
import {Section, SpecGroup, SpecItem, Stateful} from './Spec';

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
        <SpecItem label="Under the 진행 장 grid, 120">
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
    </Section>
  );
}
