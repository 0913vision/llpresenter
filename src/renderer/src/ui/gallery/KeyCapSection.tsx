import type {JSX} from 'react';
import {KeyCombo, KeyList, KeyText} from '../KeyCap';
import {Section, SpecGroup, SpecItem} from './Spec';

export function KeyCapSection(): JSX.Element {
  return (
    <Section title="KeyCap">
      <SpecGroup title="Key, height 18, minimum width 22" surface="dialog">
        <SpecItem label="One key">
          <KeyCombo keys={['F1']} />
        </SpecItem>
        <SpecItem label="Combination, gap 4">
          <KeyCombo keys={['Ctrl', 'Z']} />
        </SpecItem>
        <SpecItem label="Two shortcuts, gap 10">
          <KeyList>
            <KeyCombo keys={['→']} />
            <KeyCombo keys={['Space']} />
          </KeyList>
        </SpecItem>
        <SpecItem label="Changed shortcut">
          <KeyCombo keys={['Alt', '2']} state="changed" />
        </SpecItem>
        <SpecItem label="Conflict, reason in tooltip">
          <KeyCombo
            keys={['Ctrl', '1']}
            state="warning"
            conflictWith="출력 켜기"
          />
        </SpecItem>
        <SpecItem label="None">
          <KeyList />
        </SpecItem>
      </SpecGroup>
      <SpecGroup title="Text shortcut, no box" surface="dialog">
        <SpecItem label="As text">
          <KeyText keys={['Ctrl', 'Z']} />
        </SpecItem>
      </SpecGroup>
    </Section>
  );
}
