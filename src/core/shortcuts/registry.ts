import type {KeyBinding, KeyModifier} from '../schema/shortcuts';

export type CommandContext =
  | 'control'
  | 'show'
  | 'prep'
  | 'screens'
  | 'import'
  | 'song'
  | 'service'
  | 'arrangement'
  | 'canvas'
  | 'search';
export type CommandPriority = 'clear' | 'zoom' | 'normal';

export interface ShortcutCommand {
  readonly id: string;
  readonly name: string;
  readonly group: string;
  readonly contexts: readonly CommandContext[];
  readonly defaults: readonly KeyBinding[];
  readonly priority: CommandPriority;
  readonly repeat: boolean;
  readonly output: boolean;
}

type CommandDefinition = readonly [
  id: string,
  name: string,
  group: string,
  contexts: readonly CommandContext[],
  keys: readonly string[],
];

function command([
  id,
  name,
  group,
  contexts,
  keys,
]: CommandDefinition): ShortcutCommand {
  return {
    id,
    name,
    group,
    contexts,
    defaults: keys.map(key => {
      const parts = key.split(' ');
      const code = parts.pop() ?? '';
      const mods: KeyModifier[] = [];
      if (parts.includes('ctrl')) mods.push('ctrl');
      if (parts.includes('alt')) mods.push('alt');
      if (parts.includes('shift')) mods.push('shift');
      return {code, mods};
    }),
    priority:
      id.startsWith('clear.') && id !== 'clear.undo'
        ? 'clear'
        : id.startsWith('ui.zoom')
          ? 'zoom'
          : 'normal',
    output:
      /^(clear|show|output|audio|notice|stage)\./.test(id) ||
      [
        'service.nextItem',
        'service.previousItem',
        'service.revealLive',
        'media.nextBackground',
        'media.previousBackground',
      ].includes(id),
    repeat:
      id.startsWith('ui.zoom') ||
      id.startsWith('stageEditor.move') ||
      id === 'service.nextItem' ||
      id === 'service.previousItem' ||
      id === 'service.revealLive',
  };
}

