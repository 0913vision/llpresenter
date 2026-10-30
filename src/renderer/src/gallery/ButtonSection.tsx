import type {JSX} from 'react';
import {Button, type ButtonProps} from '../ui/Button';
import {Panel, PanelActions, PanelHeader, PanelTitle} from '../ui/Panel';
import styles from './ButtonSection.module.css';
import {Section, SpecGroup, SpecItem, type SpecPin} from './Spec';

interface StateSpec {
  readonly label: string;
  readonly pin?: SpecPin;
  readonly disabled?: boolean;
}

const DIALOG_WIDTH = 460;
const HEADER_WIDTH = 360;

const states: readonly StateSpec[] = [
  {label: 'Default'},
  {label: 'Hover', pin: 'hover'},
  {label: 'Pressed', pin: 'pressed'},
  {label: 'Focus', pin: 'focus'},
  {label: 'Disabled', disabled: true},
];

const catalogStates = [
  {label: 'Pending catalog', reason: '곡 목록을 불러오는 중입니다'},
  {label: 'Unavailable catalog', reason: '곡 목록을 확인할 수 없습니다'},
  {label: 'Known catalog', reason: undefined},
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
      <SpecGroup title="Imported song Save readiness">
        {catalogStates.map(state => (
          <SpecItem key={state.label} label={state.label} width={HEADER_WIDTH}>
            <div className={styles.dialogFooter}>
              <Button>버리기</Button>
              <Button
                variant="primary"
                disabled={state.reason !== undefined}
                title={state.reason}
              >
                저장
              </Button>
            </div>
          </SpecItem>
        ))}
      </SpecGroup>
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
            지금 예배를 템플릿으로 저장
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
      <SpecGroup>
        <SpecItem
          label="Confirmation dialog buttons, md, gap 8, one primary at far right"
          width={DIALOG_WIDTH}
        >
          <div className={styles.dialogFooter}>
            <Button size="md">취소</Button>
            <Button size="md" className={styles.firstAfterGap}>
              새 곡으로 저장
            </Button>
            <Button size="md" variant="primary">
              덮어쓰기
            </Button>
          </div>
        </SpecItem>
        <SpecItem label="In a panel header, sm" width={HEADER_WIDTH}>
          <Panel label="만복의 근원 하나님">
            <PanelHeader>
              <PanelTitle title="만복의 근원 하나님" />
              <PanelActions>
                <Button>버리기</Button>
                <Button variant="primary">저장</Button>
              </PanelActions>
            </PanelHeader>
          </Panel>
        </SpecItem>
      </SpecGroup>
    </Section>
  );
}
