import type {JSX} from 'react';
import {
  Properties,
  PropertyGroup,
  PropertyRow,
  type PropertiesPlacement,
} from '../PropertyRow';
import {Switch, SwitchRow} from '../Switch';
import {ignore, Section, SpecGroup, SpecItem, Stateful} from './Spec';

const WINDOW_WIDTH = 512;
const PANEL_WIDTH = 292;

interface SwitchProperty {
  readonly label: string;
  readonly initial: boolean;
}

function SwitchProperties({
  placement,
  title,
  rows,
}: {
  readonly placement: PropertiesPlacement;
  readonly title: string;
  readonly rows: readonly SwitchProperty[];
}): JSX.Element {
  return (
    <Properties placement={placement}>
      <PropertyGroup title={title}>
        {rows.map(row => (
          <PropertyRow key={row.label} label={row.label}>
            {({controlId}) => (
              <Stateful<boolean> initial={row.initial}>
                {(checked, setChecked) => (
                  <Switch
                    id={controlId}
                    checked={checked}
                    onChange={setChecked}
                  />
                )}
              </Stateful>
            )}
          </PropertyRow>
        ))}
      </PropertyGroup>
    </Properties>
  );
}

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
      <SpecGroup title="Preferences, name 168, row 38" surface="panel">
        <SpecItem
          label="Switch at the left end of the control cell"
          width={WINDOW_WIDTH}
        >
          <SwitchProperties
            placement="window"
            title="보고"
            rows={[
              {label: '오류 보고 보내기', initial: true},
              {label: '사용 통계 보내기', initial: false},
            ]}
          />
        </SpecItem>
      </SpecGroup>
      <SpecGroup title="Panel property field, name 84, row 36" surface="panel">
        <SpecItem label="화면 설정 (Screen settings)" width={PANEL_WIDTH}>
          <SwitchProperties
            placement="panel"
            title="안정성"
            rows={[
              {label: '항상 위', initial: true},
              {label: '절전 막기', initial: false},
            ]}
          />
        </SpecItem>
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
            onChange={ignore}
          />
        </SpecItem>
      </SpecGroup>
    </Section>
  );
}
