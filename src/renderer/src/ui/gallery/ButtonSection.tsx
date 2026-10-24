import type {JSX} from 'react';
import {Button, type ButtonProps} from '../Button';
import {Section, SpecGroup, SpecItem, type SpecPin} from './Spec';

interface StateSpec {
  readonly label: string;
  readonly pin?: SpecPin;
  readonly disabled?: boolean;
}

const states: readonly StateSpec[] = [
  {label: 'Default'},
  {label: 'Hover', pin: 'hover'},
  {label: 'Pressed', pin: 'pressed'},
  {label: 'Focus', pin: 'focus'},
  {label: 'Disabled', disabled: true},
];

function StateRow({
  title,
  text,
  ...props
}: Omit<ButtonProps, 'children'> & {
  readonly title: string;
  readonly text: string;
}): JSX.Element {
  return (
    <SpecGroup title={title}>
      {states.map(state => (
        <SpecItem key={state.label} label={state.label} pin={state.pin}>
          <Button {...props} disabled={state.disabled}>
            {text}
          </Button>
        </SpecItem>
      ))}
    </SpecGroup>
  );
}

export function ButtonSection(): JSX.Element {
  return (
    <Section title="Button">
      <StateRow
        title="Primary button, md 30"
        variant="primary"
        size="md"
        text="만들기"
      />
      <StateRow title="Primary button, sm 26" variant="primary" text="저장" />
      <StateRow
        title="Secondary button, md 30"
        size="md"
        text="새 곡으로 저장"
      />
      <StateRow
        title="Secondary button, sm 26, leading icon 14"
        icon="edit"
        text="라이브러리 곡 편집"
      />
      <StateRow
        title="Ghost button, md 30, leading icon 16"
        variant="ghost"
        size="md"
        icon="plus"
        text="역본 추가"
      />
      <SpecGroup title="Size comparison">
        <SpecItem label="sm text only, horizontal 10">
          <Button>버리기</Button>
        </SpecItem>
        <SpecItem label="sm leading icon, left 8">
          <Button icon="plus">가져오기</Button>
        </SpecItem>
        <SpecItem label="sm ghost">
          <Button variant="ghost" icon="plus">
            지금 예배를 틀로 저장
          </Button>
        </SpecItem>
        <SpecItem label="md text only, horizontal 14">
          <Button size="md">지금 백업</Button>
        </SpecItem>
        <SpecItem label="md leading icon, left 12">
          <Button size="md" icon="undo">
            모두 기본값으로
          </Button>
        </SpecItem>
      </SpecGroup>
    </Section>
  );
}
