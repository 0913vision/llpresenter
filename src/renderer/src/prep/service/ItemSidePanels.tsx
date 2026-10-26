import {useSyncExternalStore, type JSX} from 'react';
import {isItemOfKind} from '@shared/schema/service';
import {SongPreviewFrame, type SongEditorStore} from '@renderer/prep/editor';
import {IconButton} from '@renderer/ui/IconButton';
import {Panel, PanelBody, PanelHeader, PanelTabs} from '@renderer/ui/Panel';
import {
  Properties,
  PropertyGroup,
  PropertyValue,
} from '@renderer/ui/PropertyRow';
import type {ServiceItemStore} from './serviceItemStore';
import {itemPicture} from './songItemModel';

const SETTINGS_TAB = [{value: 'settings', label: '항목 설정'}] as const;

interface ItemPanelProps {
  readonly items: ServiceItemStore;
  readonly editor: SongEditorStore;
}

/** The selected place of the 준비 item, drawn locally; never the output. */
export function ItemPreviewPanel({items, editor}: ItemPanelProps): JSX.Element {
  const {item, song, arrangement, position} = useSyncExternalStore(
    items.subscribe,
    items.getSnapshot,
  );
  const labels =
    useSyncExternalStore(editor.subscribe, editor.getSnapshot).labels?.value
      .labels ?? [];
  const picture =
    item === null || !isItemOfKind(item, 'song') || song === null
      ? null
      : itemPicture({
          song: song.history.snapshot.song,
          arrangement,
          position,
          background: item.background ?? song.background,
        });
  return (
    <SongPreviewFrame
      settings={editor.api.settings}
      labels={labels}
      picture={picture}
    />
  );
}

/** 항목 설정: where the item comes from and what this service sets for it. */
export function ItemSettingsPanel({
  items,
  editor,
}: ItemPanelProps): JSX.Element {
  const {item, song} = useSyncExternalStore(items.subscribe, items.getSnapshot);
  return (
    <Panel label="항목 설정">
      <PanelHeader>
        <PanelTabs
          tabs={SETTINGS_TAB}
          value="settings"
          onChange={() => undefined}
        />
      </PanelHeader>
      {item === null || !isItemOfKind(item, 'song') || song === null ? null : (
        <PanelBody>
          <Properties>
            <PropertyGroup title="원본">
              <PropertyValue
                label="곡"
                value={song.document.song.title}
                icon="link"
                primary
                meta="라이브러리"
                action={
                  <IconButton
                    icon="open"
                    label="라이브러리 곡 열기"
                    onClick={() => editor.open(song.document)}
                  />
                }
              />
            </PropertyGroup>
          </Properties>
        </PanelBody>
      )}
    </Panel>
  );
}
