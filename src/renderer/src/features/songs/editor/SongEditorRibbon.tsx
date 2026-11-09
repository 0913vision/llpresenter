import {useState, type JSX, type ReactNode} from 'react';
import {Panel, PanelHeader, PanelTabs} from '@renderer/ui/Panel';
import type {SongEditorStore} from './songEditorStore';
import type {SongSession} from './songSession';
import {SlideHotKeyControl} from './SlideHotKeyControl';
import {SlideTransitionRibbon} from './SlideTransitionRibbon';
import {SongTitleLayoutControl} from './SongTitleLayoutControl';

export type SongDesignRenderer = (
  session: SongSession,
  busy: boolean,
) => ReactNode;

/** Keeps item appearance separate from slide editing without changing the deck. */
export function SongEditorRibbon({
  store,
  session,
  busy,
  renderDesign,
}: {
  readonly store: SongEditorStore;
  readonly session: SongSession;
  readonly busy: boolean;
  readonly renderDesign: SongDesignRenderer | undefined;
}): JSX.Element {
  const [tab, setTab] = useState('edit');
  const target = session.document.itemTarget;
  const design = target !== undefined && renderDesign !== undefined;
  const selected = tab === 'design' && !design ? 'edit' : tab;
  return (
    <>
      {design ? (
        <Panel label="곡 편집 리본">
          <PanelHeader>
            <PanelTabs
              tabs={[
                {value: 'edit', label: '편집'},
                {value: 'design', label: '디자인'},
              ]}
              value={selected}
              onChange={setTab}
            />
          </PanelHeader>
        </Panel>
      ) : null}
      {selected === 'design' && design ? (
        renderDesign(session, busy)
      ) : (
        <>
          <SlideHotKeyControl store={store} session={session} busy={busy} />
          <SlideTransitionRibbon session={session} disabled={busy} song />
          <SongTitleLayoutControl session={session} disabled={busy} />
        </>
      )}
    </>
  );
}
