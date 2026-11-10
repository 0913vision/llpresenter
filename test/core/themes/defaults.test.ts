import {STAGE_COLORS} from '@core/themes/stageColors';
import * as v from 'valibot';
import {expect, it} from 'vitest';
import {
  STARTER_TEXT_STYLE,
  STARTER_STAGE_ELEMENTS,
} from '@core/themes/starterLayout';
import {STARTER_SCREEN_IDS} from '@core/screens/screens';
import {createScreenId} from '@core/schema/ids';
import {
  builtInTheme,
  createDefaultThemes,
  standbyStageLayout,
} from '@core/themes/defaults';
import {resolveThemeOutput} from '@core/themes/output';
import {themeItemKinds} from '@core/themes/elementRules';
import {themesSchema} from '@core/schema/themes';
import {SUNDAY_PICTURE_IDS} from '@core/themes/sundayScripture';
import {
  SUNDAY_NOTICE_PICTURE_ID,
  SUNDAY_NOTICE_DIVIDER_ID,
} from '@core/themes/sundayNotice';

it('places song lyrics near the top while retaining the starter broadcast styles and stage geometry', () => {
  const main = createScreenId(STARTER_SCREEN_IDS.main);
  const broadcast = createScreenId(STARTER_SCREEN_IDS.broadcast);
  const stage = createScreenId(STARTER_SCREEN_IDS.stage);
  const theme = builtInTheme('song');
  expect(theme.screens[main]).toMatchObject({
    mode: {kind: 'own'},
    elements: [
      {kind: 'background'},
      {kind: 'media'},
      {
        kind: 'currentText',
        frame: {x: 132, y: 141, w: 1656, h: 411},
        text: {
          font: 'NanumSquare',
          weight: 800,
          size: 108,
          color: '#FFFFFF',
          align: 'center',
          tracking: -3,
          lineHeight: 137 / 108,
          vAlign: 'top',
          shadow: {on: false},
          outline: {on: false},
        },
      },
    ],
  });
  expect(theme.screens[broadcast]?.elements).toMatchObject([
    {
      kind: 'box',
      frame: {x: 0, y: 818, w: 1920, h: 204},
      box: {fill: '#1c1c1c', opacity: 100},
    },
    {
      kind: 'currentText',
      text: {
        font: 'Pretendard Variable',
        size: 64,
        weight: 700,
        align: 'center',
      },
    },
  ]);
  expect(theme.screens[main]?.background).toBeUndefined();
  expect(theme.screens[broadcast]?.background).toBeUndefined();
  expect(theme.screens[stage]?.elements.map(element => element.frame)).toEqual(
    STARTER_STAGE_ELEMENTS.map(element => element.frame),
  );
  expect(theme.screens[stage]?.elements.map(element => element.kind)).toEqual([
    'text',
    'label',
    'stageMessage',
    'text',
    'timer',
    'clock',
    'currentText',
    'nextText',
  ]);
  const stageLabel = theme.screens[stage]?.elements.find(
    element => element.kind === 'label',
  );
  expect(stageLabel).toMatchObject({hideWhenItemTitle: true, text: {size: 40}});
  const current = theme.screens[stage]?.elements.find(
    element => element.kind === 'currentText',
  );
  expect(current?.text).toMatchObject({
    font: STARTER_TEXT_STYLE.font,
    size: 170,
    weight: STARTER_TEXT_STYLE.weight,
    vAlign: STARTER_TEXT_STYLE.vAlign,
  });
});

it('leaves room for three song rows at the configured size and pitch without adding a theme picture', () => {
  const layout =
    builtInTheme('song').screens[createScreenId(STARTER_SCREEN_IDS.main)];
  const current = layout?.elements.find(
    element => element.kind === 'currentText',
  );
  if (current === undefined) throw Error('Expected song text');
  expect(current.frame.h).toBeGreaterThanOrEqual(
    current.text.size * current.text.lineHeight * 3,
  );
  expect(layout?.elements.map(element => element.kind)).toEqual([
    'background',
    'media',
    'currentText',
  ]);
});

