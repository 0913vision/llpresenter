import type {JSX} from 'react';
import {Switch, SwitchRow} from '../Switch';
import {Section, SpecGroup, SpecItem, Stateful} from './Spec';

function Toggle({
  label,
  name,
  initial,
  disabled = false,
  pinned = false,
}: {
  readonly label: string;
  readonly name: string;
  readonly initial: boolean;
  readonly disabled?: boolean;
  readonly pinned?: boolean;
}): JSX.Element {
  return (
    <SpecItem label={label} pin={pinned ? 'focus' : undefined}>
      <Stateful initial={initial}>
        {(checked, setChecked) => (
          <Switch
            aria-label={name}
            checked={checked}
            disabled={disabled}
            onChange={setChecked}
          />
        )}
      </Stateful>
    </SpecItem>
  );
}

export function SwitchSection(): JSX.Element {
  return (
    <Section title="Switch">
      <SpecGroup title="Switch 30×18" surface="panel">
        <Toggle label="Off" name="꺼짐" initial={false} />
        <Toggle label="On" name="켜짐" initial />
        <Toggle label="Focus" name="포커스" initial={false} pinned />
        <Toggle label="On, focus" name="켜짐 포커스" initial pinned />
        <Toggle
          label="Disabled, off"
          name="쓸 수 없음"
          initial={false}
          disabled
        />
        <Toggle label="Disabled, on" name="쓸 수 없음 켜짐" initial disabled />
      </SpecGroup>
      <SpecGroup surface="panel">
        <SpecItem label="Name + switch, text import settings row">
          <Stateful<boolean> initial>
            {(checked, setChecked) => (
              <SwitchRow
                label="이름표 인식"
                checked={checked}
                onChange={setChecked}
              />
            )}
          </Stateful>
        </SpecItem>
        <SpecItem label="Disabled">
          <SwitchRow
            label="이름표 인식"
            checked
            disabled
            title="텍스트 파일에 이름표가 없습니다"
            onChange={() => {}}
          />
        </SpecItem>
      </SpecGroup>
    </Section>
  );
}
