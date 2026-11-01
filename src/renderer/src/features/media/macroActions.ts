import type {MacroActionDescriptor} from '@renderer/platform/macroActionDescriptor';

/** The 매크로 actions that play or show media. */
export const MEDIA_MACRO_ACTIONS = {
  media: {
    kind: 'media',
    label: '배경 미디어',
    icon: 'image',
    paletteGroup: '내용',
  },
  audio: {
    kind: 'audio',
    label: '오디오',
    icon: 'audio',
    paletteGroup: '소리',
  },
  audioPlaylist: {
    kind: 'audioPlaylist',
    label: '오디오 재생 목록',
    icon: 'wave',
    paletteGroup: '소리',
  },
} as const satisfies Readonly<Record<string, MacroActionDescriptor>>;