/** Current defaults, independent of the later user-supplied key map. */
export const shortcutCommands: readonly ShortcutCommand[] = (
  [
    [
      'show.next',
      '다음 슬라이드',
      '슬라이드',
      ['show'],
      ['ArrowRight', 'Space', 'PageDown'],
    ],
    [
      'show.previous',
      '이전 슬라이드',
      '슬라이드',
      ['show'],
      ['ArrowLeft', 'PageUp'],
    ],
    ['show.first', '첫 슬라이드', '슬라이드', ['show'], []],
    ['show.last', '마지막 슬라이드', '슬라이드', ['show'], []],
    [
      'service.nextItem',
      '다음 항목',
      '예배 순서',
      ['show'],
      ['ctrl ArrowDown'],
    ],
    [
      'service.previousItem',
      '이전 항목',
      '예배 순서',
      ['show'],
      ['ctrl ArrowUp'],
    ],
    [
      'service.revealLive',
      '출력 중인 항목 열기',
      '예배 순서',
      ['show'],
      ['ctrl KeyL'],
    ],
    [
      'service.revealLibrary',
      '라이브러리에서 열기',
      '예배 순서',
      ['control'],
      [],
    ],
    ['service.switcher', '예배 순서 바꾸기', '예배 순서', ['control'], []],
    ['service.quickAdd', '항목 추가', '예배 순서', ['control'], []],
    ['clear.all', '모두 지우기 / 복원', '지우기', ['control'], ['F1']],
    ['clear.slide', '가사 지우기 / 복원', '지우기', ['control'], ['F2']],
    ['clear.media', '미디어 지우기 / 복원', '지우기', ['control'], ['F3']],
    ['clear.prop', '그래픽 지우기 / 복원', '지우기', ['control'], ['F4']],
    ['clear.audio', '오디오 지우기 / 복원', '지우기', ['control'], ['F5']],
    ['clear.message', '메시지 지우기 / 복원', '지우기', ['control'], ['F6']],
    ['clear.notice', '공지 지우기 / 복원', '지우기', ['control'], ['F7']],
    ['clear.undo', '되돌리기', '지우기', ['control'], []],
    ['stage.hideMessage', '무대 메시지 내리기', '지우기', ['control'], []],
    ['output.audience', '청중 화면 출력', '화면', ['control'], []],
    ['output.stage', '무대 화면 출력', '화면', ['control'], []],
    ['screens.redetect', '모니터 다시 찾기', '화면', ['control'], []],
    ['screens.showFallbackWindow', '창 보기', '화면', ['control'], []],
    ['look.menu', 'Look 메뉴', 'Look', ['control'], []],
    ['media.nextBackground', '다음 배경', '진행 도구', ['show'], []],
    ['media.previousBackground', '이전 배경', '진행 도구', ['show'], []],
    ['tools.showing', '표시 중 탭', '진행 도구', ['show'], []],
    ['tools.audio', '오디오 탭', '진행 도구', ['show'], []],
    ['tools.stage', '무대 탭', '진행 도구', ['show'], []],
    ['tools.timers', '타이머 탭', '진행 도구', ['show'], []],
    ['tools.messages', '메시지 탭', '진행 도구', ['show'], []],
    ['tools.notices', '공지 탭', '진행 도구', ['show'], []],
    ['tools.props', '그래픽 탭', '진행 도구', ['show'], []],
    ['tools.macros', '매크로 탭', '진행 도구', ['show'], []],
    ['tools.actionPalette', '동작 팔레트', '진행 도구', ['show'], []],
    ['bible.focus', '성경 구절 찾기', '진행 도구', ['show'], []],
    [
      'audio.playPause',
      '오디오 재생 또는 일시 정지',
      '진행 도구',
      ['control'],
      [],
    ],
    ['audio.next', '다음 곡', '진행 도구', ['control'], []],
    ['audio.previous', '이전 곡', '진행 도구', ['control'], []],
    ['audio.fadeOut', '오디오 페이드 아웃', '진행 도구', ['control'], []],
    [
      'notice.pauseResume',
      '공지 일시 정지 또는 재생',
      '진행 도구',
      ['control'],
      [],
    ],
    ['stage.sendMessage', '무대 메시지 보내기', '진행 도구', ['show'], []],
    ['message.send', '메시지 보내기', '진행 도구', ['show'], []],
    ['audio.toggleRepeat', '오디오 반복', '진행 도구', ['control'], []],
    ['macro.new', '새 매크로', '진행 도구', ['show'], []],
    [
      'workspace.show',
      '진행',
      '작업 공간',
      ['show', 'prep', 'screens'],
      ['ctrl KeyS'],
    ],
    [
      'workspace.prep',
      '준비',
      '작업 공간',
      ['control'],
      ['ctrl KeyR', 'ctrl KeyE'],
    ],
    [
      'workspace.screens',
      '화면 설정',
      '작업 공간',
      ['control'],
      ['ctrl alt Digit1'],
    ],
    ['workspace.looks', 'Look 편집', '작업 공간', ['control'], []],
    ['workspace.stage', '무대 배치 편집', '작업 공간', ['control'], []],
    [
      'workspace.media',
      '미디어',
      '작업 공간',
      ['control'],
      ['ctrl shift KeyV'],
    ],
    ['search.focus', '찾기', '찾기', ['control'], ['ctrl KeyF']],
    ['library.newSong', '새 곡', '준비 편집', ['control'], []],
    [
      'import.textFile',
      '텍스트 파일 가져오기',
      '준비 편집',
      ['control'],
      ['ctrl shift KeyI'],
    ],
    [
      'import.clipboard',
      '클립보드 텍스트 가져오기',
      '준비 편집',
      ['control'],
      [],
    ],
    ['service.new', '새 예배', '준비 편집', ['control'], []],
    [
      'service.importItems',
      '다른 예배에서 가져오기',
      '준비 편집',
      ['control'],
      [],
    ],
    [
      'service.saveAsTemplate',
      '지금 예배를 템플릿으로 저장',
      '준비 편집',
      ['control'],
      [],
    ],
    [
      'edit.undo',
      '실행 취소 (edit undo)',
      '준비 편집',
      ['song', 'service'],
      ['ctrl KeyZ'],
    ],
    [
      'edit.redo',
      '다시 실행',
      '준비 편집',
      ['song', 'service'],
      ['ctrl KeyY', 'ctrl shift KeyZ'],
    ],
    [
      'editor.splitSlide',
      '슬라이드 나누기',
      '준비 편집',
      ['song'],
      ['ctrl Enter'],
    ],
    [
      'editor.newSlide',
      '새 슬라이드',
      '준비 편집',
      ['song'],
      ['ctrl shift KeyN'],
    ],
    ['editor.labelMenu', '이름표 메뉴', '준비 편집', ['song'], ['ctrl KeyG']],
    [
      'arrangement.moveLeft',
      '칩 왼쪽으로',
      '준비 편집',
      ['arrangement'],
      ['alt ArrowLeft'],
    ],
    [
      'arrangement.moveRight',
      '칩 오른쪽으로',
      '준비 편집',
      ['arrangement'],
      ['alt ArrowRight'],
    ],
    ['edit.duplicate', '복제', '준비 편집', ['control'], []],
    [
      'edit.delete',
      '삭제',
      '준비 편집',
      ['service', 'arrangement', 'canvas'],
      ['Delete'],
    ],
    ['import.save', '가져온 곡 저장', '준비 편집', ['import'], ['ctrl KeyS']],
    ['media.import', '미디어 가져오기', '준비 편집', ['control'], []],
    ['media.newPlaylist', '새 재생목록', '준비 편집', ['control'], []],
    [
      'media.newAudioPlaylist',
      '새 오디오 재생목록',
      '준비 편집',
      ['control'],
      [],
    ],
    ['media.relink', '다시 연결 (relink)', '준비 편집', ['control'], []],
    ['arrangement.add', '구성 추가', '준비 편집', ['arrangement'], []],
    [
      'arrangement.insertSlide',
      '슬라이드 넣기',
      '준비 편집',
      ['arrangement'],
      [],
    ],
    ['import.pptx', 'PowerPoint 파일 가져오기', '준비 편집', ['control'], []],
    [
      'stageEditor.fit',
      '화면에 맞춤 (canvas zoom)',
      '화면 설정 편집',
      ['control'],
      [],
    ],
    ['screens.identify', '모니터 번호 표시', '화면 설정 편집', ['control'], []],
    ['look.new', 'Look 추가', '화면 설정 편집', ['control'], []],
    ['stageLayout.new', '새 배치', '화면 설정 편집', ['control'], []],
    ['stageEditor.addElement', '요소 추가', '화면 설정 편집', ['control'], []],
    ['app.preferences', '환경설정', '창과 메뉴', ['control'], []],
    ['app.quit', '종료', '창과 메뉴', ['control'], []],
    ['app.openLogs', '로그 폴더 열기', '창과 메뉴', ['control'], []],
    ['app.about', '버전 정보', '창과 메뉴', ['control'], []],
    ['window.minimize', '최소화', '창과 메뉴', ['control'], []],
    ['window.maximize', '최대화', '창과 메뉴', ['control'], []],
    [
      'ui.zoomIn',
      'UI 확대',
      '창과 메뉴',
      ['control'],
      ['ctrl Equal', 'ctrl shift Equal', 'ctrl NumpadAdd'],
    ],
    [
      'ui.zoomOut',
      'UI 축소',
      '창과 메뉴',
      ['control'],
      ['ctrl Minus', 'ctrl NumpadSubtract'],
    ],
    [
      'ui.zoomReset',
      'UI 확대 초기화',
      '창과 메뉴',
      ['control'],
      ['ctrl Digit0', 'ctrl Numpad0'],
    ],
    ['ui.resetLayout', '화면 배치 초기화', '창과 메뉴', ['control'], []],
    [
      'bible.nextVerse',
      '다음 성경 구절',
      '진행 도구',
      ['show'],
      ['shift ArrowRight'],
    ],
    [
      'bible.previousVerse',
      '이전 성경 구절',
      '진행 도구',
      ['show'],
      ['shift ArrowLeft'],
    ],
    [
      'search.addToService',
      '예배 순서에 추가',
      '찾기',
      ['search'],
      ['ctrl Enter'],
    ],
    [
      'stageEditor.moveLeft',
      '요소 왼쪽으로 1px',
      '화면 설정',
      ['canvas'],
      ['ArrowLeft'],
    ],
    [
      'stageEditor.moveLeftLarge',
      '요소 왼쪽으로 10px',
      '화면 설정',
      ['canvas'],
      ['shift ArrowLeft'],
    ],
    [
      'stageEditor.moveRight',
      '요소 오른쪽으로 1px',
      '화면 설정',
      ['canvas'],
      ['ArrowRight'],
    ],
    [
      'stageEditor.moveRightLarge',
      '요소 오른쪽으로 10px',
      '화면 설정',
      ['canvas'],
      ['shift ArrowRight'],
    ],
    [
      'stageEditor.moveUp',
      '요소 위로 1px',
      '화면 설정',
      ['canvas'],
      ['ArrowUp'],
    ],
    [
      'stageEditor.moveUpLarge',
      '요소 위로 10px',
      '화면 설정',
      ['canvas'],
      ['shift ArrowUp'],
    ],
    [
      'stageEditor.moveDown',
      '요소 아래로 1px',
      '화면 설정',
      ['canvas'],
      ['ArrowDown'],
    ],
    [
      'stageEditor.moveDownLarge',
      '요소 아래로 10px',
      '화면 설정',
      ['canvas'],
      ['shift ArrowDown'],
    ],
  ] satisfies readonly CommandDefinition[]
).map(command);
