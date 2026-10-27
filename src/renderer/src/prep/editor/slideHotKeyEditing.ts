import {checkPart} from '@shared/schema/fileFormat';
import type {Result} from '@shared/result';
import type {GroupedSong} from '@shared/schema/groupedSong';
import type {SongSlideSource} from '@shared/schema/showService';
import {slideHotKeySchema} from '@shared/schema/slideHotKey';
import type {SlideHotKeyAssignment} from './SlideHotKeyDialog';

/** Source-slide details for the editor, counted once in master group order. */
export interface SlideHotKeyView {
  readonly slideNumber: number;
  readonly value: string | undefined;
  readonly otherAssignments: readonly SlideHotKeyAssignment[];
}

/** Resolves source identity without expanding repeated arrangement groups. */
export function slideHotKeyView(
  song: GroupedSong,
  source: SongSlideSource,
): SlideHotKeyView | null {
  if (song.id !== source.songId) return null;
  let position = 0;
  let selected: {slideNumber: number; value: string | undefined} | undefined;
  const otherAssignments: SlideHotKeyAssignment[] = [];
  for (const group of song.groups) {
    group.slides.forEach((slide, index) => {
      position++;
      if (group.id === source.groupId && index === source.slideIndex) {
        selected = {slideNumber: position, value: slide.hotKey};
      } else if (slide.hotKey !== undefined) {
        otherAssignments.push({code: slide.hotKey, slideNumber: position});
      }
    });
  }
  return selected === undefined ? null : {...selected, otherAssignments};
}

/** Applies one source metadata edit; the caller owns history and persistence. */
export function assignSlideHotKey(
  song: GroupedSong,
  source: SongSlideSource,
  code: string | undefined,
): Result<GroupedSong, 'missing-source' | 'invalid-key' | 'duplicate-key'> {
  const view = slideHotKeyView(song, source);
  if (view === null) return {ok: false, error: 'missing-source'};
  if (code !== undefined && !checkPart(slideHotKeySchema, code).ok) {
    return {ok: false, error: 'invalid-key'};
  }
  if (
    code !== undefined &&
    view.otherAssignments.some(item => item.code === code)
  ) {
    return {ok: false, error: 'duplicate-key'};
  }
  if (view.value === code) return {ok: true, value: song};
  return {
    ok: true,
    value: {
      ...song,
      groups: song.groups.map(group =>
        group.id !== source.groupId
          ? group
          : {
              ...group,
              slides: group.slides.map((slide, index) => {
                if (index !== source.slideIndex) return slide;
                const {hotKey: removed, ...rest} = slide;
                return code === undefined ? rest : {...rest, hotKey: code};
              }),
            },
      ),
    },
  };
}
