import {useMemo, useState, type JSX} from 'react';
import {useLive} from '@renderer/state/live';
import {
  Button,
  Panel,
  PanelActions,
  PanelBody,
  PanelHeader,
  PanelTabs,
  SelectMenu,
} from '@renderer/ui';
import type {Notice} from '@renderer/ui/notices';
import {MediaStripTile, type StripEntry} from './MediaStripTile';
import {WindowedMediaStrip} from './WindowedMediaStrip';
import {useMediaStrip} from './useMediaStrip';
import styles from './ShowMediaPanel.module.css';

const ALL_MEDIA = 'all-media';
const IMPORT_UNAVAILABLE = '현재 버전에서는 미디어 파일을 가져올 수 없음';

/** A complete media strip panel; the workspace owns its visibility. */
export function ShowMediaPanel({
  onProblem,
}: {
  readonly onProblem: (notice: Notice) => void;
}): JSX.Element {
  const media = useMediaStrip(onProblem);
  const [playlist, setPlaylist] = useState(ALL_MEDIA);
  const [selected, setSelected] = useState<string | null>(null);
  const liveId = useLive(view => view.state?.layers.media?.mediaId);
  const playlists = media.document?.value.playlists ?? [];
  const chosen = playlists.find(entry => entry.id === playlist);
  const entries = useMemo(() => {
    const items = media.document?.value.items ?? [];
    const byId = new Map(items.map(item => [item.id, item]));
    const chosen = media.document?.value.playlists.find(
      entry => entry.id === playlist,
    );
    const choices = chosen
      ? chosen.items.flatMap(id => byId.get(id) ?? [])
      : items;
    const pending = new Map(media.jobs.map(job => [job.mediaId, job]));
    const entries: StripEntry[] = choices
      .filter(item => item.kind !== 'audio')
      .map(item => ({
        id: item.id,
        kind: 'media',
        item,
        copying: pending.get(item.id)?.percent,
      }));
    if (!chosen) {
      for (const job of media.jobs) {
        if (!byId.has(job.mediaId)) {
          entries.push({id: job.mediaId, kind: 'copy', job});
        }
      }
    }
    return entries;
  }, [media.document, media.jobs, playlist]);
  const current = entries.findIndex(entry => entry.id === selected);
  return (
    <Panel label="미디어" className={styles.panel}>
      <PanelHeader>
        <PanelTabs
          tabs={[{value: 'media', label: '미디어'}]}
          value="media"
          onChange={() => undefined}
        />
        <SelectMenu
          aria-label="미디어 재생 목록"
          size="sm"
          value={chosen?.id ?? ALL_MEDIA}
          onChange={setPlaylist}
          options={[
            {value: ALL_MEDIA, label: '전체 미디어'},
            ...playlists.map(entry => ({
              value: entry.id,
              label: entry.name || '이름 없는 재생 목록',
            })),
          ]}
        />
        <PanelActions>
          <Button icon="upload" disabled title={IMPORT_UNAVAILABLE}>
            가져오기
          </Button>
        </PanelActions>
      </PanelHeader>
      <PanelBody className={styles.body}>
        <WindowedMediaStrip
          count={entries.length}
          selected={current < 0 ? undefined : current}
          onSelect={index => setSelected(entries[index]?.id ?? null)}
          onActivate={index => {
            const entry = entries[index];
            if (entry?.kind === 'media') {
              setSelected(entry.id);
              media.activate(entry.item.id);
            }
          }}
          isVideo={index => {
            const entry = entries[index];
            return (
              entry?.kind === 'media' &&
              entry.item.kind === 'video' &&
              entry.copying === undefined &&
              !media.missing.has(entry.item.id)
            );
          }}
          tile={(index, {videoPreview}) => {
            const entry = entries[index];
            return entry ? (
              <MediaStripTile
                key={entry.id}
                entry={entry}
                videoPreview={videoPreview}
                revision={media.document?.revision ?? 0}
                missing={
                  entry.kind === 'media' && media.missing.has(entry.item.id)
                }
                live={liveId === entry.id}
                selected={selected === entry.id}
                onMissing={media.markMissing}
              />
            ) : null;
          }}
        />
      </PanelBody>
    </Panel>
  );
}
