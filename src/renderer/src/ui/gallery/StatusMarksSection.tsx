import type {JSX} from 'react';
import dawnSky from '../../../../../design/system/upload/Media/dawn-sky.jpg';
import {MediaGrid, MediaTile} from '../MediaTile';
import {OutputToggle} from '../OutputToggle';
import {
  CountBadge,
  LiveBadge,
  Progress,
  StatusDot,
  type DotTone,
} from '../StatusMarks';
import {ignore, Section, SpecGroup, SpecItem} from './Spec';
import styles from './StatusMarksSection.module.css';

const tones: readonly DotTone[] = ['ok', 'warning', 'live', 'off'];
const PROGRESS_WIDTH = 200;
const STATUS_BAR_WIDTH = 420;
const COPY_PERCENT = 62;

export function StatusMarksSection(): JSX.Element {
  return (
    <Section title="StatusMarks">
      <SpecGroup title="LIVE badge, ll-badge ll-badge--live">
        <SpecItem label="22px badge, 14/20 micro, live">
          <LiveBadge />
        </SpecItem>
      </SpecGroup>
      <SpecGroup title="Status dot, ll-dot 6px">
        {tones.map(tone => (
          <SpecItem key={tone} label={tone}>
            <StatusDot tone={tone} />
          </SpecItem>
        ))}
        <SpecItem label="On an icon, --cut">
          <OutputToggle
            icon="mplay"
            label="본 화면"
            target="모니터 2"
            state="live"
            onToggle={ignore}
          />
        </SpecItem>
        <SpecItem label="Output off">
          <OutputToggle
            icon="capture"
            label="방송 자막"
            target="NDI"
            state="off"
            onToggle={ignore}
          />
        </SpecItem>
        <SpecItem label="Status bar" width={STATUS_BAR_WIDTH}>
          <div className={styles.statusBar}>
            <span>
              <StatusDot tone="ok" />본 화면 60fps
            </span>
            <span className={styles.warn}>
              <StatusDot tone="warning" />
              무대 화면
            </span>
            <span>
              <StatusDot tone="ok" />
              방송 자막 60fps
            </span>
          </div>
        </SpecItem>
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
        <SpecItem label="Zero, hidden">
          <CountBadge value={0} />
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
        <SpecItem label="Inside a media tile" width={PROGRESS_WIDTH}>
          <MediaGrid
            label="미디어"
            columns={1}
            selected={undefined}
            onSelect={ignore}
            onActivate={ignore}
            onOutput={ignore}
          >
            <MediaTile
              name="부활절 배경.mp4"
              picture={dawnSky}
              copying={COPY_PERCENT}
            />
          </MediaGrid>
        </SpecItem>
      </SpecGroup>
    </Section>
  );
}
