import {useState, type JSX} from 'react';
import type {LabelColor} from '@core/labels/colors';
import dawnSky from '../../../../design/system/upload/Media/dawn-sky.jpg';
import {
  Panel,
  PanelBody,
  PanelFooter,
  PanelHeader,
  PanelTitle,
} from '../ui/Panel';
import {Slider} from '../ui/Slider';
import {
  SlideThumbnail,
  ThumbnailGrid,
  type SlideThumbnailProps,
} from '../ui/SlideThumbnail';
import {ignore, Section, SpecGroup, SpecItem, type SpecPin} from './Spec';

const STATE_WIDTH = 200;
const COLOR_WIDTH = 160;
const GRID_PANEL_WIDTH = 920;
const sizeSamples: ReadonlyArray<{
  readonly width: number;
  readonly label: string;
}> = [
  {width: 176, label: 'Width 176, text 7.7px (6 columns)'},
  {width: 270, label: 'Width 270, text 11.9px (4 columns, regular default)'},
  {width: 364, label: 'Width 364, text 16px (3 columns)'},
];
const SLIDER_MIN = 2;
const SLIDER_MAX = 8;
const COLUMN_SUM = 10;
const DEFAULT_SLIDER = 6;
const MISSING_PATH = 'D:\\예배 미디어\\광고\\11월 1일 광고.png';

const verse = '만복의 근원 하나님\n온 백성 찬송 드리고';
const preChorus = '저 천사여 찬송하세\n찬송 성부 성자 성령';
const chorus = '찬송 성부 성자 성령\n아멘';
const verseTwo = '찬송 성부 성자 성령\n만복의 근원 하나님';

interface ThumbnailState {
  readonly label: string;
  readonly thumbnail: SlideThumbnailProps;
  readonly pin?: SpecPin;
}

const thumbnailStates: readonly ThumbnailState[] = [
  {
    label: 'Default',
    thumbnail: {number: 1, label: '1절', labelColor: 'teal', text: verse},
  },
  {
    label: 'Hover, 1px line-control',
    thumbnail: {
      number: 2,
      label: '프리코러스',
      labelColor: 'green',
      text: preChorus,
    },
    pin: 'hover',
  },
  {
    label: 'Selected, ring-selected',
    thumbnail: {
      number: 3,
      label: '후렴',
      labelColor: 'yellow',
      text: chorus,
      selected: true,
    },
  },
  {
    label: 'Live, ring-live',
    thumbnail: {
      number: 5,
      label: '프리코러스',
      labelColor: 'green',
      text: preChorus,
      live: true,
    },
  },
  {
    label: 'Focus, no 이름표',
    thumbnail: {number: 4, text: verseTwo},
    pin: 'focus',
  },
  {
    label: 'Media 슬라이드 (Sunday announcement)',
    thumbnail: {number: 3, media: dawnSky},
  },
  {
    label: 'Missing media file',
    thumbnail: {number: 4, missingFile: MISSING_PATH},
  },
  {
    label: 'Live + missing file',
    thumbnail: {number: 4, missingFile: MISSING_PATH, live: true},
  },
];

interface ColorSample {
  readonly color: LabelColor;
  readonly label: string;
  readonly text: string;
}

const colorSamples: readonly ColorSample[] = [
  {color: 'teal', label: '1절', text: '만복의 근원 하나님'},
  {color: 'green', label: '프리코러스', text: '저 천사여 찬송하세'},
  {color: 'yellow', label: '후렴', text: '찬송 성부 성자 성령'},
  {color: 'orange', label: '태그', text: '만복의 근원 하나님'},
  {color: 'rose', label: '인트로', text: '내 주를 가까이 하게 함은'},
  {color: 'violet', label: '브리지', text: '아멘'},
  {color: 'slate', label: '엔딩', text: '찬송 성부 성자 성령'},
  {color: 'gray', label: '간주', text: '주 하나님 지으신 모든 세계'},
];

const sampleNumbers: Readonly<Record<LabelColor, number>> = {
  teal: 1,
  green: 2,
  yellow: 3,
  orange: 4,
  rose: 1,
  violet: 6,
  slate: 9,
  gray: 5,
  none: 4,
};

