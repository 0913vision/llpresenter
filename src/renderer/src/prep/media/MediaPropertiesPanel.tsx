import {useState, type JSX, type KeyboardEvent} from 'react';
import type {MediaItem} from '@shared/schema/mediaList';
import {NumberField} from '@renderer/ui/NumberField';
import {Panel, PanelBody, PanelHeader, PanelTabs} from '@renderer/ui/Panel';
import {
  Properties,
  PropertyGroup,
  PropertyRow,
  PropertyValue,
} from '@renderer/ui/PropertyRow';
import {SegmentedControl} from '@renderer/ui/SegmentedControl';
import {Slider} from '@renderer/ui/Slider';
import {Switch} from '@renderer/ui/Switch';
import {TextField} from '@renderer/ui/TextField';
import {durationText, sizeText} from './mediaEntries';
import {
  parseTime,
  shownProps,
  timeText,
  type MediaProps,
  type ShownProps,
} from './mediaProps';
import {useMediaView} from './MediaViewProvider';
import styles from './MediaPropertiesPanel.module.css';

/** The slowest and fastest speeds 속도 offers. */
export const MIN_SPEED = 0.25;
export const MAX_SPEED = 4;
const SPEED_STEP = 0.05;
const SPEED_LARGE_STEP = 0.5;
const MAX_VOLUME = 100;

const KIND_NAMES: Readonly<Record<MediaItem['kind'], string>> = {
  video: '영상',
  image: '이미지',
  audio: '오디오',
};

type Tab = 'props' | 'info';

interface Editing {
  readonly shown: ShownProps;
  readonly duration: number | undefined;
  readonly disabled: boolean;
  readonly change: (change: MediaProps) => void;
}

function TimeField({
  id,
  label,
  value,
  accept,
  disabled,
  onCommit,
}: {
  readonly id?: string | undefined;
  readonly label: string;
  readonly value: number;
  readonly accept: (seconds: number) => boolean;
  readonly disabled: boolean;
  readonly onCommit: (seconds: number) => void;
}): JSX.Element {
  const [draft, setDraft] = useState<string | null>(null);
  const finish = (): void => {
    if (draft === null) return;
    const seconds = parseTime(draft);
    setDraft(null);
    if (seconds !== null && seconds !== value && accept(seconds)) {
      onCommit(seconds);
    }
  };
  return (
    <TextField
      id={id}
      aria-label={label}
      size="md"
      numeric
      className={styles.time}
      value={draft ?? timeText(value)}
      disabled={disabled}
      onChange={setDraft}
      onBlur={finish}
      onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') finish();
        else if (event.key === 'Escape') setDraft(null);
      }}
    />
  );
}

function PlaybackGroup({shown, duration, disabled, change}: Editing) {
  const stop = shown.stop ?? duration;
  return (
    <PropertyGroup title="재생">
      <PropertyRow label="끝나면">
        {({controlId, labelId}) => (
          <SegmentedControl
            id={controlId}
            labelledBy={labelId}
            fill
            disabled={disabled}
            options={[
              {value: 'loop', label: '반복'},
              {value: 'stop', label: '멈춤'},
            ]}
            value={shown.end}
            onChange={end => change({end})}
          />
        )}
      </PropertyRow>
      <PropertyRow label="구간">
        {({controlId}) => (
          <span className={styles.range}>
            <TimeField
              id={controlId}
              label="시작"
              value={shown.start}
              disabled={disabled}
              accept={seconds => stop === undefined || seconds < stop}
              onCommit={seconds => change({in: seconds})}
            />
            <TimeField
              label="끝"
              value={stop ?? 0}
              disabled={disabled || stop === undefined}
              accept={seconds =>
                seconds > shown.start &&
                (duration === undefined || seconds <= duration)
              }
              onCommit={seconds => change({out: seconds})}
            />
          </span>
        )}
      </PropertyRow>
      <PropertyRow label="속도">
        {({controlId}) => (
          <NumberField
            id={controlId}
            min={MIN_SPEED}
            max={MAX_SPEED}
            step={SPEED_STEP}
            largeStep={SPEED_LARGE_STEP}
            updateOn="commit"
            suffix="×"
            disabled={disabled}
            value={shown.speed}
            onChange={speed => change({speed})}
          />
        )}
      </PropertyRow>
    </PropertyGroup>
  );
}

