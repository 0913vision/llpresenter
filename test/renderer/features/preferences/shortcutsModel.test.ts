import {describe, expect, it} from 'vitest';
import type {KeyBinding} from '@core/schema/shortcuts';
import {shortcutCommand} from '@core/shortcuts/bindings';
import {shortcutCommands} from '@core/shortcuts/registry';
import {
  allCommands,
  buildRows,
  filterRows,
  groupRows,
  shortcutCounts,
  withBinding,
  withoutShownOverrides,
  withoutOverride,
} from '@renderer/features/preferences/shortcuts/shortcutsModel';

const NAMES = {
  themes: [],
  props: [{id: '11111111-1111-4111-8111-111111111111', name: '로고'}],
  macros: [],
  timers: [{id: '22222222-2222-4222-8222-222222222222', name: '설교'}],
  screens: [],
};

function commandOf(id: string) {
  const command = shortcutCommand(id);
  if (command === undefined) throw new Error(`Missing ${id}`);
  return command;
}

const F1: KeyBinding = {code: 'F1', mods: []};
const CTRL_J: KeyBinding = {code: 'KeyJ', mods: ['ctrl']};

/** The commands that no handler runs yet; 단축키 offers no key for them. */
const HIDDEN = [
  'import.pptx',
  'media.newAudioPlaylist',
  'media.newPlaylist',
  'media.nextBackground',
  'media.previousBackground',
  'media.relink',
  'screens.identify',
  'screens.redetect',
  'screens.showFallbackWindow',
  'service.quickAdd',
  'service.revealLibrary',
  'stageEditor.addElement',
  'stageEditor.fit',
  'tools.showing',
  'ui.resetLayout',
];

describe('allCommands', () => {
  it('lists a screen output once when its name is the name of a group command', () => {
    const screen = (id: string, name: string) => ({id, name});
    const commands = allCommands({
      ...NAMES,
      screens: [
        screen('33333333-3333-4333-8333-333333333333', '청중 화면'),
        screen('44444444-4444-4444-8444-444444444444', '로비 화면'),
      ],
    });
    const names = commands.map(command => command.name);

    expect(names.filter(name => name === '청중 화면 출력')).toHaveLength(1);
    expect(commands.map(command => command.id)).toContain(
      'output.screen.44444444-4444-4444-8444-444444444444',
    );
    expect(commands.map(command => command.id)).not.toContain(
      'output.screen.33333333-3333-4333-8333-333333333333',
    );
    expect(new Set(names).size).toBe(names.length);
  });

  it('leaves out the commands that no handler runs yet', () => {
    const ids = allCommands(NAMES).map(command => command.id);

    for (const id of HIDDEN) expect(ids).not.toContain(id);
    expect(ids).toContain('clear.slide');
    expect(ids).toContain('service.switcher');
  });

  it('adds a command for each 그래픽 and two for each 타이머', () => {
    const commands = allCommands(NAMES);

    expect(commands).toHaveLength(shortcutCommands.length - HIDDEN.length + 3);
    expect(commands.slice(-3).map(command => command.name)).toEqual([
      '로고',
      '설교 시작과 정지',
      '설교 처음으로',
    ]);
  });
});

