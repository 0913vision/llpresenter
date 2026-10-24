import {useState, type JSX} from 'react';
import {Button} from '../Button';
import {NotificationCard, NotificationStack} from '../Notification';
import {
  addNotice,
  removeNotice,
  type Notice,
  type NoticeAction,
} from '../notices';
import {ignore, Section, SpecGroup, SpecItem} from './Spec';

const REGULAR_WIDTH = 480;
const NARROW_WIDTH = 360;

const monitorActions: readonly NoticeAction[] = [
  {icon: 'refresh', label: '모니터 다시 찾기', onSelect: ignore},
  {icon: 'open', label: '창 보기', onSelect: ignore},
];

const lost: Notice = {
  key: 'screen:stage',
  kind: 'warning',
  icon: 'plug',
  title: '무대 모니터 연결 끊김',
  time: '11:24',
  meta: ['모니터 3', '창으로 표시 중'],
  actions: monitorActions,
};

const back: Notice = {
  key: 'screen:stage',
  kind: 'info',
  icon: 'monitor',
  title: '무대 모니터 다시 연결됨',
  time: '11:26',
  meta: ['모니터 3'],
};

const mainBack: Notice = {
  key: 'screen:main',
  kind: 'info',
  icon: 'monitor',
  title: '본 화면 모니터 다시 연결됨',
  time: '11:25',
  meta: ['모니터 2'],
};

const stackStart: readonly Notice[] = [mainBack, lost];

// NOTE(0913vision): In this order the stack shows a card replaced by its
// cause, then the oldest information card closing at the fourth card.
const arrivals: readonly Notice[] = [
  back,
  {
    key: 'file:song',
    kind: 'warning',
    icon: 'filex',
    title: '파일을 읽을 수 없음',
    time: '11:27',
    meta: ['이 세상 험하고', '건너뜀'],
  },
  {
    key: 'screen:main',
    kind: 'warning',
    icon: 'plug',
    title: '본 화면 모니터 연결 끊김',
    time: '11:28',
    meta: ['모니터 2', '창으로 표시 중'],
    actions: monitorActions,
  },
  {
    key: 'save',
    kind: 'warning',
    icon: 'warning',
    title: '저장할 수 없음',
    time: '11:29',
    actions: [{icon: 'refresh', label: '다시 시도', onSelect: ignore}],
  },
];

function StackDemo(): JSX.Element {
  const [notices, setNotices] = useState<readonly Notice[]>([]);
  const [arrived, setArrived] = useState(0);
  const next = arrivals.at(arrived);
  const open = (): void => {
    setNotices(stackStart);
    setArrived(0);
  };
  const add = (): void => {
    if (next === undefined) return;
    setNotices(current => addNotice(current, next));
    setArrived(count => count + 1);
  };
  if (notices.length === 0) return <Button onClick={open}>알림 쌓기</Button>;
  return (
    <>
      <Button disabled={next === undefined} onClick={add}>
        다음 알림
      </Button>
      <Button onClick={() => setNotices([])}>모두 닫기</Button>
      <NotificationStack
        notices={notices}
        onClose={key => setNotices(current => removeNotice(current, key))}
      />
    </>
  );
}

export function NotificationSection(): JSX.Element {
  return (
    <Section title="Notification">
      <SpecGroup
        title="Card: right column width (480, narrow window 360), bg-raised, radius-2xl, padding 12 8 12 14"
        alignTop
      >
        <SpecItem
          label="Warning: stays until resolved (lost monitor)"
          width={REGULAR_WIDTH}
        >
          <NotificationCard notice={lost} onClose={ignore} />
        </SpecItem>
        <SpecItem
          label="Information: closes after 6 seconds (narrow window width 360)"
          width={NARROW_WIDTH}
        >
          <NotificationCard notice={back} onClose={ignore} />
        </SpecItem>
      </SpecGroup>
      <SpecGroup title="States" alignTop>
        <SpecItem
          label="Action focus, action and close hover"
          pin="focus"
          width={REGULAR_WIDTH}
        >
          <NotificationCard notice={lost} onClose={ignore} />
        </SpecItem>
        <SpecItem label="Close focus" pin="focus" width={NARROW_WIDTH}>
          <NotificationCard notice={back} onClose={ignore} />
        </SpecItem>
      </SpecGroup>
      <SpecGroup title="Stacking: newest on top, 4px apart, up to 3">
        <SpecItem label="In the window's top right, under the toolbar">
          <StackDemo />
        </SpecItem>
      </SpecGroup>
    </Section>
  );
}
