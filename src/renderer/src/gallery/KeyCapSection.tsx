import {useState, type JSX} from 'react';
import type {KeyBinding} from '@core/schema/shortcuts';
import {Button} from '../ui/Button';
import {KeyCombo, KeyList, KeyText} from '../ui/KeyCap';
import {ShortcutField} from '../ui/ShortcutField';
import {shortcutNames} from '../ui/shortcutKeys';
import {Section, SpecGroup, SpecItem} from './Spec';

export function KeyCapSection(): JSX.Element {
  const [recording, setRecording] = useState(false);
  const [binding, setBinding] = useState<KeyBinding | null>({
    code: 'F7',
    mods: [],
  });
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
      <SpecGroup title="Live shortcut recording" surface="dialog">
        <SpecItem label="Recording: bare letters and digits are slide keys">
          {recording ? (
            <ShortcutField
              aria-label="로고 화면 단축키"
              onRecord={next => {
                setBinding(next);
                setRecording(false);
              }}
              onCancel={() => setRecording(false)}
            />
          ) : (
            <Button
              size="sm"
              aria-label="단축키 바꾸기"
              onClick={() => setRecording(true)}
            >
              {binding === null ? (
                <KeyList />
              ) : (
                <KeyCombo keys={shortcutNames(binding)} />
              )}
            </Button>
          )}
        </SpecItem>
        <SpecItem label="Tab leaves the recorder">
          <Button size="sm">다음 명령</Button>
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
