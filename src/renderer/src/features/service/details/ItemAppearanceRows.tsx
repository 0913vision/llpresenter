import type {ComponentProps, JSX} from 'react';
import {ItemThemeRow} from './ItemThemeRow';
import {ItemBackgroundRow} from './ItemSettingsRows';

/** The two item-level appearance controls share a target in every surface. */
export interface ItemAppearanceAdapter {
  readonly item: ComponentProps<typeof ItemBackgroundRow>['item'];
  readonly items: ComponentProps<typeof ItemBackgroundRow>['items'];
  readonly api: ComponentProps<typeof ItemBackgroundRow>['api'];
  readonly reason: string | undefined;
  readonly themeData?: ComponentProps<typeof ItemThemeRow>['themeData'];
  readonly setTheme?: ComponentProps<typeof ItemThemeRow>['setTheme'];
  readonly setBackground?: ComponentProps<
    typeof ItemBackgroundRow
  >['setBackground'];
  readonly session?: ComponentProps<typeof ItemBackgroundRow>['session'];
  readonly mediaDocument?: ComponentProps<
    typeof ItemBackgroundRow
  >['mediaDocument'];
}

export function ItemAppearanceRows({
  adapter,
}: {
  readonly adapter: ItemAppearanceAdapter;
}): JSX.Element {
  return (
    <>
      <ItemThemeRow
        api={adapter.api.settings}
        items={adapter.items}
        item={adapter.item}
        reason={adapter.reason}
        {...(adapter.themeData === undefined
          ? {}
          : {themeData: adapter.themeData})}
        setTheme={adapter.setTheme}
      />
      <ItemBackgroundRow
        api={adapter.api}
        items={adapter.items}
        item={adapter.item}
        lockReason={adapter.reason}
        setBackground={adapter.setBackground}
        {...(adapter.session === undefined ? {} : {session: adapter.session})}
        {...(adapter.mediaDocument === undefined
          ? {}
          : {mediaDocument: adapter.mediaDocument})}
      />
    </>
  );
}
