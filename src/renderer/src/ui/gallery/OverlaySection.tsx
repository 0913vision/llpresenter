import {useState, type JSX, type MouseEvent} from 'react';
import {AlertDialog} from '../AlertDialog';
import {Button} from '../Button';
import {CheckRow} from '../Checkbox';
import {Dialog, DialogBox, DialogField} from '../Dialog';
import {IconButton} from '../IconButton';
import {ListBox, ListGroup, ListRow} from '../ListRow';
import {Menu, type MenuAnchor} from '../Menu';
import type {MenuEntry} from '../menuModel';
import {SelectMenu} from '../SelectMenu';
import {SegmentedControl} from '../SegmentedControl';
import {Switch} from '../Switch';
import {TextField} from '../TextField';
import {Tooltip} from '../Tooltip';
import {ignore, Section, SpecGroup, SpecItem, Stateful} from './Spec';

const fileMenu: readonly MenuEntry[] = [
  {kind: 'item', id: 'new', label: '새 예배', meta: 'Ctrl N'},
  {kind: 'item', id: 'open', label: '예배 열기', meta: 'Ctrl O'},
  {
    kind: 'item',
    id: 'import',
    label: '가져오기',
    submenu: [
      {kind: 'item', id: 'text', label: '텍스트 파일', icon: 'filetext'},
      {kind: 'item', id: 'clip', label: '클립보드 텍스트', icon: 'copy'},
      {
        kind: 'item',
        id: 'ppt',
        label: 'PowerPoint 파일',
        icon: 'fileppt',
        disabled: true,
        title: '아직 지원하지 않습니다',
      },
    ],
  },
  {kind: 'separator', id: 'sep'},
  {kind: 'item', id: 'prefs', label: '환경설정', meta: 'Ctrl ,'},
];

const services = ['주일 예배', '수요 예배', '금요 기도회', '새벽 예배'];

function serviceEntries(query: string, current: string): readonly MenuEntry[] {
  return [
    {kind: 'group', id: 'recent', label: '최근 예배'},
    ...services
      .filter(name => name.includes(query))
      .map((name): MenuEntry => ({
        kind: 'item',
        id: name,
        label: name,
        check: 'radio',
        checked: name === current,
        meta: '10월 25일',
      })),
    {kind: 'separator', id: 'sep'},
    {kind: 'item', id: 'new', label: '새 예배', icon: 'plus'},
  ];
}

const macroMenu: readonly MenuEntry[] = [
  {kind: 'item', id: 'run', label: '실행'},
  {kind: 'item', id: 'rename', label: '이름 바꾸기'},
  {kind: 'separator', id: 'sep'},
  {kind: 'item', id: 'delete', label: '삭제', danger: true},
];