function ScreenGroup({shown, disabled, change}: Editing) {
  return (
    <PropertyGroup title="화면">
      <PropertyRow label="맞춤">
        {({controlId, labelId}) => (
          <SegmentedControl
            id={controlId}
            labelledBy={labelId}
            fill
            disabled={disabled}
            options={[
              {value: 'fit', label: '맞추기'},
              {value: 'fill', label: '채우기'},
              {value: 'stretch', label: '늘리기'},
            ]}
            value={shown.fit}
            onChange={fit => change({fit})}
          />
        )}
      </PropertyRow>
    </PropertyGroup>
  );
}

function SoundGroup({shown, disabled, change}: Editing) {
  const [dragging, setDragging] = useState<number | null>(null);
  return (
    <PropertyGroup title="소리">
      <PropertyRow label="소리 켜기">
        {({controlId}) => (
          <Switch
            id={controlId}
            checked={shown.audio}
            disabled={disabled}
            onChange={audio => change({audio})}
          />
        )}
      </PropertyRow>
      <PropertyRow label="음량">
        {() => (
          <Slider
            label="음량"
            icon="audio"
            width="block"
            min={0}
            max={MAX_VOLUME}
            step={1}
            disabled={disabled || !shown.audio}
            title={shown.audio ? undefined : '소리가 꺼져 있음'}
            value={dragging ?? shown.volume}
            valueText={`${Math.round(dragging ?? shown.volume)}%`}
            onChange={setDragging}
            onCommit={volume => {
              setDragging(null);
              change({volume: Math.round(volume)});
            }}
          />
        )}
      </PropertyRow>
    </PropertyGroup>
  );
}

function MediaProperties({
  item,
  disabled,
}: {
  readonly item: MediaItem;
  readonly disabled: boolean;
}): JSX.Element {
  const {library} = useMediaView();
  const editing: Editing = {
    shown: shownProps(item),
    duration: item.duration,
    disabled,
    change: change => {
      library.updateProps(item.id, change).catch((cause: unknown) => {
        console.error('Changing media properties failed:', cause);
      });
    },
  };
  return (
    <Properties>
      {item.kind === 'image' ? null : <PlaybackGroup {...editing} />}
      {item.kind === 'audio' ? null : <ScreenGroup {...editing} />}
      {item.kind === 'image' ? null : <SoundGroup {...editing} />}
    </Properties>
  );
}

function MediaInfo({item}: {readonly item: MediaItem}): JSX.Element {
  return (
    <Properties>
      <PropertyGroup title="파일">
        <PropertyValue label="종류" value={KIND_NAMES[item.kind]} />
        {item.width === undefined || item.height === undefined ? null : (
          <PropertyValue
            label="해상도"
            value={`${item.width}×${item.height}`}
          />
        )}
        {item.kind === 'image' ? null : (
          <PropertyValue
            label="길이"
            value={durationText(item.duration) ?? '알 수 없음'}
          />
        )}
        <PropertyValue label="크기" value={sizeText(item.size)} />
        <PropertyValue label="위치" value={item.file} />
      </PropertyGroup>
    </Properties>
  );
}

/**
 * The right column of the media view (spec 05, "Properties"): the selected
 * media's playback properties in 속성, which save at once, and its file in
 * 정보. 전환 and 소리 wait until they are defined (spec 05's proposal).
 */
export function MediaPropertiesPanel(): JSX.Element {
  const {view, selected} = useMediaView();
  const [tab, setTab] = useState<Tab>('props');
  const item =
    view.document?.value.items.find(({id}) => id === selected) ?? null;
  const disabled = view.document?.access !== 'editable';
  return (
    <Panel label="속성" className={styles.panel}>
      <PanelHeader>
        <PanelTabs<Tab>
          tabs={[
            {value: 'props', label: '속성'},
            {value: 'info', label: '정보'},
          ]}
          value={tab}
          onChange={setTab}
        />
      </PanelHeader>
      <PanelBody tab={tab}>
        {item === null ? (
          <p className={styles.empty}>선택한 미디어 없음</p>
        ) : tab === 'props' ? (
          <MediaProperties key={item.id} item={item} disabled={disabled} />
        ) : (
          <MediaInfo item={item} />
        )}
      </PanelBody>
    </Panel>
  );
}
