import {describe, expect, it, vi} from 'vitest';
import {
  createMessageTemplateId,
  createNoticeSetId,
  createPropId,
  createTimerId,
  parseMacroCollectionId,
} from '@core/schema/ids';
import {
  parseSettingsDocument,
  type SettingsDocument,
  type SettingsEdit,
} from '@core/schema/settingsDocuments';
import type {EditResult} from '@core/schema/contentEdit';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {saveMacroCollectionEdit} from '@renderer/features/tools/macroCollectionEdits';
import {
  MAX_MESSAGE_TEMPLATES,
  saveMessageEdit,
} from '@renderer/features/tools/messageEdits';
import {
  MAX_NOTICE_SETS,
  saveNoticeEdit,
} from '@renderer/features/tools/noticeEdits';
import {MAX_PROPS, savePropEdit} from '@renderer/features/tools/propEdits';
import {duplicateTimer} from '@renderer/features/tools/timerEdits';
import {MAX_TIMER_DEFINITIONS} from '@core/schema/timers';
import {MACRO_FILE_LIMITS} from '@core/schema/macros';

const uuid = (kind: number, n: number): string =>
  `${String(kind).padStart(8, '0')}-0000-4000-8000-${String(n).padStart(12, '0')}`;
function collectionId(n: number) {
  const parsed = parseMacroCollectionId(uuid(6, n));
  if (!parsed.ok) throw new Error('Invalid collection id');
  return parsed.value;
}
const SCREEN = uuid(9, 1);
const MEDIA = uuid(9, 2);

function documentOf(
  name: SettingsDocument['name'],
  value: object,
  revision = 3,
): SettingsDocument {
  const parsed = parseSettingsDocument({
    name,
    revision,
    access: 'editable',
    value,
  });
  if (!parsed.ok) throw new Error(`Invalid ${name} fixture`);
  return parsed.value;
}

/** An api whose settings answer one document and record the edits sent. */
function apiWith(document: SettingsDocument) {
  const edit = vi
    .fn<(edit: SettingsEdit) => Promise<EditResult>>()
    .mockResolvedValue({ok: true, value: {id: document.name, revision: 4}});
  const api = mockLlpApi({
    settings: {get: () => Promise.resolve(document), edit},
  });
  return {api, edit};
}

function written(edit: ReturnType<typeof apiWith>['edit']): unknown {
  const request = edit.mock.calls[0]?.[0];
  if (request?.type !== 'settings.update') {
    throw new Error('Expected a settings update');
  }
  return request.value;
}

describe('복제 of a 메시지 문구', () => {
  const template = (n: number, name: string) => ({
    id: uuid(1, n),
    name,
    icon: 'msg',
    text: `문구 ${n}`,
  });
  const file = (templates: readonly object[]) => ({
    format: 'llsettings.messages',
    schemaVersion: 1,
    templates,
    messageStyles: [],
    future: 'kept',
  });

  it('adds the copy right after the original with a new id, the copy name, and the same text', async () => {
    const {api, edit} = apiWith(
      documentOf('messages', file([template(1, '점검'), template(2, '안내')])),
    );
    const copyId = createMessageTemplateId(uuid(1, 50));
    await saveMessageEdit(api, {
      kind: 'duplicate',
      id: createMessageTemplateId(uuid(1, 1)),
      copyId,
    });
    expect(written(edit)).toMatchObject({
      future: 'kept',
      templates: [
        {id: uuid(1, 1), name: '점검'},
        {id: copyId, name: '점검 복사본', text: '문구 1'},
        {id: uuid(1, 2), name: '안내'},
      ],
    });
  });

  it('refuses a copy that would pass the cap, and one of a missing original', async () => {
    const full = Array.from({length: MAX_MESSAGE_TEMPLATES}, (_, n) =>
      template(n + 1, `문구 ${n + 1}`),
    );
    const {api, edit} = apiWith(documentOf('messages', file(full)));
    await expect(
      saveMessageEdit(api, {
        kind: 'duplicate',
        id: createMessageTemplateId(uuid(1, 1)),
        copyId: createMessageTemplateId(uuid(1, 900)),
      }),
    ).rejects.toThrow('is full');
    const few = apiWith(documentOf('messages', file([template(1, '점검')])));
    await expect(
      saveMessageEdit(few.api, {
        kind: 'duplicate',
        id: createMessageTemplateId(uuid(1, 77)),
        copyId: createMessageTemplateId(uuid(1, 901)),
      }),
    ).rejects.toThrow('no longer exists');
    expect(edit).not.toHaveBeenCalled();
    expect(few.edit).not.toHaveBeenCalled();
  });
});

