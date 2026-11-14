import {NOT_YET} from '@renderer/ui/menuRows';
import {windowCommandLabels} from '@renderer/ui/windowCommandLabels';
import {shortcutText} from '@renderer/ui/commandBindings';
import type {TextImportReadRequest} from '@core/schema/textImport';
import type {ServiceActionEntries} from '@renderer/features/service/list/useServiceActions';
import {
  menuAvailability,
  type MenuEntry,
  type MenuItem,
} from '@renderer/ui/menuModel';
import {laterRow, menuSeparator} from '@renderer/ui/menuRows';

type ImportText = (
  source: TextImportReadRequest['source'] | 'powerpoint' | 'powerpoint-images',
) => void;

interface FileMenuInput {
  readonly service: ServiceActionEntries;
  readonly onImportText: ImportText | undefined;
  readonly onNewSong: (() => void) | undefined;
  readonly onOpenService: (() => void) | undefined;
  readonly clipboard: 'checking' | 'empty' | 'ready';
  readonly media: MenuItem;
}

function textImportRow(
  input: FileMenuInput,
  source: TextImportReadRequest['source'],
): MenuItem {
  const {onImportText, clipboard} = input;
  return {
    kind: 'item',
    id: `import:${source}`,
    label: source === 'file' ? '텍스트 파일…' : '클립보드 텍스트…',
    command: source === 'file' ? 'import.textFile' : 'import.clipboard',
    meta: shortcutText(
      source === 'file' ? 'import.textFile' : 'import.clipboard',
    ),
    ...menuAvailability(
      onImportText === undefined
        ? NOT_YET
        : source === 'file' || clipboard === 'ready'
          ? undefined
          : clipboard === 'checking'
            ? '확인 중'
            : '클립보드에 텍스트가 없습니다',
    ),
    onSelect: () => onImportText?.(source),
  };
}

export function fileMenuEntries(input: FileMenuInput): readonly MenuEntry[] {
  const {service, media} = input;
  return [
    {
      kind: 'item',
      id: 'new-song',
      label: '새 곡',
      command: 'library.newSong',
      ...menuAvailability(input.onNewSong === undefined ? NOT_YET : undefined),
      onSelect: () => input.onNewSong?.(),
    },
    {...service.newService, command: 'service.new', icon: undefined},
    {
      kind: 'item',
      id: 'open-service',
      label: '예배 열기…',
      command: 'service.switcher',
      meta: shortcutText('service.switcher'),
      ...menuAvailability(
        input.onOpenService === undefined
          ? '지금은 예배를 열 수 없습니다'
          : undefined,
      ),
      onSelect: () => input.onOpenService?.(),
    },
    laterRow('new-library', '새 라이브러리'),
    {
      kind: 'item',
      id: 'import',
      label: '가져오기',
      submenu: [
        textImportRow(input, 'file'),
        laterRow('import-library', '라이브러리…'),
        {...media, command: 'media.import'},
        textImportRow(input, 'clipboard'),
        {
          ...service.importItems,
          command: 'service.importItems',
          label: '다른 예배…',
          icon: undefined,
        },
        menuSeparator('providers'),
        laterRow('multitracks', 'MultiTracks…'),
        laterRow('songselect', 'SongSelect…'),
        menuSeparator('powerpoint'),
        {
          kind: 'item',
          id: 'powerpoint-slides',
          label: 'PowerPoint를 슬라이드로…',
          command: 'import.pptx',
          meta: shortcutText('import.pptx'),
          ...menuAvailability(
            input.onImportText === undefined ? NOT_YET : undefined,
          ),
          onSelect: () => input.onImportText?.('powerpoint'),
        },
        {
          kind: 'item',
          id: 'powerpoint-images',
          label: 'PowerPoint를 이미지로…',
          ...menuAvailability(
            input.onImportText === undefined ? NOT_YET : undefined,
          ),
          onSelect: () => input.onImportText?.('powerpoint-images'),
        },
        laterRow('powerpoint-objects', 'PowerPoint를 개체와 글자로…'),
      ],
    },
    menuSeparator('export'),
    laterRow('export', '내보내기', {submenu: true}),
    {
      ...service.saveTemplate,
      command: 'service.saveAsTemplate',
      label: '예배를 템플릿으로 저장…',
      icon: undefined,
    },
    menuSeparator('print'),
    laterRow('print', '인쇄…'),
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
