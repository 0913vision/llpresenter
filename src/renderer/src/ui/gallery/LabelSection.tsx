import {useState, type JSX} from 'react';
import {
  paletteColors,
  type LabelColor,
  type PaletteColor,
} from '@shared/colors';
import {
  ArrangementStrip,
  LabelSwatch,
  LabelTag,
  type ArrangementChip,
} from '../LabelChip';
import {LabelColorPicker, MacroColorPicker} from '../LabelColorPicker';
import styles from './LabelSection.module.css';
import {
  ignore,
  Section,
  SpecGroup,
  SpecItem,
  Stateful,
  type SpecPin,
} from './Spec';

const STRIP_WIDTH = 440;
const CAPTION_WIDTH = 300;

const songChips: readonly ArrangementChip[] = [
  {key: '1', name: '1절', color: 'teal', number: 1},
  {key: '2', name: '프리코러스', color: 'green', number: 2},
  {key: '3', name: '후렴', color: 'yellow', number: 3},
  {key: '4', name: '2절', color: 'teal', number: 4},
  {key: '5', name: undefined, color: 'none', number: 5},
  {key: '6', name: '후렴', color: 'yellow', number: 6},
  {key: '7', name: '엔딩', color: 'slate', number: 7},
];

function TryStrip(): JSX.Element {
  const [chips, setChips] = useState(songChips);
  const [selected, setSelected] = useState(1);
  const move = (from: number, to: number): void => {
    const next = [...chips];
    const [chip] = next.splice(from, 1);
    if (chip === undefined) return;
    next.splice(to, 0, chip);
    setChips(next);
    setSelected(to);
  };
  return (
    <ArrangementStrip
      label="구성"
      chips={chips}
      selected={selected}
      live={2}
      onSelect={setSelected}
      onMove={move}
      onRemove={index => setChips(chips.filter((_, i) => i !== index))}
      onInsert={ignore}
    />
  );
}

interface ChipState {
  readonly label: string;
  readonly chip: ArrangementChip;
  readonly selected?: boolean;
  readonly live?: boolean;
  readonly dragging?: boolean;
  readonly pin?: SpecPin;
}

const teal: ArrangementChip = {key: 'a', name: '1절', color: 'teal', number: 1};
const unnamed: ArrangementChip = {
  key: 'n',
  name: undefined,
  color: 'none',
  number: 4,
};

const namedChipStates: readonly ChipState[] = [
  {label: 'Default', chip: teal},
  {label: 'Hover', chip: teal, pin: 'hover'},
  {
    label: 'Selected',
    chip: {key: 'p', name: '프리코러스', color: 'green', number: 2},
    selected: true,
  },
  {
    label: 'Live',
    chip: {key: 'c', name: '후렴', color: 'yellow', number: 3},
    live: true,
  },
  {
    label: 'Focus',
    chip: {key: 'e', name: '엔딩', color: 'slate', number: 7},
    pin: 'focus',
  },
  {
    label: 'Dragging',
    chip: {key: 'c', name: '후렴', color: 'yellow', number: 3},
    dragging: true,
  },
];

const unnamedChipStates: readonly ChipState[] = [
  {label: 'No 이름표, number', chip: unnamed},
  {label: 'No 이름표, hover', chip: unnamed, pin: 'hover'},
  {label: 'No 이름표, selected', chip: unnamed, selected: true},
];

function OneChip({state}: {readonly state: ChipState}): JSX.Element {
  return (
    <ArrangementStrip
      label={state.label}
      chips={[state.chip]}
      selected={state.selected === true ? 0 : undefined}
      live={state.live === true ? 0 : undefined}
      draggingIndex={state.dragging === true ? 0 : undefined}
      onSelect={ignore}
      onMove={ignore}
      onRemove={ignore}
      onInsert={ignore}
    />
  );
}

function ChipStates({
  states,
}: {
  readonly states: readonly ChipState[];
}): JSX.Element {
  return (
    <>
      {states.map(state => (
        <SpecItem key={state.label} label={state.label} pin={state.pin}>
          <OneChip state={state} />
        </SpecItem>
      ))}
    </>
  );
}