describe('복제 of a 공지 세트', () => {
  const set = (n: number, name: string) => ({
    id: uuid(2, n),
    name,
    media: [MEDIA],
    interval: 8,
    loop: true,
    targets: [SCREEN],
  });
  const file = (sets: readonly object[]) => ({
    format: 'llsettings.notices',
    schemaVersion: 1,
    sets,
  });

  it('keeps the images, interval, and screens and numbers the name when taken', async () => {
    const {api, edit} = apiWith(
      documentOf(
        'notices',
        file([
          set(1, '주일 광고'),
          {...set(2, '주일 광고 복사본'), loop: false},
        ]),
      ),
    );
    const copyId = createNoticeSetId(uuid(2, 50));
    await saveNoticeEdit(api, {
      kind: 'duplicate',
      id: createNoticeSetId(uuid(2, 1)),
      copyId,
    });
    expect(written(edit)).toMatchObject({
      sets: [
        {id: uuid(2, 1), name: '주일 광고'},
        {
          id: copyId,
          name: '주일 광고 복사본 2',
          media: [MEDIA],
          interval: 8,
          loop: true,
          targets: [SCREEN],
        },
        {id: uuid(2, 2)},
      ],
    });
  });

  it('refuses a copy past the cap', async () => {
    const {api} = apiWith(
      documentOf(
        'notices',
        file(
          Array.from({length: MAX_NOTICE_SETS}, (_, n) =>
            set(n + 1, `세트 ${n + 1}`),
          ),
        ),
      ),
    );
    await expect(
      saveNoticeEdit(api, {
        kind: 'duplicate',
        id: createNoticeSetId(uuid(2, 1)),
        copyId: createNoticeSetId(uuid(2, 900)),
      }),
    ).rejects.toThrow('is full');
  });
});

describe('복제 of a 그래픽', () => {
  const prop = (n: number, name: string) => ({
    id: uuid(3, n),
    name,
    content: {kind: 'image', media: MEDIA},
    targets: [SCREEN],
  });
  const file = (props: readonly object[]) => ({
    format: 'llsettings.props',
    schemaVersion: 1,
    props,
  });

  it('copies the content and screens after the original', async () => {
    const {api, edit} = apiWith(
      documentOf('props', file([prop(1, '로고'), prop(2, '배너')])),
    );
    const copyId = createPropId(uuid(3, 50));
    await savePropEdit(api, {
      kind: 'duplicate',
      id: createPropId(uuid(3, 1)),
      copyId,
    });
    expect(written(edit)).toMatchObject({
      props: [
        {id: uuid(3, 1), name: '로고'},
        {
          id: copyId,
          name: '로고 복사본',
          content: {kind: 'image', media: MEDIA},
          targets: [SCREEN],
        },
        {id: uuid(3, 2), name: '배너'},
      ],
    });
  });

  it('refuses a copy past the cap', async () => {
    const {api} = apiWith(
      documentOf(
        'props',
        file(
          Array.from({length: MAX_PROPS}, (_, n) =>
            prop(n + 1, `그래픽 ${n + 1}`),
          ),
        ),
      ),
    );
    await expect(
      savePropEdit(api, {
        kind: 'duplicate',
        id: createPropId(uuid(3, 1)),
        copyId: createPropId(uuid(3, 900)),
      }),
    ).rejects.toThrow('is full');
  });
});