it.each(themeItemKinds.filter(kind => kind !== 'ad'))(
  'keeps the default %s capture layout free of item backgrounds and inherits the empty color',
  kind => {
    const id = createScreenId(STARTER_SCREEN_IDS.broadcast);
    const screens = [
      {
        id,
        name: 'Capture',
        kind: 'broadcast',
        method: 'capture',
        emptyColor: '#123456',
      },
    ] as const;
    const output = resolveThemeOutput({
      file: createDefaultThemes(screens),
      screens,
      item: {id: 'invented', kind, source: 'external'},
      revision: 1,
    });
    expect(output.screens[id]?.emptyColor).toBe('#123456');
    expect(output.screens[id]?.layout.background).toBeUndefined();
    expect(
      output.screens[id]?.layout.elements.map(element => element.kind),
    ).toEqual(
      kind === 'bible' || kind === 'blank'
        ? ['box', 'currentText', 'reference']
        : ['box', 'currentText'],
    );
  },
);

it('adds a reference only for Bible layouts and adapts to configured screen IDs', () => {
  const id = createScreenId('00000000-0000-4000-8000-000000000999');
  const screens = [{id, kind: 'audience', method: 'fullscreen'}] as const;
  expect(Object.keys(builtInTheme('bible', screens).screens)).toEqual([id]);
  expect(
    builtInTheme('bible', screens).screens[id]?.elements.find(
      element => element.kind === 'reference',
    )?.kind,
  ).toBe('reference');
  expect(
    builtInTheme('song', screens).screens[id]?.elements.some(
      element => element.kind === 'reference',
    ),
  ).toBe(false);
});

it('gives the capture Bible a readable right-aligned reference', () => {
  const id = createScreenId(STARTER_SCREEN_IDS.broadcast);
  const bible = builtInTheme('bible').screens[id];
  expect(
    bible?.elements.find(element => element.kind === 'reference'),
  ).toMatchObject({text: {size: 52, align: 'right'}});
});

it('gives the 무대 화면 of the Bible 테마 no reference and the same element kinds as the song 테마', () => {
  const id = createScreenId(STARTER_SCREEN_IDS.stage);
  const kinds = (kind: 'bible' | 'song') =>
    (builtInTheme(kind).screens[id]?.elements ?? []).map(
      element => element.kind,
    );
  expect(kinds('bible')).not.toContain('reference');
  expect(kinds('bible')).toEqual(kinds('song'));
});

it('makes a valid file with built-in themes and a standby clock and timer on stage', () => {
  const defaults = createDefaultThemes();
  expect(v.safeParse(themesSchema, defaults).success).toBe(true);
  expect(defaults.themes.map(entry => entry.name)).toEqual([
    '찬양',
    '말씀',
    '영상',
    '광고',
    '찬양 (밝은 배경)',
    '사도신경, 주기도문',
    '설교 제목',
    '설교 제목 (두 줄)',
    '구역 이름 청록',
    '구역 이름 적갈',
    '구역 이름 초록',
    '구역 이름 자주',
    '구역 이름 청록초록',
    '구역 이름 남보라',
    '구역 이름 올리브',
    '예배 준비',
  ]);
  const stage =
    defaults.standby.screens[createScreenId(STARTER_SCREEN_IDS.stage)];
  expect(stage?.elements.map(e => e.kind)).toEqual(['clock', 'timer']);
});

it('ships the audience scripture picture and editable typography without changing other screens', () => {
  const audience = createScreenId(STARTER_SCREEN_IDS.main);
  const layout = builtInTheme('bible').screens[audience];
  expect(layout?.elements).toMatchObject([
    {
      kind: 'image',
      mediaId: SUNDAY_PICTURE_IDS.scripture,
      frame: {x: 0, y: 0, w: 1920, h: 1080},
    },
    {kind: 'background', fit: 'fill'},
    {kind: 'media', fit: 'fill'},
    {
      kind: 'reference',
      source: 'item',
      text: {
        font: 'NanumSquare',
        weight: 700,
        size: 72,
        shadow: {on: false},
        outline: {on: false},
      },
    },
    {
      kind: 'currentText',
      frame: {x: 130.6, y: 248, w: 1660, h: 750},
      text: {
        font: 'NanumSquare',
        weight: 700,
        size: 104,
        tracking: -3,
        lineHeight: 150 / 104,
        maxLines: 5,
        align: 'left',
        vAlign: 'top',
        shadow: {on: false},
        outline: {on: false},
      },
    },
  ]);
  for (const screen of [
    STARTER_SCREEN_IDS.broadcast,
    STARTER_SCREEN_IDS.stage,
  ]) {
    expect(
      builtInTheme('bible').screens[createScreenId(screen)]?.elements.some(
        element => element.kind === 'image',
      ),
    ).toBe(false);
  }
});