function MenuButton({
  label,
  entries,
}: {
  readonly label: string;
  readonly entries: readonly MenuEntry[];
}): JSX.Element {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        ref={setAnchor}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      {open && anchor !== null ? (
        <Menu
          label={label}
          entries={entries}
          anchor={{kind: 'element', element: anchor}}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function ServicePicker(): JSX.Element {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [current, setCurrent] = useState('주일 예배');
  return (
    <>
      <Button ref={setAnchor} onClick={() => setOpen(true)}>
        {current}
      </Button>
      {open && anchor !== null ? (
        <Menu
          label="예배 순서"
          width={300}
          entries={serviceEntries(query, current).map(entry =>
            entry.kind === 'item' && entry.check === 'radio'
              ? {...entry, onSelect: () => setCurrent(entry.label)}
              : entry,
          )}
          search={{value: query, onChange: setQuery}}
          anchor={{kind: 'element', element: anchor}}
          onClose={() => {
            setOpen(false);
            setQuery('');
          }}
        />
      ) : null}
    </>
  );
}

const CONTEXT_AREA_HEIGHT = 80;
const CONTEXT_AREA_WIDTH = 240;

function ContextArea(): JSX.Element {
  const [anchor, setAnchor] = useState<MenuAnchor | null>(null);
  const openAt = (event: MouseEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setAnchor({kind: 'point', point: {x: event.clientX, y: event.clientY}});
  };
  return (
    <>
      <div
        role="button"
        tabIndex={0}
        style={{
          width: CONTEXT_AREA_WIDTH,
          height: CONTEXT_AREA_HEIGHT,
          borderRadius: 'var(--radius-tile)',
          background: 'var(--label-teal)',
          color: 'var(--text-on-label)',
          padding: 'var(--space-10)',
        }}
        onContextMenu={openAt}
      >
        찬양
      </div>
      {anchor === null ? null : (
        <Menu
          label="매크로"
          width={240}
          entries={macroMenu}
          anchor={anchor}
          onClose={() => setAnchor(null)}
        />
      )}
    </>
  );
}

function NewServiceDialog({
  onClose,
}: {
  readonly onClose: () => void;
}): JSX.Element {
  const [name, setName] = useState('주일 예배');
  return (
    <Dialog
      title="새 예배"
      size="l"
      height={700}
      onCancel={onClose}
      primary={{
        label: '만들기',
        onSelect: onClose,
        disabled: name === '',
        title: '이름을 적어야 만들 수 있습니다',
      }}
      aside={
        <ListBox label="틀" selected="sunday" onSelect={ignore} inset>
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
      }
      asideFoot={
        <Button variant="ghost" icon="plus">
          지금 예배를 틀로 저장
        </Button>
      }
      bottomBar={
        <DialogField label="이름">
          <TextField aria-label="이름" value={name} onChange={setName} />
        </DialogField>
      }
    >
      <DialogBox
        title="예배 순서"
        meta="항목 3개"
        checkAll={{checked: 'mixed', onChange: ignore}}
      >
        <CheckRow
          variant="list"
          icon="song"
          label="만복의 근원 하나님"
          meta="주일용"
          checked
          onChange={ignore}
        />
        <CheckRow
          variant="list"
          icon="song"
          label="내 주를 가까이 하게 함은"
          checked={false}
          onChange={ignore}
        />
        <CheckRow
          variant="list"
          icon="notice"
          label="주일 광고"
          checked
          onChange={ignore}
        />
      </DialogBox>
    </Dialog>
  );
}

function ImportTextDialog({
  onClose,
}: {
  readonly onClose: () => void;
}): JSX.Element {
  return (
    <Dialog
      title="텍스트 가져오기"
      subtitle={{icon: 'filetext', text: '만복의 근원 하나님.txt'}}
      size="xl"
      onCancel={onClose}
      primary={{label: '편집', onSelect: onClose}}
      topBar={
        <>
          <DialogField label="장 나누기">
            <SegmentedControl
              label="장 나누기"
              options={[
                {value: 'blank', label: '빈 줄'},
                {value: 'lines', label: '줄 수'},
              ]}
              value="blank"
              onChange={ignore}
            />
          </DialogField>
          <DialogField label="이름표 인식">
            <Switch checked onChange={ignore} />
          </DialogField>
        </>
      }
    >
      <p>장 미리보기</p>
    </Dialog>
  );
}

function DialogButton({
  label,
  render,
}: {
  readonly label: string;
  readonly render: (close: () => void) => JSX.Element;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>{label}</Button>
      {open ? render(() => setOpen(false)) : null}
    </>
  );
}

export function OverlaySection(): JSX.Element {
  return (
    <Section title="Overlays">
      <SpecGroup title="Tooltip: point at a target for 600ms">
        <SpecItem label="Name only">
          <IconButton icon="plus" label="항목 추가" />
        </SpecItem>
        <SpecItem label="Shortcut">
          <Tooltip text="가사 지우기" shortcut="F2">
            <Button>가사</Button>
          </Tooltip>
        </SpecItem>
        <SpecItem label="Shortcut (combo)">
          <IconButton icon="undo" label="되돌리기" shortcut="Ctrl Z" />
        </SpecItem>
        <SpecItem label="Two lines (error reason + extra info)">
          <Tooltip
            text="라이브러리에 같은 제목의 곡이 있습니다"
            sub="라이브러리 곡 4장, 10월 20일 수정"
          >
            <Button>저장</Button>
          </Tooltip>
        </SpecItem>
        <SpecItem label="Long path wraps at 280">
          <Tooltip text="D:\예배 자료\2026\배경 영상\부활절\따뜻한 빛 (긴 버전).mp4 파일을 찾을 수 없습니다">
            <Button>배경</Button>
          </Tooltip>
        </SpecItem>
        <SpecItem label="Shows on a disabled button too">
          <Button
            variant="primary"
            disabled
            title="곡 제목을 적어야 저장할 수 있습니다"
          >
            저장
          </Button>
        </SpecItem>
      </SpecGroup>
      <SpecGroup title="Menu">
        <SpecItem label="Menu bar menu with a submenu">
          <MenuButton label="파일" entries={fileMenu} />
        </SpecItem>
        <SpecItem label="Service picker (search, check, dates)">
          <ServicePicker />
        </SpecItem>
        <SpecItem label="Right-click menu">
          <ContextArea />
        </SpecItem>
        <SpecItem label="Select list">
          <Stateful<string> initial="one">
            {(value, setValue) => (
              <SelectMenu
                aria-label="자동 백업"
                options={[
                  {value: 'one', label: '1분마다'},
                  {value: 'five', label: '5분마다'},
                  {value: 'ten', label: '10분마다'},
                ]}
                value={value}
                onChange={setValue}
              />
            )}
          </Stateful>
        </SpecItem>
      </SpecGroup>
      <SpecGroup title="Dialog and AlertDialog">
        <SpecItem label="새 예배: dialog-l, two columns, input bar">
          <DialogButton
            label="새 예배"
            render={close => <NewServiceDialog onClose={close} />}
          />
        </SpecItem>
        <SpecItem label="텍스트 가져오기: dialog-xl, option bar">
          <DialogButton
            label="텍스트 가져오기"
            render={close => <ImportTextDialog onClose={close} />}
          />
        </SpecItem>
        <SpecItem label="One question">
          <DialogButton
            label="덮어쓰기 확인"
            render={close => (
              <AlertDialog
                icon="song"
                title="‘만복의 근원 하나님’ 곡이 이미 있습니다. 덮어쓸까요?"
                meta={['라이브러리 곡 4장, 10월 20일 수정']}
                onCancel={close}
                actions={[
                  {label: '새 곡으로 저장', onSelect: close},
                  {label: '덮어쓰기', primary: true, onSelect: close},
                ]}
              />
            )}
          />
        </SpecItem>
        <SpecItem label="With states to pick">
          <DialogButton
            label="출력 상태 복구"
            render={close => (
              <AlertDialog
                icon="history"
                title="출력 상태 복구"
                meta={['비정상 종료', '10월 25일 오전 11:26']}
                actions={[
                  {label: '새로 시작', escape: true, onSelect: close},
                  {label: '복구', primary: true, onSelect: close},
                ]}
                list={{
                  label: '복구할 상태',
                  children: (
                    <>
                      <CheckRow
                        icon="mplay"
                        label="화면 출력"
                        value="본 화면, 무대 화면, 방송 자막"
                        checked
                        onChange={ignore}
                      />
                      <CheckRow
                        icon="slides"
                        label="마지막 장"
                        value="만복의 근원 하나님  2 / 9"
                        checked
                        onChange={ignore}
                      />
                      <CheckRow
                        icon="layers"
                        label="표시 중이던 항목"
                        value="메시지 1, 소품 1, 무대 메시지 1"
                        checked={false}
                        onChange={ignore}
                      />
                    </>
                  ),
                }}
              />
            )}
          />
        </SpecItem>
      </SpecGroup>
    </Section>
  );
}
