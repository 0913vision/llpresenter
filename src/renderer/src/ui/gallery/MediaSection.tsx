import {useState, type JSX} from 'react';
import blueRays from '../../../../../design/system/upload/Media/blue-rays.jpg';
import dawnSky from '../../../../../design/system/upload/Media/dawn-sky.jpg';
import starlight from '../../../../../design/system/upload/Media/starlight.jpg';
import warmLight from '../../../../../design/system/upload/Media/warm-light.jpg';
import {
  MediaGrid,
  MediaStrip,
  MediaTile,
  type MediaTileProps,
} from '../MediaTile';
import {
  Panel,
  PanelBody,
  PanelFooter,
  PanelHeader,
  PanelTabs,
  PanelTitle,
} from '../Panel';
import {Slider} from '../Slider';
import {ignore, Section, SpecGroup, SpecItem, type SpecPin} from './Spec';

const STATE_WIDTH = 200;
const PANEL_WIDTH = 920;
const SLIDER_MIN = 2;
const SLIDER_MAX = 8;
const COLUMN_SUM = 10;
const DEFAULT_SLIDER = 5;
const COPY_PERCENT = 62;
const MISSING_WARM = 'D:\\예배 미디어\\배경\\따뜻한 빛.mp4';
const MISSING_WAVE = 'D:\\예배 미디어\\배경\\물결.mp4';

const warm: MediaTileProps = {
  name: '따뜻한 빛',
  picture: warmLight,
  duration: '0:30',
  loop: true,
};
const rays: MediaTileProps = {
  name: '푸른 빛줄기',
  picture: blueRays,
  duration: '0:45',
  loop: true,
};
const dawn: MediaTileProps = {
  name: '새벽 하늘',
  picture: dawnSky,
  duration: '1:00',
  loop: true,
};
const stars: MediaTileProps = {
  name: '별빛',
  picture: starlight,
  duration: '0:30',
  loop: true,
};

interface MediaState {
  readonly label: string;
  readonly tile: MediaTileProps;
  readonly pin?: SpecPin;
}

const mediaStates: readonly MediaState[] = [
  {label: 'Default, looping video', tile: warm},
  {label: 'Hover, 1px line-control', tile: rays, pin: 'hover'},
  {label: 'Selected, ring-selected', tile: {...dawn, selected: true}},
  {label: 'Live, ring-live', tile: {...warm, live: true}},
  {label: 'Focus', tile: stars, pin: 'focus'},
  {
    label: 'Video played once',
    tile: {name: '예배 전 카운트다운', picture: blueRays, duration: '5:00'},
  },
  {
    label: 'Image, no duration',
    tile: {name: '11월 1일 광고', picture: dawnSky},
  },
  {
    label: 'Copying',
    tile: {name: '부활절 배경.mp4', picture: starlight, copying: COPY_PERCENT},
  },
  {
    label: 'Missing file, warning',
    tile: {name: '따뜻한 빛', missingFile: MISSING_WARM},
  },
  {
    label: 'Live + missing file',
    tile: {name: '따뜻한 빛', missingFile: MISSING_WARM, live: true},
  },
];

const library: readonly MediaTileProps[] = [
  warm,
  rays,
  dawn,
  stars,
  {name: '부활절 배경.mp4', picture: dawnSky, copying: COPY_PERCENT},
];

const strip: readonly MediaTileProps[] = [
  warm,
  rays,
  dawn,
  stars,
  {name: '물결', missingFile: MISSING_WAVE},
];

function OneTile({
  name,
  tile,
}: {
  readonly name: string;
  readonly tile: MediaTileProps;
}): JSX.Element {
  return (
    <MediaStrip
      label={name}
      selected={tile.selected === true ? 0 : undefined}
      onSelect={ignore}
      onActivate={ignore}
    >
      <MediaTile {...tile} />
    </MediaStrip>
  );
}

function TryGrid(): JSX.Element {
  const [size, setSize] = useState(DEFAULT_SLIDER);
  const [selected, setSelected] = useState(0);
  const [live, setLive] = useState<number | undefined>(undefined);
  return (
    <Panel label="배경 영상">
      <PanelHeader>
        <PanelTitle title="배경 영상" meta={`${library.length}`} />
      </PanelHeader>
      <PanelBody>
        <MediaGrid
          label="배경 영상"
          columns={COLUMN_SUM - size}
          selected={selected}
          onSelect={setSelected}
          onActivate={setSelected}
          onOutput={setLive}
        >
          {library.map((media, index) => (
            <MediaTile
              key={media.name}
              {...media}
              selected={index === selected}
              live={index === live}
            />
          ))}
        </MediaGrid>
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
      >
        {`${library.length}개 2.1GB`}
      </PanelFooter>
    </Panel>
  );
}

function TryStrip(): JSX.Element {
  const [selected, setSelected] = useState(0);
  const [live, setLive] = useState(0);
  return (
    <Panel label="미디어">
      <PanelHeader>
        <PanelTabs
          tabs={[{value: 'media', label: '미디어'}]}
          value="media"
          onChange={ignore}
        />
      </PanelHeader>
      <PanelBody>
        <MediaStrip
          label="배경 영상"
          selected={selected}
          onSelect={setSelected}
          onActivate={setLive}
        >
          {strip.map((media, index) => (
            <MediaTile
              key={media.name}
              {...media}
              selected={index === selected && index !== live}
              live={index === live}
            />
          ))}
        </MediaStrip>
      </PanelBody>
    </Panel>
  );
}

export function MediaSection(): JSX.Element {
  return (
    <Section title="MediaTile">
      <SpecGroup title="States" surface="panel" alignTop>
        {mediaStates.map(state => (
          <SpecItem
            key={state.label}
            label={state.label}
            pin={state.pin}
            width={STATE_WIDTH}
          >
            <OneTile name={state.label} tile={state.tile} />
          </SpecItem>
        ))}
      </SpecGroup>
      <SpecGroup title="Media view, size slider sets grid columns, gap 16 vertical 12 horizontal">
        <SpecItem
          label="Try a click, a double click, and the slider"
          width={PANEL_WIDTH}
        >
          <TryGrid />
        </SpecItem>
      </SpecGroup>
      <SpecGroup title="진행 media strip, fixed tile width 150, one row, scrolls horizontally on overflow">
        <SpecItem label="A click sends the media out" width={PANEL_WIDTH}>
          <TryStrip />
        </SpecItem>
      </SpecGroup>
    </Section>
  );
}
