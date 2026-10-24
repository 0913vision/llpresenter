# LoveLight 디자인 시스템 작업 규칙 (작업자용, 게시하지 않음)

LoveLight Presenter는 교회 예배용 가사 출력 앱이다 (ProPresenter와 비슷한 Electron + React 앱, 다크 UI 하나). 시안은 이미 확정되어 있고, 지금 하는 일은 **시안에 쓰인 모든 요소를 디자인 시스템으로 확정하고 문서화**하는 것이다. 개발자가 이 문서만 보고 React 컴포넌트를 만들 수 있어야 한다.

모든 경로는 이 파일이 있는 폴더(`ds/`) 기준이다.

## 1. 원천 자료

- 시안 보드: `../llp-design/project/*.dc.html` (각 보드는 1920×1080 화면 하나). 인라인 style에 실제 값이 들어 있다. 보드 목록과 이름은 `../llp-design/project/canvas.json`의 `boards` 중 `page: "v2"`.
  - ShowH(진행 화면), Compact(1366×768 진행 화면), Reflow(준비: 라이브러리 곡 편집), PrepService(준비: 예배 순서 항목), Screens(화면 설정), ScreensNDI, Looks(Look 편집), Overlays(진행 도구 8개 탭), Macros(매크로 격자, 목록, 우클릭 메뉴, 동작 팔레트), Outputs(세 화면 출력), Problems(모니터 빠짐 알림, 미디어 없음), Recovery(출력 상태 복구 창), Bible(성경 구절), NewService(새 예배 창), ServiceImport(다른 예배에서 가져오기), ServiceSwitch(예배 순서 목록 팝오버), AddSongs, AddSongsQuick, ImportMenu(파일 메뉴), ImportText, ImportEdit, ImportSave(같은 곡이 있을 때 확인 창), Media(미디어), StageEditor(무대 배치 편집), Prefs(환경설정), Shortcuts(단축키), ClearGroups(비교안, 참고만).
- 값 분포: `../llp-render/logs/audit.txt`(색, 글자 크기, 높이, 모서리, 그림자, 간격 빈도), `../llp-render/logs/audit-buttons.txt`(버튼 스타일 변형 121가지와 쓰인 보드).
- 보드의 공통 hover 규칙: `.hv:hover{background:#262626}`(투명 버튼과 줄), `.hvc:hover{background:#333333}`(채워진 컨트롤), `.tb:hover{background:#232323}`(툴바 버튼). 아이콘 `.i`는 기본 16px, `.i12 .i14 .i18 .i24 .i28`.
- 보드를 눈으로 보고 싶으면 `../llp-render/shots/` 에 이전 캡처가 있다(`ShowH-full.png`, `Compact-full.png` 등). 새로 찍을 필요는 없다.

## 2. 확정 토큰 (바꾸지 말 것)

`project/tokens.json`이 유일한 값의 원천이다. CSS 변수 이름은 토큰 이름 그대로다 (`var(--bg-control)`). 컴포넌트 CSS에 hex 값을 직접 쓰지 않는다. 필요한 토큰이 없으면 가장 가까운 토큰을 쓰고, 최종 보고에 "토큰 요청"으로 적는다.