function InsertOnly(): JSX.Element {
  return (
    <ArrangementStrip
      label="구성"
      chips={[]}
      selected={undefined}
      onSelect={ignore}
      onMove={ignore}
      onRemove={ignore}
      onInsert={ignore}
    />
  );
}

const allColors: readonly LabelColor[] = [...paletteColors, 'none'];

export function LabelSection(): JSX.Element {
  return (
    <Section title="LabelChip">
      <SpecGroup title="구성 strip, chip 30, gap 8" surface="panel">
        <SpecItem
          label="Try the arrows, Alt + arrows, and Delete"
          width={STRIP_WIDTH}
        >
          <TryStrip />
        </SpecItem>
      </SpecGroup>
      <SpecGroup title="Chip states" surface="panel">
        <ChipStates states={namedChipStates} />
        <SpecItem label="Drop position, accent 2px">
          <ArrangementStrip
            label="구성"
            chips={songChips.slice(0, 2)}
            selected={undefined}
            dropIndex={1}
            onSelect={ignore}
            onMove={ignore}
            onRemove={ignore}
            onInsert={ignore}
          />
        </SpecItem>
        <ChipStates states={unnamedChipStates} />
        <SpecItem label="Insert">
          <InsertOnly />
        </SpecItem>
        <SpecItem label="Insert, hover" pin="hover">
          <InsertOnly />
        </SpecItem>
        <SpecItem label="Read-only, 기본 chosen" width={STRIP_WIDTH}>
          <ArrangementStrip
            label="구성"
            chips={songChips.slice(0, 2)}
            selected={0}
            readOnlyReason="기본 구성은 변경할 수 없습니다"
            onSelect={ignore}
            onMove={ignore}
            onRemove={ignore}
            onInsert={ignore}
          />
        </SpecItem>
      </SpecGroup>
      <SpecGroup
        title="Small 이름표 22, in lyric blocks and lists"
        surface="panel"
      >
        <SpecItem label="Display only">
          <LabelTag name="1절" color="teal" />
        </SpecItem>
        <SpecItem label="Picker button">
          <Stateful<boolean> initial={false}>
            {(expanded, setExpanded) => (
              <LabelTag
                name="후렴"
                color="yellow"
                picker={{expanded, onOpen: () => setExpanded(!expanded)}}
              />
            )}
          </Stateful>
        </SpecItem>
        <SpecItem label="Menu open">
          <LabelTag
            name="후렴"
            color="yellow"
            picker={{expanded: true, onOpen: ignore}}
          />
        </SpecItem>
        <SpecItem label="No 이름표">
          <LabelTag
            name={undefined}
            color="none"
            picker={{expanded: false, onOpen: ignore}}
          />
        </SpecItem>
        <SpecItem label="None, hover" pin="hover">
          <LabelTag
            name={undefined}
            color="none"
            picker={{expanded: false, onOpen: ignore}}
          />
        </SpecItem>
        <SpecItem label="Focus" pin="focus">
          <LabelTag
            name="1절"
            color="teal"
            picker={{expanded: false, onOpen: ignore}}
          />
        </SpecItem>
      </SpecGroup>
      <SpecGroup title="Color swatch 10, preview name row" surface="panel">
        <SpecItem label="Under the 준비 preview" width={CAPTION_WIDTH}>
          <span className={styles.caption}>
            <LabelSwatch color="green" />
            <b>프리코러스</b>
            <span className={styles.meta}>5 / 9</span>
            <span className={styles.look}>기본</span>
          </span>
        </SpecItem>
        <SpecItem label="8 colors and none">
          {allColors.map(color => (
            <LabelSwatch key={color} color={color} />
          ))}
        </SpecItem>
      </SpecGroup>
      <SpecGroup title="LabelColorPicker" surface="panel">
        <SpecItem label="이름표 color row">
          <Stateful<LabelColor> initial="yellow">
            {(value, setValue) => (
              <LabelColorPicker
                label="후렴 색"
                scope="모든 곡에 적용"
                value={value}
                onChange={setValue}
              />
            )}
          </Stateful>
        </SpecItem>
        <SpecItem label="Macro color row">
          <Stateful<PaletteColor> initial="green">
            {(value, setValue) => (
              <MacroColorPicker
                label="색"
                name="색"
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
