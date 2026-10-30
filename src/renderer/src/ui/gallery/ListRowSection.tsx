import {Fragment, useState, type JSX, type ReactNode} from 'react';
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
import {
  Panel,
  PanelActions,
  PanelBody,
  PanelHeader,
  PanelSwitch,
  PanelTabs,
  PanelTools,
} from '../Panel';
import {TextField} from '../TextField';
import {
  ignore,
  Section,
  SpecGroup,
  SpecItem,
  Stateful,
  type SpecPin,
} from './Spec';

const PANEL_WIDTH = 280;
const LIST_PANEL_WIDTH = 296;
// NOTE(0913vision): 검은 화면 comes after the tab, the add button, the verse
// field, and two rows.
const QUICK_HOVER_INDEX = 5;

function OneRowList({
  selected,
  children,
}: {
  readonly selected?: string | undefined;
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <ListBox label="목록" selected={selected} onSelect={ignore}>
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

interface CountedRow {
  readonly value: string;
  readonly icon: string;
  readonly title: string;
  readonly meta: string;
}

interface CountedGroup {
  readonly label: string;
  readonly rows: readonly CountedRow[];
}

const prepService: readonly CountedGroup[] = [
  {
    label: '예배 전',
    rows: [
      {value: 'count', icon: 'film', title: '예배 전 카운트다운', meta: '5:00'},
      {
        value: 'notice',
        icon: 'notice',
        title: '주일 광고',
        meta: '슬라이드 6개',
      },
    ],
  },
  {
    label: '찬양',
    rows: [
      {
        value: 'hymn0',
        icon: 'song',
        title: '이 세상 험하고',
        meta: '슬라이드 6개',
      },
      {
        value: 'hymn1',
        icon: 'song',
        title: '만복의 근원 하나님',
        meta: '슬라이드 9개',
      },
      {
        value: 'hymn2',
        icon: 'song',
        title: '내 주를 가까이 하게 함은',
        meta: '슬라이드 5개',
      },
    ],
  },
  {
    label: '말씀',
    rows: [
      {
        value: 'word',
        icon: 'book',
        title: '요한복음 3장 16절',
        meta: '슬라이드 2개',
      },
      {value: 'sermon', icon: 'slides', title: '설교', meta: '슬라이드 12개'},
    ],
  },
];

const mediaLists: readonly CountedGroup[] = [
  {
    label: '보관함',
    rows: [{value: 'all', icon: 'grid', title: '모든 미디어', meta: '42'}],
  },
  {
    label: '재생목록',
    rows: [
      {value: 'backgrounds', icon: 'film', title: '배경 영상', meta: '7'},
      {value: 'loops', icon: 'film', title: '예배 전 반복', meta: '4'},
      {value: 'notices', icon: 'image', title: '광고 이미지', meta: '6'},
      {value: 'sermons', icon: 'image', title: '설교 이미지', meta: '8'},
    ],
  },
];

const DROP_AFTER = 'hymn2';
// NOTE(0913vision): Where the card draws the ghost row over the list, as if
// the pointer held it there.
const GHOST_PLACE = {position: 'absolute', left: 44, top: 166} as const;

function CountedList({
  label,
  groups,
  selected,
  dropAfter,
}: {
  readonly label: string;
  readonly groups: readonly CountedGroup[];
  readonly selected: string | undefined;
  readonly dropAfter?: string | undefined;
}): JSX.Element {
  return (
    <ListBox label={label} selected={selected} onSelect={ignore}>
      {groups.map(group => (
        <ListGroup key={group.label} label={group.label}>
          {group.rows.map(row => (
            <Fragment key={row.value}>
              <ListRow
                value={row.value}
                icon={row.icon}
                title={row.title}
                meta={row.meta}
              />
              {row.value === dropAfter ? <ListInsertLine /> : null}
            </Fragment>
          ))}
        </ListGroup>
      ))}
    </ListBox>
  );
}

function ListPanel({
  tab,
  end,
  tools,
  children,
}: {
  readonly tab: string;
  readonly end: ReactNode;
  readonly tools?: ReactNode;
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <Panel label={tab}>
      <PanelHeader>
        <PanelTabs
          tabs={[{value: tab, label: tab}]}
          value={tab}
          onChange={ignore}
        />
        {end}
      </PanelHeader>
      {tools === undefined ? null : <PanelTools>{tools}</PanelTools>}
      <PanelBody variant="list">{children}</PanelBody>
    </Panel>
  );
}

function ServiceOrderPanel({
  children,
}: {
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <ListPanel
      tab="예배 순서"
      end={
        <PanelSwitch
          value="주일 예배"
          expanded={false}
          onExpandedChange={ignore}
        />
      }
    >
      {children}
    </ListPanel>
  );
}

function AddAction({label}: {readonly label: string}): JSX.Element {
  return (
    <PanelActions>
      <IconButton icon="plus" label={label} />
    </PanelActions>
  );
}

function SectionTargets(): JSX.Element {
  const [selected, setSelected] = useState<string>('empty');
  return (
    <ListBox label="구역 선택" selected={selected} onSelect={setSelected}>
      <ListGroup label="빈 구역" value="empty">
        {null}
      </ListGroup>
      <ListGroup label="찬양" value="praise">
        <ListRow title="함께 걷는 길" value="song" icon="song" />
      </ListGroup>
      <ListGroup label="마지막 구역" value="last">
        {null}
      </ListGroup>
    </ListBox>
  );
}

export function ListRowSection(): JSX.Element {
  return (
    <Section title="ListRow">
      <SpecGroup
        title="Selectable sections, including empty sections"
        surface="panel"
      >
        <SpecItem
          label="Click or use arrows to choose the insertion section"
          width={360}
        >
          <SectionTargets />
        </SpecItem>
      </SpecGroup>
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
                meta="슬라이드 5개"
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
              meta="슬라이드 9개"
            />
          </OneRowList>
        </SpecItem>
        <SpecItem label="Disabled" width={PANEL_WIDTH}>
          <OneRowList>
            <ListRow
              value="verse"
              icon="book"
              title="요한복음 3장 16절"
              meta="슬라이드 2개"
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
            onPress={ignore}
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
        <SpecItem label="준비 (counts)" width={LIST_PANEL_WIDTH}>
          <ServiceOrderPanel>
            <CountedList
              label="예배 순서"
              groups={prepService}
              selected="hymn1"
            />
          </ServiceOrderPanel>
        </SpecItem>
        <SpecItem label="진행 (past items, live)" width={LIST_PANEL_WIDTH}>
          <ServiceOrderPanel>
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
                    />
                  </ListGroup>
                  <ListGroup label="말씀">
                    <ListRow
                      value="word"
                      icon="book"
                      title="요한복음 3장 16절"
                    />
                    <ListRow value="sermon" icon="slides" title="설교" />
                  </ListGroup>
                </ListBox>
              )}
            </Stateful>
          </ServiceOrderPanel>
        </SpecItem>
        <SpecItem
          label="퀵 실행 (로고 화면 on, 검은 화면 hover)"
          pin="hover"
          pinIndex={QUICK_HOVER_INDEX}
          width={LIST_PANEL_WIDTH}
        >
          <ListPanel
            tab="퀵 실행"
            end={<AddAction label="퀵 실행 추가" />}
            tools={
              <Stateful<string> initial="">
                {(verse, setVerse) => (
                  <TextField
                    aria-label="성경 구절"
                    icon="book"
                    placeholder="요 3:16, 창 1:1-5"
                    value={verse}
                    onChange={setVerse}
                  />
                )}
              </Stateful>
            }
          >
            <Stateful<boolean> initial>
              {(logo, setLogo) => (
                <>
                  <ListActionRow
                    icon="book"
                    title="요한복음 3장 16절"
                    onPress={ignore}
                  />
                  <ListActionRow
                    icon="song"
                    title="주 하나님 지으신 모든 세계"
                    onPress={ignore}
                  />
                  <ListActionRow
                    icon="monitor"
                    title="검은 화면"
                    onPress={ignore}
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
                    onPress={ignore}
                  />
                  <ListActionRow icon="slides" title="축도" onPress={ignore} />
                </>
              )}
            </Stateful>
          </ListPanel>
        </SpecItem>
        <SpecItem
          label="List in a dialog: two lines 44px, empty slot"
          width={260}
        >
          <Stateful<string> initial="sunday">
            {(selected, setSelected) => (
              <ListBox
                label="템플릿"
                selected={selected}
                onSelect={setSelected}
                inset
              >
                <ListGroup label="템플릿">
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
        <SpecItem
          label="Dragged from the library, dropped after '내 주를 가까이 하게 함은'"
          width={LIST_PANEL_WIDTH}
        >
          <div style={{position: 'relative'}}>
            <ServiceOrderPanel>
              <CountedList
                label="예배 순서"
                groups={prepService.slice(1)}
                selected="hymn1"
                dropAfter={DROP_AFTER}
              />
            </ServiceOrderPanel>
            <div style={GHOST_PLACE}>
              <ListDragGhost
                icon="song"
                title="주 하나님 지으신 모든 세계"
                adding
              />
            </div>
          </div>
        </SpecItem>
        <SpecItem label="Media list" width={LIST_PANEL_WIDTH}>
          <ListPanel tab="미디어" end={<AddAction label="재생목록 추가" />}>
            <CountedList
              label="미디어"
              groups={mediaLists}
              selected="backgrounds"
            />
          </ListPanel>
        </SpecItem>
      </SpecGroup>
    </Section>
  );
}