const songSlides: readonly SlideThumbnailProps[] = [
  {number: 1, label: '1절', labelColor: 'teal', text: verse},
  {number: 2, label: '프리코러스', labelColor: 'green', text: preChorus},
  {number: 3, label: '후렴', labelColor: 'yellow', text: chorus},
  {number: 4, text: verseTwo},
  {number: 5, label: '프리코러스', labelColor: 'green', text: preChorus},
  {number: 6, label: '후렴', labelColor: 'yellow', text: chorus},
  {number: 7, text: verseTwo},
  {number: 8, label: '후렴', labelColor: 'yellow', text: chorus},
];

const DEFAULT_LIVE = 4;
const DEFAULT_SELECTED = 5;

function OneThumbnail({
  name,
  thumbnail,
}: {
  readonly name: string;
  readonly thumbnail: SlideThumbnailProps;
}): JSX.Element {
  return (
    <ThumbnailGrid
      label={name}
      columns={1}
      workspace="prep"
      selected={thumbnail.selected === true ? 0 : undefined}
      onSelect={ignore}
    >
      <SlideThumbnail {...thumbnail} />
    </ThumbnailGrid>
  );
}

function TryGrid(): JSX.Element {
  const [size, setSize] = useState(DEFAULT_SLIDER);
  const [live, setLive] = useState(DEFAULT_LIVE);
  const [selected, setSelected] = useState(DEFAULT_SELECTED);
  const output = (index: number): void => {
    setLive(index);
    setSelected(index);
  };
  return (
    <Panel label="슬라이드">
      <PanelHeader>
        <PanelTitle
          title="만복의 근원 하나님"
          meta={`${live + 1} / ${songSlides.length}`}
        />
      </PanelHeader>
      <PanelBody>
        <ThumbnailGrid
          label="슬라이드"
          columns={COLUMN_SUM - size}
          workspace="show"
          selected={selected}
          onSelect={setSelected}
          onOutput={output}
        >
          {songSlides.map((slide, index) => (
            <SlideThumbnail
              key={slide.number}
              {...slide}
              live={index === live}
              selected={index === selected}
            />
          ))}
        </ThumbnailGrid>
      </PanelBody>
      <PanelFooter
        end={
          <Slider
            label="썸네일 크기"
            icon="grid"
            min={SLIDER_MIN}
            max={SLIDER_MAX}
            value={size}
            onChange={setSize}
          />
        }
      />
    </Panel>
  );
}

export function ThumbnailSection(): JSX.Element {
  return (
    <Section title="SlideThumbnail">
      <SpecGroup title="States" alignTop>
        {thumbnailStates.map(state => (
          <SpecItem
            key={state.label}
            label={state.label}
            pin={state.pin}
            width={STATE_WIDTH}
          >
            <OneThumbnail name={state.label} thumbnail={state.thumbnail} />
          </SpecItem>
        ))}
      </SpecGroup>
      <SpecGroup
        title="8 이름표 colors and no 이름표, band style band 12/700"
        alignTop
      >
        {colorSamples.map(sample => (
          <SpecItem key={sample.color} label={sample.color} width={COLOR_WIDTH}>
            <OneThumbnail
              name={sample.color}
              thumbnail={{
                number: sampleNumbers[sample.color],
                label: sample.label,
                labelColor: sample.color,
                text: sample.text,
              }}
            />
          </SpecItem>
        ))}
        <SpecItem label="None, label-none + label-gray" width={COLOR_WIDTH}>
          <OneThumbnail
            name="None"
            thumbnail={{number: sampleNumbers.none, text: '만복의 근원 하나님'}}
          />
        </SpecItem>
      </SpecGroup>
      <SpecGroup title="Lyric font size = canvas width × 0.044" alignTop>
        {sizeSamples.map(({width, label}) => (
          <SpecItem key={width} label={label} width={width}>
            <OneThumbnail
              name={label}
              thumbnail={{
                number: 1,
                label: '1절',
                labelColor: 'teal',
                text: verse,
              }}
            />
          </SpecItem>
        ))}
      </SpecGroup>
      <SpecGroup title="Grid, size slider sets columns (2–8), gap 16 vertical 12 horizontal, padding panel-inset 14">
        <SpecItem
          label="Try a click, ↑ ↓, Enter, and the slider (진행)"
          width={GRID_PANEL_WIDTH}
        >
          <TryGrid />
        </SpecItem>
      </SpecGroup>
    </Section>
  );
}