describe('buildRows', () => {
  const commands = allCommands(NAMES);

  it.each([
    ['show.first', 'Home'],
    ['show.last', 'End'],
    ['output.audience', 'Ctrl 1'],
    ['output.stage', 'Ctrl 2'],
    ['tools.stage', 'Alt S'],
    ['tools.timers', 'Ctrl Shift C'],
    ['tools.messages', 'Ctrl M'],
    ['tools.props', 'Ctrl Shift P'],
    ['tools.actionPalette', 'Alt C'],
    ['bible.focus', 'Ctrl B'],
    ['audio.playPause', 'Alt P'],
    ['app.preferences', 'Ctrl ,'],
  ])('shows and restores the standard default for %s', (id, text) => {
    const command = commandOf(id);
    const defaults = buildRows(commands, {});
    expect(
      filterRows(defaults, text, 'all').map(row => row.command.id),
    ).toContain(id);
    const removed = withBinding({}, command, null);
    expect(
      buildRows(commands, removed).find(row => row.command.id === id),
    ).toMatchObject({
      bindings: [],
      changed: true,
    });
    expect(buildRows(commands, withoutOverride(removed, id))).toEqual(defaults);
  });

  it('marks only a command that differs from its default as changed', () => {
    const rows = buildRows(commands, {
      'clear.slide': [CTRL_J],
      'clear.media': [...commandOf('clear.media').defaults],
    });

    expect(rows.filter(row => row.changed).map(row => row.command.id)).toEqual([
      'clear.slide',
    ]);
  });

  it('marks both commands of a shared key, naming the other', () => {
    const rows = buildRows(commands, {'clear.slide': [F1]});
    const slide = rows.find(row => row.command.id === 'clear.slide');
    const all = rows.find(row => row.command.id === 'clear.all');

    expect(slide?.conflictWith).toBe('모두 지우기');
    expect(all?.conflictWith).toBe('가사 지우기');
    expect(shortcutCounts(rows)).toEqual({changed: 1, conflict: 2});
  });

  it('has no conflict while every command keeps its default', () => {
    expect(shortcutCounts(buildRows(commands, {}))).toEqual({
      changed: 0,
      conflict: 0,
    });
  });
});

describe('filterRows', () => {
  const rows = buildRows(allCommands(NAMES), {'clear.slide': [F1]});

  it('keeps the changed or the conflicting rows', () => {
    expect(filterRows(rows, '', 'changed').map(row => row.command.id)).toEqual([
      'clear.slide',
    ]);
    expect(filterRows(rows, '', 'conflict')).toHaveLength(2);
  });

  it('searches the name and the key text, ignoring case', () => {
    expect(
      filterRows(rows, '가사 지우기', 'all').map(row => row.command.id),
    ).toEqual(['clear.slide']);
    expect(
      filterRows(rows, 'ctrl arrowdown', 'all').map(row => row.command.id),
    ).toEqual([]);
    expect(
      filterRows(rows, 'ctrl ↓', 'all').map(row => row.command.id),
    ).toContain('service.nextItem');
  });

  it('shows nothing for a search that matches nothing', () => {
    expect(filterRows(rows, '없는 명령', 'all')).toEqual([]);
  });
});

describe('groupRows', () => {
  it('keeps the groups in the order they first appear', () => {
    const titles = groupRows(buildRows(allCommands(NAMES), {})).map(
      group => group.title,
    );

    expect(titles.at(0)).toBe('슬라이드');
    expect(titles.slice(-2)).toEqual(['그래픽', '타이머']);
    expect(new Set(titles).size).toBe(titles.length);
  });
});

describe('edits', () => {
  const slide = commandOf('clear.slide');

  it('sets one key, and none with null', () => {
    expect(withBinding({}, slide, CTRL_J)).toEqual({'clear.slide': [CTRL_J]});
    expect(withBinding({}, slide, null)).toEqual({'clear.slide': []});
  });

  it('drops the override when the key equals the default', () => {
    expect(
      withBinding({'clear.slide': [CTRL_J]}, slide, {code: 'F2', mods: []}),
    ).toEqual({});
  });

  it('keeps the other overrides and their order', () => {
    expect(
      Object.keys(withBinding({'a.b': [F1], 'c.d': [F1]}, slide, CTRL_J)),
    ).toEqual(['a.b', 'c.d', 'clear.slide']);
    expect(
      withoutOverride({'clear.slide': [CTRL_J], 'x.y': []}, 'clear.slide'),
    ).toEqual({
      'x.y': [],
    });
  });

  it('resets only the shown commands and keeps every other override', () => {
    const quick = 'quick.33333333-3333-4333-8333-333333333333';
    const unlisted = 'prop.44444444-4444-4444-8444-444444444444';
    const commands = allCommands(NAMES);

    expect(
      withoutShownOverrides(
        {
          'clear.slide': [CTRL_J],
          'prop.11111111-1111-4111-8111-111111111111': [F1],
          'future.cmd': [F1],
          [quick]: [CTRL_J],
          [unlisted]: [F1],
        },
        commands,
      ),
    ).toEqual({'future.cmd': [F1], [quick]: [CTRL_J], [unlisted]: [F1]});
  });
});
