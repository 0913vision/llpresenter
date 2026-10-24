# KeyCap

단축키를 글쇠 모양으로 보여 주는 작은 상자입니다. 환경설정의 단축키 표에 쓰고, 툴팁과 메뉴 안에서는 상자 없이 글자로 씁니다.

## 쓰는 곳

- 환경설정 > 단축키 표의 단축키 칸(다음 장 → Space, 되돌리기 Ctrl Z, 지우기 F1~F7)
- 단축키가 겹칠 때의 표시(평상시와 출력 켜기가 둘 다 Ctrl 1)
- 글자 단축키: 툴팁("되돌리기 Ctrl Z"), 메뉴 항목 오른쪽

## 쓰지 않는 곳

- 툴팁과 메뉴 안: 글쇠 상자를 그리지 않고 글자로만 씁니다(`Tooltip`의 `ll-tooltip__key`, `Menu`의 `ll-menu__meta`).
- 진행 화면 지우기 단추의 F1~F7: 단추 안에 글쇠를 넣지 않고 툴팁으로만 보입니다(`ClearButton`).
- 버튼 이름 안: "Ctrl Z로 되돌리기"처럼 단추 이름에 단축키를 섞지 않습니다. 툴팁으로 보입니다.

## 구성

- 글쇠 `ll-key`(`kbd`): 높이 18px, 최소 너비 22px, 좌우 `space-6`, 모서리 `radius-sm`, 바탕 `bg-control`, 글자 `caption-strong`(11px, 600)에 줄 높이 18px, `text`, 가운데 정렬, 고정폭 숫자.
- 조합 `ll-keys`: 한 단축키를 이루는 글쇠들(Ctrl, Z). 글쇠 사이 `space-4`. 더하기(+)는 쓰지 않습니다.
- 단축키 묶음 `ll-key-list`: 한 명령에 단축키가 둘 이상일 때(→, Space). 조합 사이 `space-10`.
- 겹침 아이콘 `ll-key-warn`: `warning` 14px `warning`, 조합 뒤 10px. 이유는 title 툴팁("출력 켜기와 겹침").
- 없음 `ll-key-empty`: 단축키가 없을 때 "없음", `label`(12/16) `text-3`.
- 키 입력 중: `TextField` sm(너비 160, 플레이스홀더 "키 입력", 포커스 고리)을 글쇠 자리에 둡니다. 그 줄은 `selection` 바탕.
- 글자 단축키 `ll-key-text`: 상자 없이 `text-3`, 고정폭 숫자, 줄바꿈 없음. 크기는 놓인 글을 따릅니다(툴팁 12px, 메뉴 11px). 툴팁에서는 이름과 8px 띄웁니다. 글쇠 사이는 한 칸 띄웁니다(시안의 "되돌리기 Ctrl Z"와 같이): Ctrl Z, Alt 2, F1, Space, →. "+"는 쓰지 않습니다.

## 크기와 변형

| 이름 | 높이 | 글자 | 쓰는 곳 |
| --- | --- | --- | --- |
| 글쇠 | 18 | caption-strong 11/600 | 단축키 표 |
| 조합 | 18 | 같음 | 글쇠 사이 4 |
| 글자 단축키 | 글 높이 | 툴팁 label 12/16, 메뉴 caption 11/14, text-3 | 툴팁, 메뉴 |

## 상태

| 상태 | 바탕 | 글자/아이콘 | 그 밖 |
| --- | --- | --- | --- |
| 기본 | bg-control | text | |
| 바꾼 단축키 | selection | text | `ll-keys[data-state="changed"]`. 기본값과 다른 단축키. 점이나 글을 덧붙이지 않습니다 |
| 겹침 | bg-control | text, 뒤에 warning 아이콘 | `ll-keys[data-state="warning"]`: 조합 둘레 1px `warning`, 2px 띄움. 이유는 아이콘의 툴팁. 바꾼 것이면서 겹치면 겹침만 보입니다 |
| 없음 | - | "없음" text-3 | |
| 키 입력 중 | 줄 selection | TextField sm 포커스 | 다음에 누른 조합을 받습니다 |

## 동작

- 글쇠는 눌리지 않는 표시입니다. 단축키를 바꾸려면 그 줄을 두 번 누르거나 Enter를 눌러 키 입력 칸을 엽니다.
- 키 입력 칸에서 Esc는 취소, Backspace는 단축키 없애기, 다른 조합은 그 단축키로 정합니다. 이미 쓰는 조합이면 두 줄 모두 겹침으로 보입니다.
- 겹침 아이콘에 마우스를 올리면 툴팁으로 무엇과 겹치는지 알립니다.
- aria: 글쇠는 `kbd`로 씁니다. 겹침 아이콘에는 `aria-label`로 툴팁과 같은 글을 줍니다. 바꾼 단축키는 줄에 `aria-description="바꾼 단축키"`를 줍니다.

## 글쓰기

- 글쇠 이름은 Windows 표기 그대로: Ctrl, Alt, Shift, Space, Enter, Esc, F1, 화살표는 → ← ↑ ↓. 한국어로 옮기지 않습니다.
- 겹침 툴팁은 "<명령>과 겹침" 한 줄: "출력 켜기와 겹침", "평상시와 겹침".

## 구현 메모

- `<KeyCombo keys={['Ctrl', 'Z']} state="changed | warning" conflictWith="출력 켜기" />`, `<KeyList combos={[['→'], ['Space']]} />`
- 글자 단축키는 `formatShortcut(['Ctrl', 'Z']) === 'Ctrl Z'` 한 함수로 만들어 툴팁, 메뉴, 단축키 표가 같은 이름을 쓰게 합니다.
- 마크업: `span.ll-key-list > span.ll-keys[data-state] > kbd.ll-key` + `[span.ll-key-warn[title] > span.ll-i.ll-i-warning]`
- 클래스: `ll-key`, `ll-keys`, `ll-key-list`, `ll-key-warn`, `ll-key-empty`, `ll-key-text`.

## 시안과 달라진 점

- Prefs, Shortcuts 글쇠: 바탕 #2f2f2f → `bg-control`, 좌우 5 → 6, 조합 안 글쇠 사이 3 → 4.
- Shortcuts 바꾼 단축키: 명령 이름 뒤 6px 파란 점 → 점을 없애고 글쇠 바탕을 `selection`으로.
- Shortcuts 겹침 아이콘: 조합과 사이 14 → 10.
- Shortcuts 없음: #6e6e6e → `text-3`. 키 입력 칸: 높이 24 → 26.
