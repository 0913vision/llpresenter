# TextField

글자를 직접 넣는 입력 칸입니다. 검색, 성경 구절 퀵 실행, 이름과 제목, 숫자, 메모에 씁니다.

## 쓰는 곳

- 툴바 검색 칸(곡, 가사, 초성), 라이브러리 검색, 매크로 동작 찾기, 단축키의 명령 찾기
- 퀵 실행의 성경 구절 칸(요 3:16, 창 1:1-5), 성경 구절 화면의 구절 칸
- 새 예배의 이름, 텍스트 가져오기의 제목, 가져온 곡 편집의 제목(패널 머리글 안)
- 환경설정과 속성 칸의 숫자 칸(복구 사본, 가장자리 여백, 크기, 줄 간격), 미디어 구간 칸
- 항목 설정의 메모(여러 줄)
- 단축키를 새로 받는 칸(키 입력)

## 쓰지 않는 곳

- 정해진 값 중 하나를 고르는 곳: `Select`나 `SegmentedControl`을 씁니다.
- 메뉴 맨 위의 검색 칸: `Menu`의 `ll-menu__search`가 그립니다.
- 라이브러리 곡 편집(Reflow)의 가사 블록: 바탕과 테두리 없이 글을 바로 고치는 편집 면이라 입력 칸이 아닙니다. 그 화면의 편집기에서 따로 정합니다.
- 읽기만 하는 값(주사율, 현재 버전, 마지막 백업): `PropertyRow`의 값 글자(`ll-prop__value`)로 씁니다. 입력 칸처럼 그리지 않습니다. 예외로 환경설정의 폴더 경로는 길어서 복사할 일이 있으므로 `readonly` 입력 칸(앞 아이콘 `folder`)에 두고 옆에 [바꾸기] 버튼을 둡니다.

## 구성

- 바깥 칸 `ll-field`: 바탕 `bg-well`, 모서리 `radius-md`(4px), 글자색 `text`, 플레이스홀더 `text-3`.
- md: 높이 `size-control-md`(30px), 좌우 `space-10`, 글자 `body`(13/18).
- sm: 높이 `size-control-sm`(26px), 좌우 `space-8`, 글자 `label`(12/16).
- 앞 아이콘 `ll-field__icon`: md 16px, sm 14px, 색 `text-3`. 아이콘과 글자 사이 md `space-8`, sm `space-6`. 검색 칸은 돋보기(`search`), 성경 구절 칸은 책(`book`)을 씁니다.
- 지우기 단추 `ll-field__clear`: 값이 있을 때만 보입니다. md 22×22(`size-control-xs`, 아이콘 14), sm 18×18(아이콘 12), 오른쪽 끝에서 4px 안쪽, 모서리 `radius-sm`, 아이콘 `text-3`, 마우스 올림 `bg-raised` + `text`.
- 숫자 칸 `ll-field--num`: 너비 96px, 값 오른쪽 정렬, 고정폭 숫자. 단위(개, 줄)는 칸 밖에 `ll-field-unit`(`label`, `text-3`)으로 8px 띄워 둡니다. %처럼 값의 일부인 단위는 값에 붙여 씁니다.
- 칸 안 앞 이름 `ll-field__affix`: `caption`(11/14), `text-3`. 미디어 구간 칸의 "시작", "끝"처럼 칸 둘이 나란할 때만 씁니다.
- 제목 칸 `ll-field--title`: 패널 머리글(34px) 안에 들어가는 곡 제목. 너비 280px, 높이 `size-control-sm`(26px), 좌우 `space-8`, 글자 `title`(13/18/600).
- 툴바 검색 칸 `ll-field--ring`: `bg-app` 위에서는 `bg-well`이 거의 보이지 않으므로 `ring-field`를 더합니다. 너비 420px(좁은 창 280px), 높이는 md 그대로입니다.
- 여러 줄 `ll-textarea`: 바탕 `bg-well`, `radius-md`, 안쪽 `space-8` `space-10`, 글자 `body`(13/18), 최소 높이 72px. 크기 조절 손잡이는 두지 않고 내용에 맞춰 늘어나며, 8줄을 넘으면 칸 안에서 스크롤합니다.

## 크기와 변형

| 이름 | 높이 | 글자 | 쓰는 곳 |
| --- | --- | --- | --- |
| md | 30 | body 13/18 | 대화상자, 환경설정, 속성 칸, 툴바 검색, 패널 안 검색과 퀵 실행(보통 창) |
| sm | 26 | label 12/16 | 패널 머리글 안, 좁은 창(1366)의 퀵 실행, 매크로 동작 팔레트, 키 입력 칸 |
| 검색 | md 또는 sm | 같음 | 앞에 돋보기, 값이 있으면 지우기 단추 |
| 숫자 | md | body, 오른쪽 정렬 | 너비 96, 단위는 칸 밖 |
| 제목 | 26 | title 13/18/600 | 가져온 곡 편집의 패널 머리글 |
| 여러 줄 | 72 이상 | body 13/18 | 항목 설정의 메모 |

## 상태