자주 쓰는 것:
- 면: `--bg-app` #0e0e0e, `--bg-sunken` #0b0b0b, `--bg-well` #121212, `--bg-panel` #1c1c1c, `--bg-inset` #1a1a1a, `--bg-dialog` #1f1f1f, `--bg-control-off`(=bg-dialog), `--bg-toolbar-hover` #232323, `--bg-raised` #262626, `--bg-control` #2a2a2a, `--bg-control-hover` #333333, `--selection` #1f4170
- 선: `--line` #2b2b2b, `--line-strong` #3a3a3a, `--line-control` #6e6e6e
- 글자: `--text` #ececec, `--text-2` #b4b4b4, `--text-3` #8c8c8c(bg-control 위 금지), `--text-off` #6e6e6e, `--text-on-fill` #fff, `--text-on-label` #101010, `--text-on-selection` #b4c6e0
- 파랑: `--accent` #3d8bf0(선, 포커스, 고른 테두리), `--accent-fill` #2a70dc(면: 주 버튼, 켜진 체크/스위치), `--accent-fill-hover` #2566cc
- 상태: `--live` #d2343a, `--live-tint`, `--warning` #e3a23b, `--warning-tint`, `--ok` #3dbb6b, `--ok-tint`, `--chroma`, `--output-black`, `--scrim`
- 이름표: `--label-teal/green/yellow/orange/rose/violet/slate/gray`, `--label-none`
- 글자 스타일 클래스(tokens.css가 만든다): `.heading`(16/22/600) `.title`(13/18/600) `.body`(13/18/400) `.body-strong` `.label`(12/16/400) `.label-strong` `.band`(12/16/700) `.caption`(11/14/400) `.caption-strong` `.toolbar-label`(11/14/500) `.micro`(10/12/700). 컴포넌트 CSS에서는 클래스를 상속하지 말고 같은 값을 `font-size`, `line-height`, `font-weight`로 적되, README에는 스타일 이름을 적는다.
- 간격: `--space-2/4/6/8/10/12/14/16/20/24`, `--panel-gap` 4, `--panel-inset` 14, `--dialog-inset` 16
- 모서리: `--radius-xs` 2, `-sm` 3, `-md` 4, `-lg` 5, `-xl` 6, `-2xl` 8, `-tile` 14, `-full`
- 그림자/고리: `--shadow-popover`, `--shadow-dialog`, `--ring-live`(3px), `--ring-selected`(2px), `--ring-field`, `--ring-field-focus`, `--ring-field-error`, `--ring-dot-cut`
- 크기: `--size-menubar` 30, `--size-toolbar` 56, `--size-toolbar-compact` 40, `--size-statusbar` 28, `--size-panel-header` 34, `--size-control-xs` 22, `--size-control-sm` 26, `--size-control-md` 30, `--size-row` 30, `--size-row-menu` 28, `--size-row-double` 44, `--size-toolbar-button` 48, `--size-clear-button` 52, `--size-dialog-header` 44, `--size-dialog-footer` 52, `--size-thumb-band` 24, `--size-icon-12/14/16/18/24/28`, `--col-left` 280, `--col-right` 480, `--col-left-compact` 220, `--col-right-compact` 360, `--dialog-s` 460, `--dialog-m` 600, `--dialog-l` 820, `--dialog-xl` 1080, `--z-popover/tooltip/dialog/notification`

## 3. 확정 규칙 (시안과 다르면 이 규칙이 이긴다)

시안 안에서 같은 요소가 조금씩 다르게 그려진 곳이 있다. 아래가 최종 결정이다. 문서와 미리보기는 이 규칙대로 그리고, 시안과 달라지는 점은 README의 "시안과 달라진 점" 짧은 목록에 적는다(나중에 시안 보드를 이 규칙에 맞춰 고친다).

1. **컨트롤 높이는 두 가지**: sm 26px(글자 12px `label`, 좌우 10px, 앞 아이콘이 있으면 왼쪽 8px, 아이콘 14px, 아이콘과 글자 사이 6px), md 30px(글자 13px `body`, 좌우 14px, 앞 아이콘이 있으면 왼쪽 12px, 아이콘 16px, 사이 8px). 아이콘만 있는 버튼은 26×26(아이콘 16) 또는 30×30(아이콘 16). 24, 28, 32px 버튼은 없앤다. 예외: 메뉴줄 항목(24px), 창 조절 버튼(46×30), 툴바 버튼(48), 지우기 버튼(52), 세그먼트 항목(22).
   - sm은 패널 안(머리글, 캡션 줄, 속성 칸 안의 작은 조작)에, md는 대화상자, 확인 창, 환경설정, 툴바 검색 칸에 쓴다.