describe('복제 of a 타이머', () => {
  const timer = (n: number, name: string) => ({
    id: uuid(4, n),
    name,
    kind: 'countdown',
    duration: 90,
    overrun: false,
  });
  const file = (timers: readonly object[]) => ({
    format: 'llsettings.timers',
    schemaVersion: 1,
    timers,
  });

  it('copies the definition, not the run, right after the original', async () => {
    const {api, edit} = apiWith(
      documentOf('timers', file([timer(1, '설교'), timer(2, '헌금')])),
    );
    const copyId = createTimerId(uuid(4, 50));
    await duplicateTimer(api, {id: createTimerId(uuid(4, 1)), copyId});
    expect(written(edit)).toMatchObject({
      timers: [
        {id: uuid(4, 1), name: '설교'},
        {
          id: copyId,
          name: '설교 복사본',
          kind: 'countdown',
          duration: 90,
          overrun: false,
        },
        {id: uuid(4, 2), name: '헌금'},
      ],
    });
  });

  it('writes nothing for a copy that is already there, and refuses one past the cap', async () => {
    const copyId = createTimerId(uuid(4, 50));
    const there = apiWith(
      documentOf(
        'timers',
        file([timer(1, '설교'), {...timer(1, '설교 복사본'), id: copyId}]),
      ),
    );
    await duplicateTimer(there.api, {id: createTimerId(uuid(4, 1)), copyId});
    expect(there.edit).not.toHaveBeenCalled();
    const full = apiWith(
      documentOf(
        'timers',
        file(
          Array.from({length: MAX_TIMER_DEFINITIONS}, (_, n) =>
            timer(n + 1, `타이머 ${n + 1}`),
          ),
        ),
      ),
    );
    await expect(
      duplicateTimer(full.api, {
        id: createTimerId(uuid(4, 1)),
        copyId: createTimerId(uuid(4, 900)),
      }),
    ).rejects.toThrow('is full');
  });
});

describe('복제 of a 매크로 모음', () => {
  const macro = (n: number) => ({
    id: uuid(5, n),
    name: `매크로 ${n}`,
    icon: 'bolt',
    color: 'teal',
    actions: [],
  });
  const collection = (
    n: number,
    name: string,
    macroIds: readonly string[],
  ) => ({
    id: uuid(6, n),
    name,
    macroIds,
  });
  const file = (collections: readonly object[]) => ({
    format: 'llsettings.macros',
    schemaVersion: 1,
    macros: [macro(1), macro(2)],
    collections,
  });

  it('copies the members, so both collections hold the same 매크로', async () => {
    const {api, edit} = apiWith(
      documentOf(
        'macros',
        file([
          collection(1, '예배', [uuid(5, 1), uuid(5, 2)]),
          collection(2, '행사', []),
        ]),
      ),
    );
    await saveMacroCollectionEdit(api, {
      kind: 'duplicate',
      id: collectionId(1),
      copyId: collectionId(50),
    });
    expect(written(edit)).toMatchObject({
      collections: [
        {id: uuid(6, 1), name: '예배'},
        {
          id: uuid(6, 50),
          name: '예배 복사본',
          macroIds: [uuid(5, 1), uuid(5, 2)],
        },
        {id: uuid(6, 2), name: '행사'},
      ],
    });
  });

  it('refuses a copy past the cap', async () => {
    const {api} = apiWith(
      documentOf(
        'macros',
        file(
          Array.from({length: MACRO_FILE_LIMITS.collections}, (_, n) =>
            collection(n + 1, `모음 ${n + 1}`, []),
          ),
        ),
      ),
    );
    await expect(
      saveMacroCollectionEdit(api, {
        kind: 'duplicate',
        id: collectionId(1),
        copyId: collectionId(900),
      }),
    ).rejects.toThrow('is full');
  });
});
