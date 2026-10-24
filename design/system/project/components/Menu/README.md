# Menu

떠 있는 메뉴입니다. 메뉴줄 메뉴, 하위 메뉴, 우클릭 메뉴, 버튼이 여는 팝오버 목록(예배 고르기, 이름표)이 같은 면과 28px 항목을 씁니다.

## 쓰는 곳

- 메뉴줄의 파일, 편집, 보기, 출력, 창, 도움말 메뉴와 하위 메뉴(파일 › 가져오기 › 텍스트 파일)
- 우클릭 메뉴(매크로 타일, 예배 순서 항목)
- 버튼이 여는 목록: 예배 고르기(맨 위 검색), 이름표 고르기(색 견본), `Select`가 여는 목록

## 쓰지 않는 곳

- 입력이 여러 개인 설정: `Dialog`를 씁니다.
- 이름이나 이유만 보일 때: `Tooltip`을 씁니다.
- 늘 보이는 목록: `ListRow`를 씁니다.
- 메뉴 안의 색 고르기 줄(이름표 색, 매크로 색)은 `LabelColorPicker`의 `ll-swatches--menu`입니다. 메뉴는 그 줄을 담는 면과 구분선만 줍니다.

## 구성

- 면 `ll-menu`: 바탕 `bg-raised`, 모서리 `radius-xl`(6px), 그림자 `shadow-popover`(1px `line-strong` 테두리 포함), 안쪽 `space-6`. 너비는 내용에 맞추되 최소 180, 최대 320(예배 고르기 300, 매크로 우클릭 240). 쌓임 `z-popover`.
- 항목 `ll-menu__item`: 높이 `size-row-menu`(28px), 좌우 `space-8`, 모서리 `radius-md`, 글자 `body`(13/18) `text`. 부품 사이 `space-10`.
  - 앞 칸 `ll-menu__lead`: 14×14. 아이콘 14px `text-2`, 또는 현재 항목의 체크(`check` 14px `text`). 한 메뉴에서 앞 칸을 쓰는 항목이 하나라도 있으면 모든 항목에 빈 앞 칸을 둡니다. 그러면 이름이 모두 항목 왼쪽에서 32px(8 + 14 + 10) 선에서 시작합니다. 앞 칸이 필요 없는 메뉴(파일 메뉴)는 아예 두지 않습니다.
  - 이름 `ll-menu__label`: 남는 너비, 말줄임.
  - 오른쪽 부가 정보 `ll-menu__meta`: `caption`(11/14) `text-3`, 숫자 고정폭, 이름과 16px 이상 띄웁니다. 날짜("10월 25일"), 단축키("Ctrl Z", `KeyCap`의 글자 단축키).
  - 하위 메뉴 화살표 `ll-menu__chevron`: `right` 12px `text-3`, 오른쪽 끝.
  - 이름표 견본 `ll-menu__swatch`: 18×12, 모서리 `radius-xs`, `data-color`로 이름표 색. 이름표 없음은 `label-none` + 1px `line-control`. 앞 칸 다음, 이름 앞에 둡니다(현재 이름표의 체크는 앞 칸).
