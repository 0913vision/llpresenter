import type {TextImportReadRequest} from '@shared/schema/textImport';
import type {ServiceActionEntries} from '@renderer/prep/services/useServiceActions';
import type {MenuEntry, MenuItem} from '@renderer/ui/menuModel';
import {laterRow, menuSeparator} from '@renderer/ui/menuRows';

type ImportText = (source: TextImportReadRequest['source']) => void;

interface FileMenuInput {
  readonly service: ServiceActionEntries;
  readonly onImportText: ImportText | undefined;
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
    meta: source === 'file' ? 'Ctrl Shift I' : undefined,
    disabled:
      onImportText === undefined ||
      (source === 'clipboard' && clipboard !== 'ready'),
    title:
      onImportText === undefined
        ? '텍스트 가져오기를 준비 중입니다'
        : source === 'file' || clipboard === 'ready'
          ? undefined
          : clipboard === 'checking'
            ? '클립보드 확인 중'
            : '가져올 클립보드 텍스트가 없습니다',
    onSelect: () => onImportText?.(source),
  };
}

export function fileMenuEntries(input: FileMenuInput): readonly MenuEntry[] {
  const {service, media} = input;
  return [
    laterRow('new-song', '새 곡'),
    {...service.newService, icon: undefined},
    laterRow('new-library', '새 라이브러리'),
    {
      kind: 'item',
      id: 'import',
      label: '가져오기',
      submenu: [
        textImportRow(input, 'file'),
        laterRow('import-library', '라이브러리…'),
        media,
        textImportRow(input, 'clipboard'),
        {...service.importItems, label: '다른 예배…', icon: undefined},
        menuSeparator('providers'),
        laterRow('multitracks', 'MultiTracks…'),
        laterRow('songselect', 'SongSelect…'),
        menuSeparator('powerpoint'),
        laterRow('powerpoint-slides', 'PowerPoint를 슬라이드로…'),
        laterRow('powerpoint-images', 'PowerPoint를 그림으로…'),
        laterRow('powerpoint-objects', 'PowerPoint를 개체와 글자로…'),
      ],
    },
    menuSeparator('export'),
    laterRow('export', '내보내기', {submenu: true}),
    {
      ...service.saveTemplate,
      label: '예배를 템플릿으로 저장…',
      icon: undefined,
    },
    menuSeparator('print'),
    laterRow('print', '인쇄…'),
  ];
}