it('uses item names and a four-line verse box for liturgy while retaining other scripture screens', () => {
  const theme = createDefaultThemes().themes.find(
    theme => theme.name === '사도신경, 주기도문',
  );
  const scripture = builtInTheme('bible');
  const audience = theme?.screens[createScreenId(STARTER_SCREEN_IDS.main)];
  expect(
    audience?.elements.find(element => element.kind === 'reference'),
  ).toBeUndefined();
  expect(
    audience?.elements.find(element => element.kind === 'itemName'),
  ).toMatchObject({
    frame: {x: 130.6, y: 107},
    text: {size: 72, font: 'NanumSquare', weight: 700},
  });
  expect(
    audience?.elements.find(element => element.kind === 'currentText'),
  ).toMatchObject({
    frame: {x: 129, w: 1676},
    text: {maxLines: 4, size: 104, tracking: -3},
  });
  for (const screen of [
    STARTER_SCREEN_IDS.broadcast,
    STARTER_SCREEN_IDS.stage,
  ]) {
    expect(theme?.screens[createScreenId(screen)]).toEqual(
      scripture.screens[createScreenId(screen)],
    );
  }
});

it('offers one- and two-line sermon titles using item names and ordinary slide text', () => {
  const file = createDefaultThemes();
  const audience = createScreenId(STARTER_SCREEN_IDS.main);
  for (const [name, mediaId, height] of [
    ['설교 제목', SUNDAY_PICTURE_IDS.sermon, 220],
    ['설교 제목 (두 줄)', SUNDAY_PICTURE_IDS.sermonTwoLines, 390],
  ] as const) {
    const theme = file.themes.find(theme => theme.name === name);
    expect(theme?.screens[audience]?.elements).toMatchObject([
      {kind: 'image', mediaId},
      {
        kind: 'itemName',
        text: {font: 'KoPubWorldDotum', weight: 500, size: 86, tracking: 6},
      },
      {
        kind: 'currentText',
        frame: {h: height},
        text: {
          font: 'KoPubWorldDotum',
          weight: 700,
          size: 140,
          tracking: -6,
          align: 'center',
          vAlign: 'middle',
        },
      },
    ]);
    expect(
      theme?.screens[createScreenId(STARTER_SCREEN_IDS.broadcast)],
    ).toEqual(
      builtInTheme('blank').screens[
        createScreenId(STARTER_SCREEN_IDS.broadcast)
      ],
    );
    expect(theme?.screens[createScreenId(STARTER_SCREEN_IDS.stage)]).toEqual(
      builtInTheme('blank').screens[createScreenId(STARTER_SCREEN_IDS.stage)],
    );
  }
});

it('defaults blank slides to 말씀 and retains the broadcast and stage ad frames', () => {
  const file = createDefaultThemes();
  expect(file.defaults.blank).toBe(file.defaults.bible);
  const ad = file.themes.find(theme => theme.id === file.defaults.ad);
  expect(ad?.name).toBe('광고');
  expect(
    ad?.screens[createScreenId(STARTER_SCREEN_IDS.broadcast)]?.elements.map(
      element => element.kind,
    ),
  ).toEqual(['media', 'box', 'slideName', 'currentText']);
  for (const screen of [STARTER_SCREEN_IDS.stage]) {
    const layout = ad?.screens[createScreenId(screen)];
    if (layout === undefined) throw Error('Expected ad layout');
    expect(layout.elements.map(element => element.kind)).toEqual([
      'box',
      'box',
      'text',
      'media',
      'slideName',
      'currentText',
    ]);
    expect(layout.elements[0]).toMatchObject({
      frame: {x: 0, y: 0, w: 1920, h: 1080},
      box: {fill: '#141c2e'},
    });
    expect(layout.elements[1]).toMatchObject({
      frame: {w: 24},
      box: {fill: '#e6b54a'},
    });
    expect(layout.elements[2]).toMatchObject({
      content: '교회 소식',
      frame: {x: 150, y: 190},
    });
    expect(layout.elements[3]).toMatchObject({
      fit: 'fill',
      frame: {w: 1920, h: 1080},
    });
    expect(layout.elements[4]).toMatchObject({text: {size: 132, weight: 800}});
    expect(layout.elements[5]).toMatchObject({
      text: {size: 60, weight: 400, color: '#c9d1e0'},
    });
  }
  expect(builtInTheme('ad')).toEqual(ad);
  expect(builtInTheme('blank')).toEqual(builtInTheme('bible'));
});

