# ListRow

목록 한 줄입니다. 16px 종류 아이콘, 13px 이름, 오른쪽 11px 부가 정보로 된 30px 줄을 기본으로, 묶음 머리글, 두 줄 항목(44px), 빈 자리, 끌어 넣을 자리, 퀵 실행의 켜진 줄까지 함께 정합니다.

## 쓰는 곳

- 예배 순서, 라이브러리, 퀵 실행, 미디어의 보관함과 재생목록, 오디오 목록
- 대화상자 왼쪽 고르기 목록(새 예배, 다른 예배에서 가져오기): 두 줄 항목
- 틀에서 아직 채우지 않은 칸(새 예배의 예배 순서): 빈 자리
- 라이브러리에서 예배 순서로 끌어 넣기: 넣을 자리 선, 끌고 있는 줄

## 쓰지 않는 곳

- 체크 상자가 붙은 줄: `Checkbox`의 체크 줄(`ll-check-row--list`)을 씁니다. 높이, 여백, hover는 이 문서와 같습니다. 빈 자리 상자(`ll-row__slot`)는 체크 줄 안에도 넣습니다.
- 메뉴 항목(28px): `Menu`를 씁니다.
- 속성 이름과 값이 나란한 줄: `PropertyRow`를 씁니다.
- 지금 고른 줄을 체크 표시로 나타내지 않습니다. `selection` 바탕으로 나타냅니다.

## 구성

- 줄 `ll-row`: 높이 `size-row`(30px), 좌우 `panel-inset`(14px), 너비 100%, 패널 가장자리까지 닿고 모서리는 없습니다.
  - 아이콘 `ll-row__icon`: 16px `text-2`, 이름과 사이 `space-10`.
  - 이름 `ll-row__title`: `body`(13/18) `text`, 한 줄 말줄임.
  - 부가 정보 `ll-row__meta`: 오른쪽 끝, `caption`(11/14) `text-3`, 숫자 고정폭. 장 수("9장"), 길이("5:00"), 개수("42"), 구성 이름("주일용").
  - 경고 아이콘 `ll-row__warn`: `warning` 14px, 색 `warning`. 이름 뒤, LIVE 배지 앞. 이유는 툴팁("미디어 파일 없음").
  - LIVE 배지: `StatusMarks`의 `ll-badge ll-badge--live`를 오른쪽 끝에 둡니다. 배지가 있으면 부가 정보는 뺍니다.
- 묶음 머리글 `ll-row-group`: `caption-strong`(11/14/600) `text-3`, 안쪽 위 `space-10` 좌우 14 아래 5. 누를 수 없습니다.
- 패널 안 목록은 `Panel`의 `ll-panel__body--list`(위 4 아래 8) 안에 둡니다.
- 두 줄 항목 `ll-row--double`: 높이 `size-row-double`(44px), 좌우 `space-10`, 모서리 `radius-lg`. 이름 `body` 아래 둘째 줄 `ll-row__sub`(`caption` `text-3`, 이름과 사이 `space-2`, 값 사이 `space-8`).
  - 안쪽 8px의 고르기 목록 `ll-rowlist--inset` 안에 둡니다. 같은 목록의 한 줄 항목(빈 예배)도 좌우 10, `radius-lg`가 되고, 묶음 머리글은 좌우 10입니다. 그래서 대화상자 왼쪽 목록의 글자는 모두 왼쪽 18px 선에서 시작합니다.
- 빈 자리 `ll-row__slot`: 줄 안에서 남는 너비를 차지하는 24px 상자. 1px 점선 `line-control`, 모서리 `radius-md`, 안쪽 좌우 `space-6`, 아이콘과 이름 `text-3`, 오른쪽 끝 `ll-row__slot-mark` "빈 자리"(`caption`).
- 끌어 넣을 자리 `ll-row-insert`: 두 줄 사이에 넣는 높이 0 요소. 2px `accent` 선(좌우 12px, 끝 1px 둥글게) + 왼쪽 8px 고리 점(2px `accent` 테두리, 속은 바탕색). 점 속은 `--ll-insert-bg`로 바꾸며 기본은 `bg-panel`, `Dialog`의 목록 상자 안에서는 `bg-inset`입니다.
- 끌고 있는 줄 `ll-row--ghost`: 너비 220px, 바탕 `bg-control`, 1px `accent` 고리 + `shadow-popover`, 모서리 `radius-md`, 안쪽 왼쪽 10 오른쪽 8. 넣을 수 있는 곳 위에서는 끝에 16px `accent-fill` 원과 흰 12px `plus`(`ll-row__add`)를 붙입니다. 포인터를 따라다니고 포인터 이벤트를 받지 않습니다.

## 크기와 변형

| 이름 | 높이 | 글자 | 쓰는 곳 |
| --- | --- | --- | --- |
| 한 줄 | 30 | body 13/18 + caption 11/14 | 예배 순서, 라이브러리, 퀵 실행, 미디어 목록 |
| 묶음 머리글 | 29 (10 + 14 + 5) | caption-strong 11/14/600 text-3 | 예배 전, 찬양, 보관함, 재생목록, 틀, 지난 예배 |
| 두 줄 | 44 | body + caption text-3 | 새 예배와 다른 예배에서 가져오기의 틀, 지난 예배 |
| 빈 자리 | 30 (상자 24) | body text-3 + caption | 새 예배의 틀 항목 |
| 끌어 넣을 자리 | 0 (선 2, 점 8) | - | 예배 순서에 끌어 넣기 |
| 끌고 있는 줄 | 30 | body | 라이브러리에서 끌 때 |

## 상태