2. **보조 버튼**은 어디서나 `--bg-control` 바탕, `--text` 글자. 확인 창에서도 #333333을 쉬는 상태로 쓰지 않는다(#333333은 hover와 누름). 드롭다운 버튼(Select)도 `--bg-control`이다(#262626 드롭다운은 없앤다).
3. **주 버튼**은 `--accent-fill` 바탕, `--text-on-fill`, 굵기 600, hover와 누름 `--accent-fill-hover`. 창이나 대화상자마다 하나만, 바닥글 맨 오른쪽.
4. **투명 버튼**(아이콘 버튼, 메뉴줄 항목, 목록 줄): 아이콘 `--text-2`, hover `--bg-raised`, 누름 또는 켜짐(aria-pressed) `--bg-control-hover` + `--text`.
5. **채워진 컨트롤 hover**는 `--bg-control-hover`. **툴바 버튼 hover**는 `--bg-toolbar-hover`, 선택된 작업 공간 탭은 `--bg-raised`.
6. **포커스**: 키보드 포커스(:focus-visible)는 모든 조작 요소에 `outline: 2px solid var(--accent); outline-offset: 1px`. 입력 칸은 대신 `--ring-field-focus`. 마우스 클릭에는 고리를 보이지 않는다.
7. **쓸 수 없음(disabled)**: 글자와 아이콘을 `--text-off`로, hover 없음. 투명도를 낮추지 않는다. 쓸 수 없는 이유는 툴팁으로만.
8. **입력 칸**: `--bg-well`, `--radius-md`, md 30(13px, 좌우 10px) / sm 26(12px, 좌우 8px), 플레이스홀더 `--text-3`, 포커스 `--ring-field-focus`, 오류 `--ring-field-error`와 title 툴팁(문구를 칸 옆에 쓰지 않는다). 검색 칸은 앞에 16px 돋보기 `--text-3`, 아이콘과 글자 사이 8px.
9. **체크 상자** 16×16 `--radius-sm`: 꺼짐 `--bg-well` + `inset 0 0 0 1px var(--line-control)`, 켜짐 `--accent-fill` + 흰 12px 체크, 일부 `--accent-fill` + 8×2 흰 막대. 줄 전체를 눌러도 바뀐다.
10. **스위치**: 30×18 트랙 `--radius-full`, 꺼짐 `--line-strong`, 켜짐 `--accent-fill`, 손잡이 14px `--text`, 여백 2px.
11. **메뉴/팝오버**: `--bg-raised`, `--radius-xl`, `--shadow-popover`, 안쪽 6px, 항목 28px(글자 13px, 좌우 8px, `--radius-md`), 항목 hover `--bg-control-hover`, 앞 아이콘 칸 14px(`--text-2`), 현재 항목은 앞 칸에 체크, 오른쪽 부가 정보 11px `--text-3`, 하위 메뉴 화살표 12px `--text-3`, 구분선 1px `--line-strong` 위아래 4px 좌우 2px, 묶음 이름 11px 600 `--text-3`. 하위 메뉴의 첫 항목은 부모 항목과 같은 높이에 맞춘다(하위 메뉴 top = 부모 항목 top − 6px).
12. **툴팁**: `--bg-raised`, `--radius-md`, `--shadow-popover`, 글자 12px `--text`, 안쪽 5px 8px, 최대 너비 280px, 단축키는 8px 띄우고 `--text-3`. 나타나는 지연 600ms, 툴팁 사이를 옮길 때 300ms 안이면 지연 없음.
13. **대화상자**: `--bg-dialog`, `--radius-2xl`, `--shadow-dialog`, 머리글 44(제목 `title`, 닫기 아이콘 버튼 30×30), 몸통 안쪽 16, 바닥글 52(md 버튼, 오른쪽 정렬, 사이 8), 순서는 [취소] … [주 버튼]. 막 `--scrim`은 메뉴줄 아래부터. 너비는 `--dialog-s/m/l/xl` 중 하나. 창이 작으면 너비 = 창 너비 − 32, 높이 최대 = 창 높이 − 64이고 몸통만 스크롤.
14. **확인 창**(질문 하나): `--dialog-s`, 안쪽 20 20 16, 왼쪽 40×40 아이콘 칸(`--bg-panel`, `--radius-lg`, 24px 아이콘), 제목 `heading`, 부가 정보 `label` `--text-3`, 버튼 줄 위 20px, [취소]는 왼쪽 끝, 나머지는 오른쪽, 주 버튼 맨 오른쪽.
15. **목록 줄**: 30px, 좌우 14px, 아이콘 16px `--text-2`와 글자 사이 10px, 글자 13px, 오른쪽 부가 정보 11px `--text-3`. hover `--bg-raised`, 고른 줄 `--selection` + 글자/아이콘 `--text` + 부가 `--text-on-selection`. 묶음 머리글 11px 600 `--text-3`, 안쪽 10px 14px 5px. 두 줄 항목 44px(둘째 줄 11px). 출력 중인 줄은 오른쪽에 LIVE 배지.
16. **패널**: `--bg-panel`, `--radius-lg`, 그림자 없음, 사이 4px. 머리글 34px, 왼쪽 14px 오른쪽 8px, 아래 1px `--line`. 탭 이름 12px 600, 켜진 탭은 `--text` + 아래 2px `--text` 밑줄(줄 높이 32px), 꺼진 탭 `--text-3`, 탭 사이 18px. 머리글 오른쪽 조작은 sm 아이콘 버튼.
17. **썸네일**: 16:9 `--output-black` 캔버스 + 24px 이름표 띠(`band`, 왼쪽 8px, 번호와 이름 사이 8px), 이름표 색이 있으면 띠 전체를 그 색 + `--text-on-label`, 없으면 `--label-none` + `--label-gray`. `--radius-md`로 잘라 낸다. 출력 중 `--ring-live`, 고름(출력 중 아님) `--ring-selected`. 격자 틈 세로 16 가로 12.
18. **상태는 모양과 색으로**: 설명 문구, 상태 칩, 점으로 상태를 덧붙이지 않는다. 출력 중은 빨강 테두리나 LIVE 배지, 경고는 주황 아이콘이나 테두리. 자세한 이유는 툴팁. (사용자가 가장 싫어하는 것: AI 티 나는 설명 문구, 쓸데없는 칩과 배지.)
19. **움직임**: hover/누름 바탕 100ms ease-out, 메뉴와 툴팁 120ms 페이드, 대화상자 160ms 페이드. 출력 화면에는 UI 움직임을 넣지 않는다. `prefers-reduced-motion`이면 모두 0.

