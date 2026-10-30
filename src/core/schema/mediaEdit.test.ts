import {describe, expect, it} from 'vitest';
import {
  parseMediaDocument,
  parseMediaEdit,
  parseMediaEditResult,
  parseMediaImportRequest,
  parseMediaImportResult,
  parseMediaImportProgress,
} from './mediaEdit';
import {expectSuccess} from './testHelpers';

const ID = '6f1c2a9e-4b7d-4c1a-9e2f-0123456789ab';
const playlist = {id: ID, name: '재생목록', items: [ID]};
const progress = {
  mediaId: ID,
  fileName: '새 배경.webm',
  phase: 'copying',
  percent: 25.5,
};

describe('media list edits', () => {
  it.each([
    {type: 'media.playlist.create', kind: 'media'},
    {type: 'media.playlist.create', kind: 'audio'},
    {
      type: 'media.playlist.update',
      playlist: {kind: 'media', value: playlist},
      baseRevision: 1,
    },
    {
      type: 'media.playlist.update',
      playlist: {kind: 'audio', value: {...playlist, loop: true}},
      baseRevision: 1,
    },
    {type: 'media.playlist.delete', playlist: {kind: 'media', id: ID}},
    {type: 'media.playlist.delete', playlist: {kind: 'audio', id: ID}},
    {
      type: 'media.properties.update',
      mediaId: ID,
      changes: {name: '이름'},
      baseRevision: 1,
    },
    {
      type: 'media.properties.update',
      mediaId: ID,
      changes: {
        props: {
          in: 0,
          out: 10,
          speed: 1,
          end: 'loop',
          fit: 'fill',
          audio: false,
          volume: 0,
        },
      },
      baseRevision: 1,
    },
    {type: 'media.relink', mediaId: ID},
    {type: 'media.delete', mediaId: ID},
    {type: 'media.import.cancel', mediaId: ID},
  ])('accepts %j', edit => {
    expect(expectSuccess(parseMediaEdit(edit))).toEqual(edit);
  });

  it.each([
    [],
    {type: 'media.delete', mediaId: 'bad'},
    {type: 'media.playlist.create', kind: 'other'},
    {
      type: 'media.playlist.update',
      playlist: {kind: 'audio', value: playlist},
      baseRevision: 1,
    },
    {type: 'media.playlist.update', playlist: {kind: 'media', value: playlist}},
    {type: 'media.playlist.delete', playlist: {kind: 'other', id: ID}},
    {
      type: 'media.properties.update',
      mediaId: ID,
      changes: {},
      baseRevision: 1,
    },
    {
      type: 'media.properties.update',
      mediaId: ID,
      changes: {props: {in: 5, out: 2}},
      baseRevision: 1,
    },
    {
      type: 'media.properties.update',
      mediaId: ID,
      changes: {props: {speed: 0}},
      baseRevision: 1,
    },
    {
      type: 'media.properties.update',
      mediaId: ID,
      changes: {props: {volume: 101}},
      baseRevision: 1,
    },
    {
      type: 'media.properties.update',
      mediaId: ID,
      changes: {name: '이름'},
      baseRevision: 0,
    },
    {type: 'media.relink', mediaId: null},
    {type: 'media.import.cancel'},
  ])('rejects malformed edit %j', edit => {
    expect(parseMediaEdit(edit).ok).toBe(false);
  });

  it('lets main choose the relink file and keeps future playlist fields', () => {
    expect(
      expectSuccess(
        parseMediaEdit({type: 'media.relink', mediaId: ID, path: 'ignored'}),
      ),
    ).toEqual({type: 'media.relink', mediaId: ID});
    const edit = {
      type: 'media.playlist.update',
      playlist: {kind: 'media', value: {...playlist, future: true}},
      baseRevision: 1,
    };
    expect(expectSuccess(parseMediaEdit(edit))).toEqual(edit);
  });
});

