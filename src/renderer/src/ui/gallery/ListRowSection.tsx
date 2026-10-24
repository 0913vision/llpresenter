import type {JSX, ReactNode} from 'react';
import {IconButton} from '../IconButton';
import {
  ListActionRow,
  ListBox,
  ListDragGhost,
  ListGroup,
  ListInsertLine,
  ListRow,
  ListSlot,
} from '../ListRow';
import {Panel, PanelBody} from '../Panel';
import {Section, SpecGroup, SpecItem, Stateful, type SpecPin} from './Spec';

const PANEL_WIDTH = 280;

function OneRowList({
  selected,
  children,
}: {
  readonly selected?: string | undefined;
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <ListBox label="목록" selected={selected} onSelect={() => {}}>
      {children}
    </ListBox>
  );
}

interface RowState {
  readonly label: string;
  readonly pin?: SpecPin;
}

const rowStates: readonly RowState[] = [
  {label: 'Default'},
  {label: 'Hover', pin: 'hover'},
  {label: 'Pressed', pin: 'pressed'},
  {label: 'Focus', pin: 'focus'},
];

export function ListRowSection(): JSX.Element {
  return (
    <Section title="ListRow">
      <SpecGroup
        title="One line 30px: icon 16 + name 13 + extra info 11 on the right"
        surface="panel"
      >
        {rowStates.map(state => (
          <SpecItem
            key={state.label}
            label={state.label}
            pin={state.pin}
            width={PANEL_WIDTH}
          >
            <OneRowList>
              <ListRow
                value="hymn"
                icon="song"
                title="내 주를 가까이 하게 함은"
                meta="5장"
              />
            </OneRowList>
          </SpecItem>
        ))}
        <SpecItem label="Selected" width={PANEL_WIDTH}>
          <OneRowList selected="hymn">
            <ListRow
              value="hymn"
              icon="song"
              title="만복의 근원 하나님"
              meta="9장"
            />
          </OneRowList>
        </SpecItem>
        <SpecItem label="Disabled" width={PANEL_WIDTH}>
          <OneRowList>
            <ListRow
              value="verse"
              icon="book"
              title="요한복음 3장 16절"
              meta="2장"
              disabled
              reason="역본 파일을 찾을 수 없습니다"
            />
          </OneRowList>
        </SpecItem>
      </SpecGroup>
      <SpecGroup title="Live and other states" surface="panel">
        <SpecItem label="Live, selected" width={PANEL_WIDTH}>
          <OneRowList selected="hymn">
            <ListRow value="hymn" icon="song" title="만복의 근원 하나님" live />
          </OneRowList>
        </SpecItem>
        <SpecItem label="Live, another row selected" width={PANEL_WIDTH}>
          <OneRowList selected="other">
            <ListRow value="hymn" icon="song" title="만복의 근원 하나님" live />
          </OneRowList>
        </SpecItem>
        <SpecItem label="Past item (진행)" width={PANEL_WIDTH}>
          <OneRowList>
            <ListRow value="past" icon="song" title="이 세상 험하고" done />
          </OneRowList>
        </SpecItem>
        <SpecItem label="Missing media file + live" width={PANEL_WIDTH}>
          <OneRowList selected="hymn">
            <ListRow
              value="hymn"
              icon="song"
              title="만복의 근원 하나님"
              live
              warning="미디어 파일 없음"
            />
          </OneRowList>
        </SpecItem>
        <SpecItem label="퀵 실행 on (showing now)" width={PANEL_WIDTH}>
          <ListActionRow
            icon="prop"
            title="로고 화면"
            pressed
            onPress={() => {}}
          />
        </SpecItem>
        <SpecItem label="Empty slot" width={PANEL_WIDTH}>
          <ListSlot icon="song" label="찬양" />
        </SpecItem>
      </SpecGroup>
      <SpecGroup
        title="List in a panel: group header 11px 600, padding 10 14 5"
        alignTop
      >
        <SpecItem label="진행 (past items, live)" width={PANEL_WIDTH}>
          <Panel label="예배 순서">
            <PanelBody variant="list">
              <Stateful<string> initial="hymn1">
                {(selected, setSelected) => (
                  <ListBox
                    label="예배 순서"
                    selected={selected}
                    onSelect={setSelected}
                  >
                    <ListGroup label="예배 전">
                      <ListRow
                        value="count"
                        icon="film"
                        title="예배 전 카운트다운"
                        done
                      />
                      <ListRow
                        value="notice"
                        icon="notice"
                        title="주일 광고"
                        done
                      />
                    </ListGroup>
                    <ListGroup label="찬양">
                      <ListRow
                        value="hymn0"
                        icon="song"
                        title="이 세상 험하고"
                        done
                      />
                      <ListRow
                        value="hymn1"
                        icon="song"
                        title="만복의 근원 하나님"
                        live
                      />
                      <ListRow
                        value="hymn2"
                        icon="song"
                        title="내 주를 가까이 하게 함은"
                        meta="5장"
                        end={<IconButton icon="x" label="내리기" />}
                      />
                    </ListGroup>
                  </ListBox>
                )}
              </Stateful>
            </PanelBody>
          </Panel>
        </SpecItem>
        <SpecItem
          label="퀵 실행 (로고 화면 on, 검은 화면 hover)"
          width={PANEL_WIDTH}
        >
          <Panel label="퀵 실행">
            <PanelBody variant="list">
              <Stateful<boolean> initial>
                {(logo, setLogo) => (
                  <>
                    <ListActionRow
                      icon="monitor"
                      title="검은 화면"
                      onPress={() => {}}
                    />
                    <ListActionRow
                      icon="prop"
                      title="로고 화면"
                      pressed={logo}
                      onPress={() => setLogo(!logo)}
                    />
                    <ListActionRow
                      icon="timer"
                      title="시작 카운트다운"
                      pressed={false}
                      onPress={() => {}}
                    />
                  </>
                )}
              </Stateful>
            </PanelBody>
          </Panel>
        </SpecItem>
        <SpecItem
          label="List in a dialog: two lines 44px, empty slot"
          width={260}
        >
          <Stateful<string> initial="sunday">
            {(selected, setSelected) => (
              <ListBox
                label="틀"
                selected={selected}
                onSelect={setSelected}
                inset
              >
                <ListGroup label="틀">
                  <ListRow
                    value="sunday"
                    icon="frame"
                    title="주일 예배"
                    sub={['항목 12개']}
                  />
                </ListGroup>
                <ListGroup label="지난 예배">
                  <ListRow
                    value="last"
                    icon="cal"
                    title="주일 예배"
                    sub={['10월 25일 일요일', '항목 12개']}
                  />
                </ListGroup>
              </ListBox>
            )}
          </Stateful>
        </SpecItem>
      </SpecGroup>
      <SpecGroup
        title="Drag and drop: drop position 2px accent + 8px ring dot, drag ghost row"
        surface="panel"
      >
        <SpecItem label="Drop position between rows" width={PANEL_WIDTH}>
          <div>
            <ListBox label="예배 순서" selected={undefined} onSelect={() => {}}>
              <ListRow value="a" icon="song" title="만복의 근원 하나님" />
              <ListInsertLine />
              <ListRow value="b" icon="song" title="내 주를 가까이 하게 함은" />
            </ListBox>
          </div>
        </SpecItem>
        <SpecItem label="Drag ghost row">
          <ListDragGhost
            icon="song"
            title="주 하나님 지으신 모든 세계"
            adding
          />
        </SpecItem>
      </SpecGroup>
    </Section>
  );
}
