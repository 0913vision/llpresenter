import {useState, type JSX} from 'react';
import {IconButton} from '@renderer/ui/IconButton';
import {ListBox, ListGroup, ListRow} from '@renderer/ui/ListRow';
import {
  Panel,
  PanelActions,
  PanelBody,
  PanelHeader,
  PanelTabs,
} from '@renderer/ui/Panel';
import {UNNAMED_PLAYLIST, type MediaListChoice} from './mediaEntries';
import {useMediaView} from './MediaViewProvider';
import styles from './MediaListPanels.module.css';

const ALL = 'all';

function keyOf(choice: MediaListChoice): string {
  return choice.kind === 'all' ? ALL : `${choice.kind}:${choice.id}`;
}

function choiceOf(key: string): MediaListChoice {
  const [kind, id] = key.split(':');
  if (id !== undefined && (kind === 'media' || kind === 'audio')) {
    return {kind, id};
  }
  return {kind: 'all'};
}

function useCreate(kind: 'media' | 'audio') {
  const {library, view, choose} = useMediaView();
  const [creating, setCreating] = useState(false);
  const create = (): void => {
    setCreating(true);
    library
      .createPlaylist(kind)
      .then(id => {
        if (id !== null) choose({kind, id});
      })
      .catch((cause: unknown) => {
        console.error('Creating a playlist failed:', cause);
      })
      .finally(() => {
        setCreating(false);
      });
  };
  const disabled =
    creating || view.document === null || view.document.access === 'readOnly';
  return {create, disabled};
}

/**
 * The 미디어 panel of the media view (spec 05, "Media view"): 보관함 with 모든
 * 미디어, and the 재생목록 group with each playlist and its count. 새 재생목록
 * adds one and shows it.
 */
export function MediaListsPanel(): JSX.Element {
  const {view, choice, choose} = useMediaView();
  const {create, disabled} = useCreate('media');
  const items = view.document?.value.items.length ?? 0;
  const playlists = view.document?.value.playlists ?? [];
  return (
    <Panel label="미디어" className={styles.panel}>
      <PanelHeader>
        <PanelTabs
          tabs={[{value: 'media', label: '미디어'}]}
          value="media"
          onChange={() => undefined}
        />
        <PanelActions>
          <IconButton
            icon="plus"
            label="새 재생목록"
            disabled={disabled}
            onClick={create}
          />
        </PanelActions>
      </PanelHeader>
      <PanelBody tab="media" variant="list">
        <ListBox
          label="미디어 목록"
          selected={choice.kind === 'audio' ? undefined : keyOf(choice)}
          onSelect={key => choose(choiceOf(key))}
        >
          <ListGroup label="보관함">
            <ListRow
              value={ALL}
              title="모든 미디어"
              icon="grid"
              meta={String(items)}
            />
          </ListGroup>
          <ListGroup label="재생목록">
            {playlists.map(playlist => (
              <ListRow
                key={playlist.id}
                value={keyOf({kind: 'media', id: playlist.id})}
                title={playlist.name || UNNAMED_PLAYLIST}
                icon="film"
                meta={String(playlist.items.length)}
              />
            ))}
          </ListGroup>
        </ListBox>
      </PanelBody>
    </Panel>
  );
}

/**
 * The 오디오 panel of the media view: each audio playlist and its count. 새
 * 오디오 재생목록 adds one and shows it.
 */
export function AudioListsPanel(): JSX.Element {
  const {view, choice, choose} = useMediaView();
  const {create, disabled} = useCreate('audio');
  const playlists = view.document?.value.audioPlaylists ?? [];
  return (
    <Panel label="오디오" className={styles.panel}>
      <PanelHeader>
        <PanelTabs
          tabs={[{value: 'audio', label: '오디오'}]}
          value="audio"
          onChange={() => undefined}
        />
        <PanelActions>
          <IconButton
            icon="plus"
            label="새 오디오 재생목록"
            disabled={disabled}
            onClick={create}
          />
        </PanelActions>
      </PanelHeader>
      <PanelBody tab="audio" variant="list">
        <ListBox
          label="오디오 재생목록"
          selected={choice.kind === 'audio' ? keyOf(choice) : undefined}
          onSelect={key => choose(choiceOf(key))}
        >
          {playlists.map(playlist => (
            <ListRow
              key={playlist.id}
              value={keyOf({kind: 'audio', id: playlist.id})}
              title={playlist.name || UNNAMED_PLAYLIST}
              icon="audio"
              meta={String(playlist.items.length)}
            />
          ))}
        </ListBox>
      </PanelBody>
    </Panel>
  );
}
