import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {
  editorDeckSong,
  editorFixture,
} from '@fixtures/renderer/features/songs/editor/editorFixture';
import {fixtureMedia} from '@fixtures/core/mediaList';
import {SongSession} from '@renderer/features/songs/editor/songSession';
import {selectedPreview} from '@renderer/features/songs/editor/songPreviewModel';
import {projectSongTiles} from '@main/store/showService';
import {slideLayerOf} from '@core/presentation/slideLayer';
import {slidesOutput} from '@core/presentation/slides';

describe('song background across slide additions', () => {
  it.each(['split', 'duplicate', 'insert', 'paste'] as const)(
    '%s, with the background set before and after',
    path => {
      for (const when of ['before', 'after'] as const) {
        const fixture = editorFixture();
        const document = editorDeckSong(3);
        const session = new SongSession({
          document,
          api: fixture.api.content,
          persistence: 'manual',
          changed: vi.fn(),
          problem: vi.fn(),
        });
        onTestFinished(() => session.discard());
        if (when === 'before') session.setBackground(fixtureMedia.warm);
        const first = session.history.snapshot.song.slides[0];
        if (!first) throw new Error('Missing first slide');
        session.select({block: 0, start: 3, end: 3});
        if (path === 'split') session.edit({type: 'split'});
        if (path === 'insert') session.edit({type: 'insert'});
        if (path === 'duplicate') {
          session.selectSlides({type: 'click', id: first.id});
          session.commandSlides({type: 'duplicate'});
        }
        if (path === 'paste') session.pasteSlides('pasted words');
        if (when === 'after') session.setBackground(fixtureMedia.warm);
        const song = {
          ...session.history.snapshot.song,
          ...(session.background === undefined
            ? {}
            : {background: session.background}),
        };
        expect(song.slides).toHaveLength(4);
        const tiles = projectSongTiles(song, new Map()).tiles;
        for (const [index, slide] of song.slides.entries()) {
          expect(
            selectedPreview(song, {
              block: index,
              background: session.background,
            }).media?.mediaId,
          ).toBe(fixtureMedia.warm);
          expect(slide.picture).toBeUndefined();
          const layer = slideLayerOf({itemId: song.id, index}, () => tiles);
          if (layer === null) throw new Error('Missing output slide');
          expect(
            slidesOutput(layer, {mediaId: fixtureMedia.warm, loop: true})
              .commands[0],
          ).toMatchObject({
            type: 'media.show',
            media: {mediaId: fixtureMedia.warm},
          });
        }
      }
    },
  );
  it('uses the selected song background over a pasted slide picture in previews and output tiles', () => {
    const song = {...editorDeckSong(3).song, background: fixtureMedia.warm};
    const fixture = editorFixture();
    const session = new SongSession({
      document: {...editorDeckSong(3), song},
      api: fixture.api.content,
      persistence: 'manual',
      changed: vi.fn(),
      problem: vi.fn(),
    });
    onTestFinished(() => session.discard());
    const first = song.slides[0];
    if (first === undefined) throw new Error('Missing source slide');
    const pictured = {...first, picture: fixtureMedia.dawn};
    session.selectSlides({type: 'gap', index: 1});
    session.commandSlides({type: 'paste', slides: [pictured]});
    const mixed = {
      ...session.history.snapshot.song,
      background: fixtureMedia.warm,
    };
    expect(
      selectedPreview(mixed, {block: 1, background: mixed.background}).media
        ?.mediaId,
    ).toBe(fixtureMedia.warm);
    expect(
      projectSongTiles(mixed, new Map()).tiles[1]?.picture,
    ).toBeUndefined();
    const {background: _background, ...withoutBackground} = mixed;
    expect(
      selectedPreview(withoutBackground, {block: 1, background: undefined})
        .media?.mediaId,
    ).toBe(fixtureMedia.dawn);
    expect(
      projectSongTiles(withoutBackground, new Map()).tiles[1]?.picture,
    ).toBe(fixtureMedia.dawn);
  });
});
