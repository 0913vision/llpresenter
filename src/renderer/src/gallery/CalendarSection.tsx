import {useState, type JSX} from 'react';
import {DateSelect} from '../ui/DateSelect';
import {ignore, Section, SpecGroup, SpecItem} from './Spec';

export function CalendarSection(): JSX.Element {
  const [date, setDate] = useState('2026-11-01');
  return (
    <Section title="Calendar">
      <SpecGroup title="Date fields: open to browse, choose a day to commit">
        <SpecItem label="Selected date, today and focus remain separate">
          <DateSelect
            aria-label="날짜"
            value={date}
            today="2026-10-26"
            onChange={setDate}
          />
        </SpecItem>
        <SpecItem label="Disabled field">
          <DateSelect
            aria-label="잠긴 날짜"
            value={date}
            onChange={ignore}
            disabled
            title="읽기 전용"
          />
        </SpecItem>
      </SpecGroup>
    </Section>
  );
}