it('makes the audience notice an editable picture, number, name and bulleted body with a covering picture layer', () => {
  const ad =
    builtInTheme('ad').screens[createScreenId(STARTER_SCREEN_IDS.main)];
  expect(ad?.elements).toMatchObject([
    {
      kind: 'image',
      mediaId: SUNDAY_NOTICE_PICTURE_ID,
      frame: {x: 0, y: 0, w: 1920, h: 1080},
    },
    {kind: 'background'},
    {
      kind: 'slideNumber',
      frame: {x: 97, y: 21, w: 113, h: 208},
      text: {
        font: 'KoPubWorldDotum',
        weight: 700,
        size: 160,
        lineHeight: 1,
        tracking: -6,
        align: 'center',
      },
    },
    {
      kind: 'image',
      mediaId: SUNDAY_NOTICE_DIVIDER_ID,
      frame: {x: 0, y: 0, w: 1920, h: 1080},
    },
    {
      kind: 'slideName',
      frame: {x: 240, y: 107, w: 1540, h: 145},
      text: {size: 108, weight: 700, tracking: -3, lineHeight: 1},
    },
    {
      kind: 'currentText',
      frame: {x: 129, y: 287, w: 1676, h: 776},
      text: {
        size: 86,
        weight: 500,
        bullets: true,
        bulletStyle: 'disc',
        tracking: -3,
        lineHeight: 128 / 86,
        maxLines: 6,
        vAlign: 'top',
        shadow: {on: false},
        outline: {on: false},
      },
    },
    {kind: 'media', fit: 'fill', frame: {x: 0, y: 0, w: 1920, h: 1080}},
  ]);
});

it('uses readable stage defaults and cover for built-in audience media', () => {
  const defaults = createDefaultThemes();
  const audience = createScreenId(STARTER_SCREEN_IDS.main);
  const stage = createScreenId(STARTER_SCREEN_IDS.stage);
  for (const theme of defaults.themes) {
    for (const element of theme.screens[audience]?.elements ?? []) {
      if (element.kind !== 'background' && element.kind !== 'media') continue;
      const sectionBackground =
        theme.name.startsWith('\uad6c\uc5ed \uc774\ub984') &&
        element.kind === 'background';
      expect(element.fit).toBe(sectionBackground ? 'stretch' : 'fill');
    }
  }
  const elements = builtInTheme('song').screens[stage]?.elements ?? [];
  const current = elements.find(e => e.kind === 'currentText');
  const next = elements.find(e => e.kind === 'nextText');
  if (current?.kind !== 'currentText' || next?.kind !== 'nextText') {
    throw Error('stage text missing');
  }
  expect(
    current.frame.h / (4 * current.text.lineHeight),
  ).toBeGreaterThanOrEqual(90);
  expect(next.text.size).toBeLessThan(current.text.size);
  expect(next.frame.y).toBeGreaterThan(current.frame.y + current.frame.h);
  expect(next).toMatchObject({
    lineLimit: 2,
    text: {align: 'center', vAlign: 'bottom', color: STAGE_COLORS.next},
  });
  expect(current.text).toMatchObject({align: 'center', color: '#FFFFFF'});
  for (const label of elements.filter(
    e => e.kind === 'label' || e.kind === 'nextLabel',
  )) {
    expect(label.text.size).toBeGreaterThanOrEqual(36);
    expect(label.frame.h).toBeGreaterThanOrEqual(
      label.text.size * label.text.lineHeight,
    );
  }
});

it('keeps standby clock before timer independent of the live stage layout order', () => {
  expect(standbyStageLayout().elements.map(element => element.kind)).toEqual([
    'clock',
    'timer',
  ]);
});