## 4. 만들 파일 (컴포넌트 하나마다)

`project/components/<Comp>/README.md`, `project/components/<Comp>/preview.html`, `css/<NN>-<comp>.css` (NN은 맡은 번호대, 아래 배정 참고). `<Comp>`는 영문 PascalCase 식별자.

### CSS
- 클래스 접두사 `ll-`. 블록 `ll-btn`, 변형 `ll-btn--primary`, 크기 `ll-btn--md`, 안쪽 부품 `ll-btn__icon`.
- 상태는 실제 속성으로: `:hover`, `:active`, `:focus-visible`, `:disabled`, `[aria-pressed="true"]`, `[aria-selected="true"]`, `[aria-checked="true|mixed"]`, `[aria-invalid="true"]`, `[data-state="live|warning|off"]`.
- 미리보기에서 상태를 고정해 보이려면 같은 규칙에 `.is-hover`, `.is-active`, `.is-focus`를 함께 건다 (예: `.ll-btn:hover, .ll-btn.is-hover { … }`). 포커스 고리는 `00-base.css`가 `.ll-preview .is-focus`에 이미 그린다.
- 버튼 초기화(border 0, font inherit)는 각 블록에서 직접 한다. 아이콘은 `00-base.css`의 `<span class="ll-i ll-i-14 ll-i-<key>"></span>` (마스크라 currentColor를 따른다). 쓸 수 있는 아이콘 키: `icon-map.json`의 첫 칸(예: song, film, image, notice, book, msg, prop, audio, monitor, mplay, capture, search, gear, plus, down, right, x, check, layers, text, undo, macro, warning, timer, clock, cal, grip, more, eye, eyeoff, lock, play, playf, pause, stop, loop, trash, copy, edit, folder, download, upload, filetext, fileppt, keyboard, laptop, history, saved, info, pray, sun, eraser, refresh, link, frame, bookmark, listplus …).
- 다른 작업자의 css 조각이나 `00-base.css`를 고치지 않는다.

