import {LabelSwatch, LabelTag} from '../ui/labels/LabelChip';
import type {JSX} from 'react';
import {
  paletteColors,
  paletteHex,
  type LabelColor,
  type PaletteColor,
} from '@core/labels';
import {
  LabelColorPicker,
  MacroColorPicker,
} from '../ui/labels/LabelColorPicker';
import styles from './LabelSection.module.css';
import {ignore, Section, SpecGroup, SpecItem, Stateful} from './Spec';

const CAPTION_WIDTH = 300;

const allColors: readonly LabelColor[] = [
  ...paletteColors.map(color => paletteHex[color]),
  'none',
];

export function LabelSection(): JSX.Element {
  return (
    <Section title="LabelChip">
      <SpecGroup
        title="Small 이름표 22, in lyric blocks and lists"
        surface="panel"
      >
        <SpecItem label="Display only">
          <LabelTag name="1절" color="#5FB8C2" />
        </SpecItem>
        <SpecItem label="Picker button">
          <Stateful<boolean> initial={false}>
            {(expanded, setExpanded) => (
              <LabelTag
                name="후렴"
                color="#D6B35F"
                picker={{expanded, onOpen: () => setExpanded(!expanded)}}
              />
            )}
          </Stateful>
        </SpecItem>
        <SpecItem label="Menu open">
          <LabelTag
            name="후렴"
            color="#D6B35F"
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
            color="#5FB8C2"
            picker={{expanded: false, onOpen: ignore}}
          />
        </SpecItem>
      </SpecGroup>
      <SpecGroup title="Color swatch 10, preview name row" surface="panel">
        <SpecItem label="Under the 준비 preview" width={CAPTION_WIDTH}>
          <span className={styles.caption}>
            <LabelSwatch color="#8FBF7A" />
            <b>프리코러스</b>
            <span className={styles.meta}>5 / 9</span>
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
          <Stateful<LabelColor> initial="#D6B35F">
            {(value, setValue) => (
              <LabelColorPicker
                label="후렴 색"
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