- 구분선 `ll-menu__sep`: 1px `line-strong`, 위아래 `space-4` 좌우 `space-2`.
- 묶음 이름 `ll-menu__group`: `caption-strong`(11/14/600) `text-3`, 안쪽 위 6 좌우 8 아래 4(메뉴 맨 위면 위 2).
- 검색 칸 `ll-menu__search`: 메뉴 맨 위, 높이 `size-control-md`(30px), 바탕 `bg-well`, `radius-md`, 안쪽 좌우 `space-8`, 돋보기 16px `text-3`, 글자와 사이 `space-8`, 아래 `space-4`. 플레이스홀더 "검색". 글자가 항목 이름과 같은 선에서 시작합니다. 포커스 `ring-field-focus`.
- 삭제 항목 `ll-menu__item--danger`: 글자색을 따로 칠하지 않고 `text`로 둡니다. 빨강은 출력에만 쓰기 때문입니다. 메뉴 맨 아래, 구분선 뒤에 두고, 되돌릴 수 없는 삭제는 확인 창(AlertDialog)으로 한 번 더 묻습니다.
- 자리
  - 메뉴줄 메뉴: 메뉴줄 바로 아래(위 30px), 왼쪽 가장자리를 메뉴 이름 버튼에 맞춥니다.
  - 버튼이 여는 메뉴와 팝오버 목록: 버튼 아래 4px, 왼쪽 가장자리를 버튼에 맞춥니다. 아래가 모자라면 버튼 위 4px에 엽니다.
  - 우클릭 메뉴: 포인터 끝에 메뉴의 왼쪽 위 모서리를 둡니다. 창 오른쪽이나 아래에 닿으면 왼쪽이나 위로 뒤집습니다.
  - 하위 메뉴: 첫 항목이 부모 항목과 같은 높이에 오도록 하위 메뉴 top = 부모 항목 top − 6. 가로는 부모 메뉴 오른쪽 가장자리에 4px 겹쳐 붙습니다(left = 부모 오른쪽 − 4). 오른쪽이 모자라면 부모 왼쪽에 4px 겹쳐 엽니다.
  - 창보다 긴 메뉴는 창 위아래에 8px을 남기고 항목 부분(`ll-menu__scroll`)만 스크롤합니다.

## 크기와 변형

| 이름 | 높이 | 글자 | 쓰는 곳 |
| --- | --- | --- | --- |
| 메뉴줄 메뉴 | 항목 28 | body 13/18 | 파일, 편집, 보기, 출력, 창, 도움말 |
| 하위 메뉴 | 항목 28 | body, 앞 아이콘 14 | 가져오기 › 텍스트 파일, 클립보드 텍스트, PowerPoint 파일 |
| 우클릭 메뉴 | 항목 28 | body | 매크로(실행, 이름 바꾸기, 동작 추가 ›, 삭제) |
| 팝오버 목록 | 검색 30 + 항목 28 | body + caption 날짜 | 예배 고르기 |
| 이름표 메뉴 | 항목 28 | body + 견본 18×12 | 라이브러리 곡 편집의 이름표 고르기 |

## 상태

| 상태 | 바탕 | 글자/아이콘 | 그 밖 |
| --- | --- | --- | --- |
| 기본 | 투명 | 이름 `text`, 앞 칸 `text-2`, 부가와 화살표 `text-3` | |
| 가리킴(마우스, 화살표 키) | `bg-control-hover` | 부가와 화살표 `text-2` | 메뉴 안에서는 고리를 그리지 않습니다. 100ms |
| 하위 메뉴 열림 | `bg-control-hover` | 부가와 화살표 `text-2` | 부모 항목에 `aria-expanded="true"` |
| 현재 항목 | 투명 | 앞 칸에 `check` 14px `text` | `aria-checked="true"` |
| 삭제 | 투명, 가리키면 `bg-control-hover` | `text` | 맨 아래, 구분선 뒤 |
| 쓸 수 없음 | 투명 | 이름, 앞 칸, 부가, 화살표 `text-off` | hover 없음, 이유는 툴팁 |
| 검색 칸 포커스 | `bg-well` | 글자 `text`, 돋보기 `text-3` | `ring-field-focus` |

## 동작