### preview.html
- 1행은 표식: `<!-- @dsCard group="<묶음>" height=<대략 높이> -->`. 묶음 이름은 배정표의 것을 그대로 쓴다.
- 그다음 작은 완전한 HTML 문서. tokens.css와 bundle.css는 틀이 미리 넣어 주므로 link하지 않는다. 스크립트는 쓰지 않아도 된다(정적 HTML 권장).
- 바깥은 `<div class="ll-preview">`. 그 안에 `ll-spec`(가로로 늘어놓는 줄), `ll-spec-item`(요소 하나 + 아래 `ll-spec-label` 이름), `ll-spec-title`(묶음 제목), `ll-on-panel`(패널 바탕 위에 올려 보여야 할 때)을 쓴다.
- 모든 변형, 크기, 상태(기본, hover, 누름/켜짐, 포커스, 쓸 수 없음, 그 요소만의 상태)를 한 장에 보인다. 라벨은 짧은 한국어("기본", "마우스 올림", "누름", "포커스", "쓸 수 없음", "출력 중").
- 실제 앱의 문구를 쓴다(곡 "만복의 근원 하나님", "주 하나님 지으신 모든 세계", "내 주를 가까이 하게 함은", 이름표 "1절 프리코러스 후렴 브리지", 배경 "따뜻한 빛", 예배 "주일 예배 11월 1일", 화면 "본 화면 무대 화면 방송 자막"). 지어낸 영어 문구, lorem ipsum 금지.
- 이미지가 필요하면 업로드된 배경 그림: 따뜻한 빛 `/_blob/a52f8166b3e4175cb8ae640545551821`, 푸른 빛줄기 `/_blob/7fd58e28ed28567de79a19e6f230dadc`, 새벽 하늘 `/_blob/c73e39734966be2aeb0284b0d8bfaeea`, 별빛 `/_blob/de4bf9ac8dca0a9408c67dbd597d641d`.
- 미리보기 폭은 960px 기준(페이지가 줄여 보여 준다). 가로로 넘치지 않게.

### README.md (한국어, 합니다체, 개발자에게 지시하는 문장)
첫 줄 `# <Comp>` 다음 첫 문장은 한 줄 요약(이 요소가 무엇이고 어디에 쓰는지). 그 뒤 순서:
1. `## 쓰는 곳` / `## 쓰지 않는 곳` (짧은 목록)
2. `## 구성` 부품과 값(높이, 여백, 글자 스타일 이름, 토큰 이름). 값은 반드시 토큰 이름으로: "바탕 `bg-control`, 높이 `size-control-sm`(26px)".
3. `## 크기와 변형` 표 (이름 | 높이 | 글자 | 쓰는 곳)
4. `## 상태` 표 (상태 | 바탕 | 글자/아이콘 | 그 밖)
5. `## 동작` 키보드, 마우스, 포커스 순서, aria 속성
6. `## 글쓰기` 이 요소의 문구 규칙(동사로 끝내기, 설명 문구 금지 등) 예시 포함
7. `## 구현 메모` React 컴포넌트 이름과 props 제안(`<Button variant="primary" size="md" icon="plus">`), CSS 클래스
8. `## 시안과 달라진 점` (해당될 때만) 확정 규칙 때문에 바뀌는 보드와 값

과장하지 않는다. 출처를 지어내지 않는다(ProPresenter를 따른 요소면 그렇게 적되, 확실하지 않으면 적지 않는다). 말투는 담담하게.

## 5. 확인 방법

1. `node build-css.js` (css 조각을 project/components/bundle.css로 합친다)
2. 로컬 서버는 이미 5299번 포트에서 돌고 있다(`node card-server.js`). 꺼져 있으면 켠다.
3. `MSYS_NO_PATHCONV=1 D:/programming/2020-/pp/node_modules/electron/dist/electron.exe shoot-card.js <Comp> 960` → `shots/<Comp>.png`, `shots/<Comp>.log`(콘솔 오류, 404). 반드시 이 폴더(`ds/`)에서 실행한다. 긴 경로 때문에 다른 곳에서 node를 돌리면 실패할 수 있다.
4. PNG를 Read로 보고 정렬, 잘림, 겹침, 대비, 규칙 위반을 고친다. 고친 뒤 한 번 더 찍어 확인한다. 그 이상 반복하지 않는다.

## 6. 보고

끝나면 짧게 보고한다: 만든 파일 목록, 규칙에 없어서 스스로 정한 것, 토큰 요청, 시안과 달라지는 점 목록(보드 이름과 값). 한국어로.
