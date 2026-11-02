import {shortcutText} from '@renderer/ui/commandBindings';
import type {MenuEntry} from '@renderer/ui/menuModel';
import {laterRow, menuSeparator} from '@renderer/ui/menuRows';
import {windowCommandLabels} from '@renderer/ui/windowCommandLabels';

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
    menuSeparator('preferences'),
    {
      kind: 'item',
      id: 'preferences',
      label: windowCommandLabels.preferences,
      command: 'app.preferences',
      meta: shortcutText('app.preferences'),
      onSelect: () => window.llp?.window.openPreferences(),
    },
  ];
}

/**
 * The 도움말 menu (spec 11). Its rows wait for the 정보 page, the log folder
 * call, and the welcome walkthrough, so each shows as unavailable.
 */
export function helpMenuEntries(): readonly MenuEntry[] {
  return [
    laterRow('welcome', '시작 안내'),
    menuSeparator('about'),
    laterRow('logs', '로그 폴더 열기', {command: 'app.openLogs'}),
    laterRow('version', '버전 정보', {command: 'app.about'}),
  ];
}
