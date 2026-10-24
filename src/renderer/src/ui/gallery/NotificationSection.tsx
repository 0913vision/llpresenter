import type {JSX} from 'react';
import {NotificationCard} from '../Notification';
import type {Notice} from '../notices';
import {ignore, Section, SpecGroup, SpecItem} from './Spec';

const REGULAR_WIDTH = 480;
const NARROW_WIDTH = 360;

const lost: Notice = {
  key: 'screen:stage',
  kind: 'warning',
  icon: 'plug',
  title: '무대 모니터 연결 끊김',
  time: '11:24',
  meta: ['모니터 3', '창으로 표시 중'],
  actions: [
    {icon: 'refresh', label: '모니터 다시 찾기', onSelect: ignore},
    {icon: 'open', label: '창 보기', onSelect: ignore},
  ],
};

const back: Notice = {
  key: 'screen:stage-back',
  kind: 'info',
  icon: 'monitor',
  title: '무대 모니터 다시 연결됨',
  time: '11:26',
  meta: ['모니터 3'],
};

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
    </Section>
  );
}
