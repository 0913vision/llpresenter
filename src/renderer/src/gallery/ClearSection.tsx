import type {JSX} from 'react';
import type {ClearTarget} from '@core/live/commands';
import {ClearButton, ClearRow} from '../ui/ClearButton';
import {ignore, Section, SpecGroup, SpecItem, type SpecPin} from './Spec';

const ROW_WIDTH = 480;
const COMPACT_ROW_WIDTH = 360;
const SINGLE_WIDTH = 60;
const SINGLE_BOX = {display: 'flex', width: '100%'} as const;

const layers: readonly ClearTarget[] = [
  'all',
  'slide',
  'media',
  'prop',
  'audio',
  'message',
];

function Row({
  isActive,
  compact = false,
}: {
  readonly isActive: (layer: ClearTarget) => boolean;
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
    </ClearRow>
  );
}

const quietLayers: ReadonlySet<ClearTarget> = new Set(['audio']);

interface SingleState {
  readonly label: string;
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
];

function Single({state}: {readonly state: SingleState}): JSX.Element {
  return (
    <div style={SINGLE_BOX}>
      <ClearButton layer="slide" active={state.available} onClear={ignore} />
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
        <SpecItem label="Live, nothing to clear in 오디오" width={ROW_WIDTH}>
          <Row isActive={layer => !quietLayers.has(layer)} />
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
            width={SINGLE_WIDTH}
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
          <Row isActive={layer => !quietLayers.has(layer)} compact />
        </SpecItem>
      </SpecGroup>
    </Section>
  );
}
