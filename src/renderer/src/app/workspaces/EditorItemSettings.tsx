import {useSyncExternalStore, type JSX} from 'react';
import {isItemOfKind} from '@core/schema/service';
import {
  isStartItem,
  type ServiceItemStore,
} from '@renderer/features/service/items/serviceItemStore';
import type {SongEditorStore} from '@renderer/features/songs/editor';
import {ItemThemeRow} from '@renderer/features/service/details/ItemThemeRow';
import {ItemBackgroundRow} from '@renderer/features/service/details/ItemSettingsRows';
import {themeRequest} from '@renderer/features/service/items/itemAppearanceCommands';
import {backgroundRequest} from '@renderer/features/service/items/itemPlaybackCommands';
import {LiturgyVersion} from '@renderer/features/service/items/LiturgyEditor';
import {Properties, PropertyGroup, PropertyRow} from '@renderer/ui/PropertyRow';

export function EditorItemSettings({
  items,
  editor,
  flushSlides,
  shownItem,
  shownSession,
}: {
  readonly flushSlides: () => Promise<boolean>;
  readonly items: ServiceItemStore;
  readonly editor: SongEditorStore;
  readonly shownItem?: ReturnType<ServiceItemStore['getSnapshot']> | undefined;
  readonly shownSession?:
    ReturnType<SongEditorStore['getSnapshot']>['session'] | undefined;
}): JSX.Element | null {
  const current = useSyncExternalStore(items.subscribe, items.getSnapshot);
  const state = shownItem ?? current;
  const editing = useSyncExternalStore(editor.subscribe, editor.getSnapshot);
  const session = shownSession === undefined ? editing.session : shownSession;
  const {item, service} = state;
  if (item === null || service === null || !isStartItem(item)) return null;
  const target = {serviceId: service.service.id, itemId: item.id};
  const flush = async (): Promise<boolean> => {
    if (isItemOfKind(item, 'song') && session?.itemSession) {
      return session.flush();
    }
    if (isItemOfKind(item, 'slides')) return flushSlides();
    return true;
  };
  const reason =
    state.busy || editing.busy || service.access === 'readOnly'
      ? '\uc800\uc7a5 \uc911'
      : undefined;
  return (
    <Properties>
      <PropertyGroup title={'\uc774\ubc88 \uc608\ubc30'}>
        {isItemOfKind(item, 'liturgy') ? (
          <PropertyRow label={'\uc608\uc2dd\ubb38 \ubc84\uc804'}>
            {() => (
              <LiturgyVersion
                items={items}
                item={item}
                serviceId={service.service.id}
                locked={reason !== undefined}
              />
            )}
          </PropertyRow>
        ) : null}
        <ItemThemeRow
          api={editor.api.settings}
          items={items}
          item={item}
          reason={reason}
          setTheme={async (theme, file) =>
            (await flush()) &&
            items.submitItemEdit(themeRequest(target, theme, file))
          }
        />
        <ItemBackgroundRow
          items={items}
          api={editor.api}
          lockReason={reason}
          item={item}
          setBackground={async id =>
            (await flush()) &&
            items.submitItemEdit(backgroundRequest(target, id))
          }
          {...(isItemOfKind(item, 'song') && state.song !== null
            ? {session: state.song}
            : {})}
        />
      </PropertyGroup>
    </Properties>
  );
}