- 여는 법: 메뉴줄 이름이나 버튼을 누름, Enter, Space, 아래 화살표. 우클릭 메뉴는 우클릭, Shift+F10, 메뉴 키. 열면 첫 항목을 가리키고, 검색 칸이 있으면 검색 칸에 포커스를 둡니다.
- 키보드: 위아래 화살표로 항목을 옮깁니다(쓸 수 없는 항목도 가리키되 실행하지 않음). Home, End는 처음과 끝. 오른쪽 화살표는 하위 메뉴를 열고 첫 항목을 가리킵니다. 왼쪽 화살표는 하위 메뉴를 닫습니다. Enter, Space는 실행. Esc는 한 단계 닫기, Tab은 모두 닫기. 글자를 치면 그 글자로 시작하는 항목으로 갑니다. 검색 칸에서는 친 글자가 검색어가 되고 아래 화살표로 목록에 들어갑니다.
- 마우스: 부모 항목에 포인터가 150ms 머물면 하위 메뉴를 엽니다. 하위 메뉴 쪽으로 비스듬히 옮기는 동안(300ms 안)은 다른 항목을 지나도 닫지 않습니다. 메뉴줄 메뉴가 열린 채 다른 메뉴 이름으로 옮기면 그 메뉴로 바뀝니다.
- 메뉴 밖을 누르면 닫히고, 그 누름은 아래로 전하지 않습니다. 항목을 실행하면 모든 메뉴가 닫히고 포커스는 연 곳으로 돌아갑니다.
- 나타날 때 120ms 페이드, 닫힐 때는 바로 사라집니다. `prefers-reduced-motion`이면 페이드 없음.
- aria: 면 `role="menu"` + `aria-label`, 항목 `role="menuitem"`, 하나를 고르는 항목 `menuitemradio`, 켜고 끄는 항목 `menuitemcheckbox`, 둘 다 `aria-checked`. 하위 메뉴 부모 `aria-haspopup="menu"` + `aria-expanded`. 구분선 `role="separator"`, 묶음 `role="group"` + `aria-labelledby`. 쓸 수 없음 `aria-disabled="true"`.

## 글쓰기

- 항목은 하는 일을 동사로 끝내거나("이름 바꾸기", "지금 예배를 틀로 저장", "다른 예배에서 가져오기") 열 것의 이름("텍스트 파일", "환경설정")을 씁니다.
- 대화상자를 여는 항목에도 "…"를 붙이지 않습니다.
- 단축키는 글자로 띄어 씁니다: "Ctrl Z", "Ctrl 1", "F2".
- 위험한 항목은 짧게 "삭제". 되돌릴 수 없으면 실행 전에 `AlertDialog`로 묻습니다.
- 설명 문구나 새 기능 표시를 메뉴에 넣지 않습니다.

## 구현 메모

- `<Menu label="파일" items={[{ label: '새 예배' }, { type: 'separator' }, { label: '가져오기', submenu: [...] }]} />`
- `<MenuItem icon="filetext" label="텍스트 파일" meta="Ctrl Z" checked danger disabled submenu />`, `<MenuSearch placeholder="검색" />`, `<MenuSeparator />`, `<MenuGroup label="최근 예배" />`
- `<ContextMenu at={{ x, y }}>`, `<Popover anchor={ref} placement="bottom-start" offset={4}>`
- 자리 계산은 한 곳에서 합니다(flip, 창 가장자리 8px 안 shift). 하위 메뉴는 부모 항목 기준 오른쪽 시작, 가로 −4, 세로 −6.
- 앞 칸은 메뉴 단위로 정합니다: 한 항목이라도 아이콘이나 체크가 있으면 모든 항목이 빈 `ll-menu__lead`를 가집니다.
- 클래스: `ll-menu`, `ll-menu__scroll`, `ll-menu__item`, `ll-menu__item--danger`, `ll-menu__lead`, `ll-menu__label`, `ll-menu__meta`, `ll-menu__chevron`, `ll-menu__swatch`, `ll-menu__sep`, `ll-menu__group`, `ll-menu__search`.

## 시안과 달라진 점

- ServiceSwitch 예배 고르기 목록: 항목 30 → 28.
- ImportMenu 가져오기 하위 메뉴: 앞 아이콘 16 → 14.
- Reflow 이름표 메뉴: 항목 30 → 28, 현재 이름표의 체크 오른쪽 끝 → 앞 칸, 견본은 앞 칸 다음. 구분선 위아래 6 → 4. "새 이름표" 글자 `text-2` → `text`(아이콘은 `text-2`).
- Macros, ClearGroups 삭제: 글자 #e07a7a → `text`(빨강은 출력에만 씁니다).
- Macros 우클릭 메뉴: 너비 210 → 240(`LabelColorPicker` 색 줄에 맞춤).
