import type {JSX} from 'react';
import type {ClearTarget} from '@shared/commands';
import {ClearButton, ClearRow, ClearUndo} from '../ClearButton';
import {ignore, Section, SpecGroup, SpecItem, type SpecPin} from './Spec';

const ROW_WIDTH = 480;
const COMPACT_ROW_WIDTH = 360;
const SINGLE_WIDTH = 60;
// NOTE(0913vision): 되돌림 brings its divider (1px and 4px on each side), so
// its specimen is that much wider to keep the button at the card's 60px.
const UNDO_WIDTH = SINGLE_WIDTH + 9;
const SINGLE_BOX = {display: 'flex', width: '100%'} as const;

const layers: readonly ClearTarget[] = [
  'all',
  'slide',
  'media',
  'prop',
  'audio',
  'message',
  'notice',
];

function Row({
  isActive,
  undoAvailable,
  compact = false,
}: {
  readonly isActive: (layer: ClearTarget) => boolean;
  readonly undoAvailable: boolean;
  readonly compact?: boolean;
}): JSX.Element {
  return (
    <ClearRow compact={compact}>
      {layers.map(layer => (
        <ClearButton
          key={layer}
          layer={layer}
          active={isActive(layer)}
          onClear={ignore}
        />
      ))}
      <ClearUndo available={undoAvailable} onUndo={ignore} />
    </ClearRow>
  );
}

const quietLayers: ReadonlySet<ClearTarget> = new Set(['audio', 'notice']);

interface SingleState {
  readonly label: string;
  readonly undo?: boolean;
  readonly available: boolean;
  readonly pin?: SpecPin;
}

const singleStates: readonly SingleState[] = [
  {label: 'Something to clear', available: true},
  {label: 'Hover', available: true, pin: 'hover'},
  {label: 'Pressed', available: true, pin: 'pressed'},
  {label: 'Focus', available: true, pin: 'focus'},
  {label: 'Nothing to clear', available: false},
  {label: 'Nothing to clear + hover', available: false, pin: 'hover'},
  {label: '되돌림', undo: true, available: true},
  {label: '되돌림 hover', undo: true, available: true, pin: 'hover'},
  {label: 'Nothing to undo', undo: true, available: false},
];

function Single({state}: {readonly state: SingleState}): JSX.Element {
  return (
    <div style={SINGLE_BOX}>
      {state.undo === true ? (
        <ClearUndo available={state.available} onUndo={ignore} />
      ) : (
        <ClearButton layer="slide" active={state.available} onClear={ignore} />
      )}
    </div>
  );
}

export function ClearSection(): JSX.Element {
  return (
    <Section title="ClearButton">
      <SpecGroup
        title="지우기 row, regular window (column 480), padding 8, gap 4, 모두 at 1.4×"
        alignTop
      >
        <SpecItem
          label="Live, nothing to clear in 오디오 and 공지"
          width={ROW_WIDTH}
        >
          <Row isActive={layer => !quietLayers.has(layer)} undoAvailable />
        </SpecItem>
        <SpecItem
          label="After 모두, only 되돌림 is available"
          width={ROW_WIDTH}
        >
          <Row isActive={() => false} undoAvailable />
        </SpecItem>
      </SpecGroup>
      <SpecGroup
        title="Single button, 52, caption-strong under icon 18"
        surface="panel"
      >
        {singleStates.map(state => (
          <SpecItem
            key={state.label}
            label={state.label}
            pin={state.pin}
            width={state.undo === true ? UNDO_WIDTH : SINGLE_WIDTH}
          >
            <Single state={state} />
          </SpecItem>
        ))}
      </SpecGroup>
      <SpecGroup title="Narrow window, column 360, button 40, icon 16 only, padding 6">
        <SpecItem
          label="Names in the tooltip and aria-label"
          width={COMPACT_ROW_WIDTH}
        >
          <Row
            isActive={layer => !quietLayers.has(layer)}
            undoAvailable
            compact
          />
        </SpecItem>
      </SpecGroup>
    </Section>
  );
}
