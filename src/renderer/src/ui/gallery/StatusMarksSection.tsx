import type {JSX} from 'react';
import {
  CountBadge,
  LiveBadge,
  Progress,
  StatusDot,
  type DotTone,
} from '../StatusMarks';
import {Section, SpecGroup, SpecItem} from './Spec';

const tones: readonly DotTone[] = ['ok', 'warning', 'live', 'off'];
const PROGRESS_WIDTH = 200;

export function StatusMarksSection(): JSX.Element {
  return (
    <Section title="StatusMarks">
      <SpecGroup title="LIVE badge, ll-badge ll-badge--live">
        <SpecItem label="16, micro, live">
          <LiveBadge />
        </SpecItem>
      </SpecGroup>
      <SpecGroup title="Status dot, ll-dot 6px">
        {tones.map(tone => (
          <SpecItem key={tone} label={tone}>
            <StatusDot tone={tone} />
          </SpecItem>
        ))}
      </SpecGroup>
      <SpecGroup title="Count badge, ll-count 18">
        <SpecItem label="One digit">
          <CountBadge value={3} />
        </SpecItem>
        <SpecItem label="Two digits">
          <CountBadge value={12} />
        </SpecItem>
        <SpecItem label="Above 99">
          <CountBadge value={140} />
        </SpecItem>
      </SpecGroup>
      <SpecGroup title="Progress bar, ll-progress 4, bar width %">
        <SpecItem label="0%" width={PROGRESS_WIDTH}>
          <Progress value={0} label="부활절 배경.mp4 복사" />
        </SpecItem>
        <SpecItem label="62%, copying (accent)" width={PROGRESS_WIDTH}>
          <Progress value={62} label="부활절 배경.mp4 복사" />
        </SpecItem>
        <SpecItem label="100%" width={PROGRESS_WIDTH}>
          <Progress value={100} label="부활절 배경.mp4 복사" />
        </SpecItem>
        <SpecItem
          label="Playback position, --playback (text)"
          width={PROGRESS_WIDTH}
        >
          <Progress
            value={38}
            variant="playback"
            label="찬양 반주"
            valueText="1:24 / 3:42"
          />
        </SpecItem>
      </SpecGroup>
    </Section>
  );
}
