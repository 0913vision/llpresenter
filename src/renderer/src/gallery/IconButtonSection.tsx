import type {JSX} from 'react';
import {IconButton} from '../ui/IconButton';
import {ListBox, ListRow} from '../ui/ListRow';
import {Panel, PanelActions, PanelHeader, PanelTabs} from '../ui/Panel';
import styles from './IconButtonSection.module.css';
import {ignore, Section, SpecGroup, SpecItem, Stateful} from './Spec';

const LEFT_COLUMN_WIDTH = 280;
const TOOLS_PANEL_WIDTH = 220;
const DIALOG_HEADER_WIDTH = 300;
// NOTE(0913vision): 내리기 comes after the tab, 항목 추가, and the row.
const TAKE_DOWN_INDEX = 3;

function HeaderTab({label}: {readonly label: string}): JSX.Element {
  return (
    <PanelTabs tabs={[{value: label, label}]} value={label} onChange={ignore} />
  );
}

export function IconButtonSection(): JSX.Element {
  return (
    <Section title="IconButton">
      <SpecGroup title="sm 26×26, icon 16, in a panel" surface="panel">
        <SpecItem label="Default">
          <IconButton icon="plus" label="항목 추가" />
        </SpecItem>
        <SpecItem label="Hover" pin="hover">
          <IconButton icon="plus" label="항목 추가" />
        </SpecItem>
        <SpecItem label="Pressed" pin="pressed">
          <IconButton icon="plus" label="항목 추가" />
        </SpecItem>
        <SpecItem label="Focus" pin="focus">
          <IconButton icon="plus" label="항목 추가" />
        </SpecItem>
        <SpecItem label="Disabled">
          <IconButton icon="plus" label="항목 추가" disabled />
        </SpecItem>
        <SpecItem label="Off">
          <Stateful<boolean> initial={false}>
            {(pressed, setPressed) => (
              <IconButton
                icon="loop"
                label="반복"
                pressed={pressed}
                onPressedChange={setPressed}
              />
            )}
          </Stateful>
        </SpecItem>
        <SpecItem label="On">
          <IconButton icon="loop" label="반복" pressed />
        </SpecItem>
        <SpecItem label="On + hover" pin="hover">
          <IconButton icon="loop" label="반복" pressed />
        </SpecItem>
        <SpecItem label="Menu open">
          <IconButton icon="more" label="메뉴" menu expanded />
        </SpecItem>
      </SpecGroup>
      <SpecGroup title="md 30×30, icon 16, dialog header" surface="dialog">
        <SpecItem label="Default">
          <IconButton icon="x" label="닫기" size="md" shortcut="Esc" />
        </SpecItem>
        <SpecItem label="Hover" pin="hover">
          <IconButton icon="x" label="닫기" size="md" shortcut="Esc" />
        </SpecItem>
        <SpecItem label="Pressed" pin="pressed">
          <IconButton icon="x" label="닫기" size="md" shortcut="Esc" />
        </SpecItem>
        <SpecItem label="Focus" pin="focus">
          <IconButton icon="x" label="닫기" size="md" shortcut="Esc" />
        </SpecItem>
        <SpecItem label="Disabled">
          <IconButton icon="x" label="닫기" size="md" disabled />
        </SpecItem>
      </SpecGroup>
      <SpecGroup>
        <SpecItem
          label="Panel header +, 내리기 at row end (hover)"
          pin="hover"
          pinIndex={TAKE_DOWN_INDEX}
          width={LEFT_COLUMN_WIDTH}
        >
          <Panel label="예배 순서">
            <PanelHeader>
              <HeaderTab label="예배 순서" />
              <PanelActions>
                <IconButton icon="plus" label="항목 추가" />
              </PanelActions>
            </PanelHeader>
            <ListBox label="표시 중" selected={undefined} onSelect={ignore}>
              <ListRow
                value="message"
                icon="msg"
                title="12가 3456 차량 이동 부탁드립니다"
                end={<IconButton icon="x" label="내리기" />}
              />
            </ListBox>
          </Panel>
        </SpecItem>
        <SpecItem
          label="On/off tools, 비율 고정 off, 격자에 맞추기 on"
          width={TOOLS_PANEL_WIDTH}
        >
          <Panel label="무대 배치">
            <PanelHeader>
              <HeaderTab label="무대 배치" />
              <PanelActions>
                <Stateful<boolean> initial={false}>
                  {(pressed, setPressed) => (
                    <IconButton
                      icon="lock"
                      label="비율 고정"
                      pressed={pressed}
                      onPressedChange={setPressed}
                    />
                  )}
                </Stateful>
                <Stateful<boolean> initial>
                  {(pressed, setPressed) => (
                    <IconButton
                      icon="grid"
                      label="격자에 맞추기"
                      pressed={pressed}
                      onPressedChange={setPressed}
                    />
                  )}
                </Stateful>
              </PanelActions>
            </PanelHeader>
            <div className={styles.emptyRow} />
          </Panel>
        </SpecItem>
        <SpecItem label="Dialog close, md" width={DIALOG_HEADER_WIDTH}>
          <div className={styles.dialogHeader}>
            다른 예배에서 가져오기
            <IconButton
              icon="x"
              label="닫기"
              size="md"
              shortcut="Esc"
              className={styles.headerEnd}
            />
          </div>
        </SpecItem>
      </SpecGroup>
    </Section>
  );
}