| 상태 | 바탕 | 글자/아이콘 | 그 밖 |
| --- | --- | --- | --- |
| 기본 | bg-well | 값 text, 플레이스홀더와 아이콘 text-3 | bg-app 위에서만 ring-field |
| 마우스 올림 | 바뀌지 않음 | 바뀌지 않음 | 커서만 글자 커서 |
| 포커스 | bg-well | 같음 | ring-field-focus(안쪽 1px accent). 바깥 고리는 그리지 않습니다 |
| 오류 | bg-well | 같음 | ring-field-error(안쪽 1px live). 이유는 title 툴팁. 포커스가 있어도 오류 고리가 남습니다 |
| 쓸 수 없음 | bg-well | 값, 플레이스홀더, 아이콘 모두 text-off | 투명도를 낮추지 않습니다. 이유는 툴팁 |

## 동작

- 칸 어디를 눌러도(아이콘 포함) 입력에 포커스가 갑니다.
- 검색 칸: 글자를 칠 때마다 결과를 거릅니다. Esc는 값이 있으면 지우고, 비어 있으면 포커스를 놓습니다. 지우기 단추는 값을 지우고 포커스를 칸에 남깁니다.
- 퀵 실행 칸: Enter로 그 구절을 띄웁니다. 알아볼 수 없는 구절이면 오류 고리를 보이고 이유를 툴팁으로 알립니다.
- 숫자 칸: 위아래 화살표로 1씩, Shift와 함께 10씩 바꿉니다. 범위를 벗어난 값은 포커스를 놓을 때 가장 가까운 값으로 맞춥니다.
- 제목 칸: 같은 제목의 곡이 라이브러리에 있으면 `aria-invalid="true"`와 오류 고리를 보이고, 저장할 때 `ImportSave` 확인 창으로 넘어갑니다.
- 키 입력 칸: 포커스를 받으면 다음에 누른 조합을 받아 적고, Esc는 취소, Backspace는 단축키를 없앱니다.
- 탭 순서는 화면에 놓인 순서를 따릅니다. 지우기 단추는 탭 순서에서 빼고(`tabindex="-1"`) Esc로 같은 일을 합니다.
- aria: 보이는 이름이 없는 칸(검색, 퀵 실행)은 `aria-label`을 줍니다. 오류는 `aria-invalid="true"`, 이유는 `aria-describedby`로 툴팁 글을 잇습니다.

## 글쓰기

- 플레이스홀더는 넣을 수 있는 것의 예나 종류만 씁니다: "곡, 가사, 초성", "요 3:16, 창 1:1-5", "제목, 가사, 초성", "키 입력". "여기에 입력하세요" 같은 안내 문장은 쓰지 않습니다.
- 오류 이유는 칸 옆에 쓰지 않고 툴팁으로만 보입니다. 한 문장, 사실만: "라이브러리에 같은 제목의 곡이 있습니다".
- 단위는 한 글자로 짧게: "개", "줄". 값 뒤 단위 설명("개수")은 붙이지 않습니다.

## 구현 메모

- `<TextField size="md" icon="search" placeholder="곡, 가사, 초성" clearable />`
- `<TextField variant="number" value={10} unit="개" />`, `<TextField variant="title" invalid={dup} invalidReason="라이브러리에 같은 제목의 곡이 있습니다" />`
- `<TextField multiline minRows={3} maxRows={8} />`는 `textarea.ll-textarea`를 그립니다.
- 마크업: `span.ll-field[.ll-field--sm|--num|--title|--ring|--block] > [span.ll-i.ll-field__icon] + input.ll-field__input + [button.ll-field__clear]`. 오류는 input의 `aria-invalid="true"`, 쓸 수 없음은 input의 `disabled`로 겁니다(바깥 칸은 `:has()`로 따라갑니다).
- 클래스: `ll-field`, `ll-field--sm`, `ll-field--num`, `ll-field--title`, `ll-field--ring`, `ll-field--block`, `ll-field__input`, `ll-field__icon`, `ll-field__clear`, `ll-field__affix`, `ll-field-unit`, `ll-textarea`.

## 시안과 달라진 점

- 툴바 검색 칸(ShowH, Reflow, PrepService, Screens 등 모든 보드): 높이 32 → 30, 바탕 #1c1c1c → `bg-well` + `ring-field`, 모서리 5 → 4, 좌우 12 → 10, 돋보기 14 → 16. Compact: 바탕과 모서리는 같게 바꾸고 글자 12 → 13.
- 퀵 실행과 라이브러리 검색(ShowH, Bible, Problems, PrepService, Reflow, NewService, AddSongs, ServiceImport, ImportEdit, ImportSave): 좌우 6 → 10, 아이콘과 글자 사이 10 → 8.
- AddSongsQuick 검색, Prefs/Shortcuts 명령 찾기: 아이콘 14 → 16, 아이콘과 글자 사이 10 → 8.
- Compact 퀵 실행 28 → sm 26(좌우 6 → 8, 사이 8 → 6). Macros 동작 찾기 28 → sm 26(좌우 6 → 8, 사이 10 → 6).
- Prefs, Screens, ScreensNDI, Looks, StageEditor, Media, ImportText의 입력 칸과 숫자 칸: 높이 28 → 30. Prefs 경로 칸의 폴더 아이콘 14 → 16.
- Shortcuts 키 입력 칸: 높이 24 → 26.
- PrepService 메모: 줄 높이 20 → 18(`body`).
