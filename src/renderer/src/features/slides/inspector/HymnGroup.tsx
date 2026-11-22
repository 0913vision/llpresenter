import type {JSX} from 'react';
import {HYMNAL_NAMES} from '@core/hymns';
import {HYMN_COUNTS, type Hymn, type Hymnal} from '@core/schema/hymn';
import {withHymn} from '@core/slides';
import {NumberField} from '@renderer/ui/NumberField';
import {PropertyGroup, PropertyRow} from '@renderer/ui/PropertyRow';
import {SegmentedControl} from '@renderer/ui/SegmentedControl';
import {changeSelected, type ChosenSlides} from './changeSelected';

const HYMNALS: ReadonlyArray<{readonly value: Hymnal; readonly label: string}> =
  [
    {value: 'new', label: HYMNAL_NAMES.new},
    {value: 'unified', label: HYMNAL_NAMES.unified},
  ];

/** Which hymn a slide is the title of; its theme writes the rest. */
export function HymnGroup({deck, chosen}: ChosenSlides): JSX.Element {
  const hymn = chosen[0]?.hymn;
  const hymnal = hymn?.hymnal ?? 'new';
  const set = (change: Partial<Hymn>): void => {
    const next = {hymnal, number: hymn?.number ?? 1, ...change};
    const number = Math.min(next.number, HYMN_COUNTS[next.hymnal]);
    changeSelected(deck, slide => withHymn(slide, {...next, number}));
  };
  return (
    <PropertyGroup title="찬송가">
      <PropertyRow label="종류">
        {({controlId, labelId}) => (
          <SegmentedControl
            id={controlId}
            labelledBy={labelId}
            fill
            options={HYMNALS}
            value={hymnal}
            disabled={deck.readOnly}
            onChange={value => set({hymnal: value})}
          />
        )}
      </PropertyRow>
      <PropertyRow label="장 번호">
        {({controlId}) => (
          <NumberField
            id={controlId}
            value={hymn?.number ?? 0}
            min={1}
            max={HYMN_COUNTS[hymnal]}
            unit="장"
            updateOn="commit"
            readOnly={deck.readOnly}
            formatValue={value => (value === 0 ? '' : String(value))}
            onChange={number => set({number})}
          />
        )}
      </PropertyRow>
    </PropertyGroup>
  );
}
