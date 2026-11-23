import {shortcutText} from '@renderer/ui/commandBindings';
import {windowCommandLabels} from '@renderer/ui/windowCommandLabels';
import type {MenuEntry} from '@renderer/ui/menuModel';
import {laterRow, menuSeparator} from '@renderer/ui/menuRows';

/** The 창 menu (spec 11): the title bar buttons and 환경설정. */
export function windowMenuEntries(): readonly MenuEntry[] {
  return [
    {
      kind: 'item',
      id: 'minimize',
      label: '최소화',
      command: 'window.minimize',
      onSelect: () => window.llp?.window.control('minimize'),
    },
    {
      kind: 'item',
      id: 'maximize',
      label: '최대화',
      command: 'window.maximize',
      onSelect: () => window.llp?.window.control('toggle-maximize'),
    },
  ];
}

/**
 * The 도움말 menu (spec 11). 시작 안내 waits for the welcome walkthrough, so
 * it shows as unavailable.
 */
export function helpMenuEntries(actions: {
  readonly showAbout: () => void;
}): readonly MenuEntry[] {
  return [
    {
      kind: 'item',
      id: 'preferences',
      label: windowCommandLabels.preferences,
      command: 'app.preferences',
      meta: shortcutText('app.preferences'),
      onSelect: () => window.llp?.window.openPreferences(),
    },
    {
      kind: 'item',
      id: 'screens',
      label: '화면 설정…',
      onSelect: () => window.llp?.window.openScreens(),
    },
    {
      kind: 'item',
      id: 'shortcuts',
      label: '단축키…',
      onSelect: () => window.llp?.window.openPreferences('shortcuts'),
    },
    menuSeparator('help'),
    laterRow('welcome', '시작 안내'),
    menuSeparator('about'),
    {
      kind: 'item',
      id: 'logs',
      label: '기록 폴더 열기',
      command: 'app.openLogs',
      onSelect: () => window.llp?.window.openLogFolder(),
    },
    {
      kind: 'item',
      id: 'update',
      label: '업데이트 확인',
      command: 'app.checkUpdate',
      onSelect: () => window.llp?.update.check(),
    },
    {
      kind: 'item',
      id: 'version',
      label: '버전 정보',
      command: 'app.about',
      onSelect: actions.showAbout,
    },
  ];
}