| 상태 | 바탕 | 글자/아이콘 | 그 밖 |
| --- | --- | --- | --- |
| 기본 | 투명 | 이름 `text`, 아이콘 `text-2`, 부가 `text-3` | |
| 마우스 올림 | `bg-raised` | 그대로 | 100ms ease-out |
| 누름 | `bg-control-hover` | 부가 `text-2` | |
| 포커스 | 그대로 | 그대로 | outline 2px `accent`, offset −2px(줄 안쪽) |
| 고름 | `selection` | 이름과 아이콘 `text`, 부가와 둘째 줄 `text-on-selection` | `aria-selected="true"`, 마우스를 올려도 그대로 |
| 출력 중 | 고름이면 `selection`, 아니면 투명 | 그대로 | 오른쪽 LIVE 배지, `data-state="live"` |
| 지난 항목 | 투명 | 이름 `text-3`, 아이콘 `text-off` | 진행 화면에서 이미 지나간 예배 순서 항목, `data-state="done"` |
| 파일 없음 | 그대로 | 그대로 | 이름 뒤 14px `warning` 아이콘 + 툴팁 |
| 퀵 실행 켜짐 | `bg-control-hover` | 이름과 아이콘 `text` | 왼쪽 안쪽 3px `live` 막대, `aria-pressed="true"` |
| 쓸 수 없음 | 투명 | 이름, 아이콘, 부가 모두 `text-off` | hover 없음, 이유는 툴팁 |

## 동작

- 목록은 `role="listbox"`, 줄은 `role="option"`과 `aria-selected`. 탭은 목록에 한 번 들어가고 위아래 화살표로 줄을 옮기며 Home, End로 처음과 끝에 갑니다. 묶음 머리글은 건너뜁니다(묶음은 `role="group"` + `aria-labelledby`).
- 줄을 누르면 고르기만 합니다. 예배 순서 줄은 그 항목의 장을 슬라이드 패널에 엽니다. 출력은 장을 눌러서 합니다.
- 퀵 실행 줄은 누르면 바로 실행합니다. 로고 화면처럼 켜고 끄는 항목은 `aria-pressed`로 켜짐을 알리고 다시 누르면 끕니다. 켜진 동안 왼쪽 `live` 막대가 남습니다.
- 끌기: 줄을 4px 넘게 움직이면 끌기가 시작되고, 넣을 자리 선은 포인터에 가장 가까운 줄 경계에 붙습니다. 묶음 머리글 바로 아래도 자리가 됩니다. Esc로 그만둡니다.
- 빈 자리에 곡을 끌어 놓으면 그 자리를 채우고 보통 줄로 바뀝니다.
- 이름이 말줄임되면 툴팁으로 전체 이름을 보입니다.

## 글쓰기

- 이름은 항목 이름 그대로 씁니다: "만복의 근원 하나님", "요한복음 3장 16절". 앞에 종류를 쓰지 않습니다(종류는 아이콘이 알립니다).
- 부가 정보는 숫자와 단위만: "9장", "5:00", "42". 두 줄 항목의 둘째 줄은 날짜, 개수 순서: "10월 25일 일요일  항목 12개".
- 상태를 글자로 붙이지 않습니다("출력 중", "완료", "재생됨" 금지). LIVE 배지, 색, 막대로만 나타냅니다.
- 빈 자리는 들어갈 종류 이름과 "빈 자리": "찬양 … 빈 자리".

## 구현 메모

- `<ListRow icon="song" title="만복의 근원 하나님" meta="9장" selected live warning="미디어 파일 없음" />`
- `<ListRow variant="double" icon="cal" title="주일 예배" sub={['10월 25일 일요일', '항목 12개']} />`
- `<ListRow toggle pressed icon="prop" title="로고 화면" />`(퀵 실행)
- `<ListGroup label="찬양">…</ListGroup>`, `<ListSlot icon="song" label="찬양" />`, `<ListInsertLine />`, `<ListDragGhost icon="song" title="주 하나님 지으신 모든 세계" adding />`
- 줄은 `button`(또는 `role="option"`인 요소)로 만들고 상태는 `aria-selected`, `aria-pressed`, `disabled`/`aria-disabled`, `data-state="live | done | warning"`(여럿이면 띄어 씁니다)로 줍니다.
- 클래스: `ll-rowlist`, `ll-rowlist--inset`, `ll-row`, `ll-row--double`, `ll-row--ghost`, `ll-row__icon`, `ll-row__title`, `ll-row__meta`, `ll-row__warn`, `ll-row__lines`, `ll-row__sub`, `ll-row__slot`, `ll-row__slot-mark`, `ll-row__add`, `ll-row-group`, `ll-row-insert`.

## 시안과 달라진 점

- ShowH, Compact 퀵 실행: 켜진 줄(로고 화면) 바탕 #262626 → `bg-control-hover`(투명 버튼의 켜짐 규칙). 꺼진 줄 글자 #cfcfcf → `text`, 아이콘 #8c8c8c → `text-2`. 오른쪽 여백 12 → 14.
- Compact 목록 줄: 높이 28, 글자 12px, 아이콘 14, 아이콘과 글자 사이 8, 좌우 12 → 30, 13px, 16, 10, 14. 묶음 머리글 안쪽 8 12 4 → 10 14 5. LIVE 배지 15px/9px → `StatusMarks` 배지.
- NewService, ServiceImport 왼쪽 목록: 빈 예배 줄 36 → 30, 묶음 머리글 위 12 → 10.
- NewService 빈 자리: 점선 #4a4a4a → `line-control`.
- AddSongs 끌고 있는 줄: 바탕 rgba(42, 42, 42, 0.95) → `bg-control`, 더하기 원 #3d8bf0 → `accent-fill`, 그림자 0 8px 20px → `shadow-popover`.