describe('media import contracts', () => {
  it('accepts picker and dropped files with a selected playlist or library target', () => {
    for (const source of [
      {kind: 'dialog'},
      {kind: 'files', paths: ['D:\\media\\clip.webm']},
    ]) {
      for (const target of [
        null,
        {kind: 'media', id: ID},
        {kind: 'audio', id: ID},
      ]) {
        const request = {source, playlist: target};
        expect(expectSuccess(parseMediaImportRequest(request))).toEqual(
          request,
        );
      }
    }
  });

  it.each([
    {source: [], playlist: null},
    {source: {kind: 'files', paths: []}, playlist: null},
    {source: {kind: 'files', paths: [' ']}, playlist: null},
    {source: {kind: 'dialog'}, playlist: {kind: 'audio', id: 'bad'}},
  ])('rejects malformed import %j', request => {
    expect(parseMediaImportRequest(request).ok).toBe(false);
  });

  it('accepts every bounded progress phase and cancellation', () => {
    for (const value of [
      {...progress, phase: 'queued', percent: 0},
      progress,
      {...progress, phase: 'analysing'},
      {...progress, phase: 'complete', percent: 100},
      {...progress, phase: 'failed', message: 'Copy failed'},
      {...progress, phase: 'cancelled'},
    ]) {
      expect(expectSuccess(parseMediaImportProgress(value))).toEqual(value);
    }
    expect(
      expectSuccess(parseMediaImportResult({ok: true, value: []})),
    ).toEqual({ok: true, value: []});
    expect(parseMediaImportResult({ok: true, value: [progress]}).ok).toBe(true);
  });

  it.each([
    {...progress, mediaId: 'bad'},
    {...progress, percent: 101},
    {...progress, percent: -1},
    {...progress, phase: 'complete'},
    {...progress, phase: 'failed'},
    {...progress, phase: 'other'},
  ])('rejects malformed progress %j', value => {
    expect(parseMediaImportProgress(value).ok).toBe(false);
  });

  it('rejects duplicate reserved ids and malformed import result envelopes', () => {
    expect(
      parseMediaImportResult({ok: true, value: [progress, progress]}).ok,
    ).toBe(false);
    expect(parseMediaImportResult({ok: true, value: null}).ok).toBe(false);
    expect(
      parseMediaImportResult({
        ok: false,
        error: {reason: 'other', message: 'bad'},
      }).ok,
    ).toBe(false);
  });
});

describe('media documents and edit results', () => {
  it('checks read metadata, file fields, and duration-relative trims', () => {
    const document = {
      name: 'media',
      revision: 1,
      access: 'editable',
      value: {
        format: 'llmedia',
        schemaVersion: 1,
        items: [],
        playlists: [],
        audioPlaylists: [],
        future: true,
      },
    };
    expect(expectSuccess(parseMediaDocument(document))).toEqual(document);
    expect(parseMediaDocument({...document, name: 'labels'}).ok).toBe(false);
    expect(parseMediaDocument({...document, revision: 0}).ok).toBe(false);
    expect(
      parseMediaDocument({
        ...document,
        value: {
          ...document.value,
          items: [
            {
              id: ID,
              name: '새 배경',
              kind: 'video',
              file: 'clip.webm',
              size: 1,
              duration: 5,
              props: {out: 6},
            },
          ],
        },
      }).ok,
    ).toBe(false);
  });

  it('keeps applied write failures, normal successes, and null cancellations distinct', () => {
    for (const result of [
      {ok: true, value: {id: ID, revision: 2}},
      {ok: true, value: null},
      {
        ok: false,
        error: {
          reason: 'write-failed',
          message: 'Locked',
          applied: {id: ID, revision: 2},
          unchangedFiles: ['media.json'],
        },
      },
    ]) {
      expect(expectSuccess(parseMediaEditResult(result))).toEqual(result);
    }
    expect(
      parseMediaEditResult({
        ok: false,
        error: {reason: 'write-failed', message: 'Locked'},
      }).ok,
    ).toBe(false);
  });
});
