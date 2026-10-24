# Select

지금 고른 값을 보여 주고 누르면 고를 것들의 메뉴를 여는 드롭다운 버튼입니다. 기본 배경, 구성, 언어, 장치, 날짜와 시간처럼 정해진 것 중 하나를 고를 때 씁니다.

## 쓰는 곳

- 진행 화면과 가져온 곡 편집 머리글의 기본 배경(따뜻한 빛), 준비 화면의 구성(주일용)
- 항목 설정의 배경, 시작할 때(매크로)
- 화면 설정의 장치, 해상도, 연결이 끊기면 / Look 편집의 글꼴 / 무대 배치의 내용 종류
- 환경설정의 모든 고르기 줄(언어, 시작할 때, 자동 저장, 장 나누기, 출처 위치)
- 새 예배의 날짜(11월 1일 일요일)와 시간(오전 11:00)
- 성경 구절의 역본(개역한글), 참조(장마다)

## 쓰지 않는 곳

- 고를 것이 2~4개이고 모두 짧은 이름일 때: `SegmentedControl`을 씁니다(청중/무대, 반복/멈춤).
- 명령을 실행하는 메뉴 단추(더 보기, 매크로 추가): `IconButton`이나 `Button`에 `aria-haspopup="menu"`를 줍니다.
- 패널 머리글의 예배 이름처럼 투명한 바탕에 화살표만 붙은 전환 단추: `Panel`의 `ll-panel__switch`입니다.
- 툴바의 Look 고르기(평상시): `ToolbarButton`입니다.
- 열린 뒤의 목록: `Menu`(`ll-menu`)가 그립니다. Select는 단추만 그립니다.

## 구성

- 바탕 `bg-control`, 모서리 `radius-md`, 글자 `text`. #262626(`bg-raised`) 드롭다운은 쓰지 않습니다.
- md: 높이 `size-control-md`(30), 글자 `body`(13/18), 왼쪽 `space-10`, 오른쪽 `space-8`. 입력 칸(TextField)과 글자 시작 위치를 맞추려고 버튼보다 왼쪽 여백이 좁습니다.
- sm: 높이 `size-control-sm`(26), 글자 `label`(12/16), 왼쪽 `space-8`, 오른쪽 `space-6`.
- 값 `ll-select__value`: 남는 너비를 차지하고 넘치면 말줄임.
- 부가 정보 `ll-select__meta`: 값 뒤 8px, md `label`(12/16) / sm `caption`(11/14), 색 `text-2`. `bg-control` 위라서 `text-3`을 쓰지 않습니다. 예: 곡 기본값, 매크로, EPSON 프로젝터.
- 화살표 `ll-select__chevron`: `down` 12px(`size-icon-12`), `text-3`, 앞 것과 8px. 글자가 아닌 표시라 `bg-control` 위에서도 3:1을 넘습니다(4.3:1, hover 바탕에서 3.8:1).
- 앞 아이콘 `ll-select__icon`: md 16px, 글자와 8px, 왼쪽 여백 `space-10` / sm 14px, 글자와 6px, 왼쪽 `space-8`. 색 `text-2`. 날짜 `cal`, 시간 `clock`, 역본 `translate`.
- 앞 미디어 `ll-select__media`: 36×20, `radius-xs`, `object-fit: cover`, 글자와 8px. 왼쪽 여백은 위아래 여백과 같게 md 5px / sm 3px.
- 앞 매크로 색 칸 `ll-select__tile`: 20×20, `radius-md`, 바탕은 그 매크로의 이름표 색, 안 아이콘 14px `text-on-label`. 여백은 미디어와 같습니다.
- 너비: 머리글 안에서는 내용만큼, 속성 칸과 환경설정에서는 조작 칸을 채웁니다(`ll-select--block`).

## 크기와 변형

| 이름 | 높이 | 글자 | 쓰는 곳 |
| --- | --- | --- | --- |
| sm | 26 | label 12/16 | 패널 머리글(기본 배경, 구성), 성경 구절 설정 줄(역본, 참조) |
| md | 30 | body 13/18 | 속성 칸, 환경설정, 대화상자(새 예배 날짜와 시간) |
| 앞 미디어 | sm, md | 같음 | 배경을 고르는 곳 |
| 앞 색 칸 | md | 같음 | 매크로를 고르는 곳 |
| 앞 아이콘 | sm, md | 같음 | 날짜, 시간, 역본 |
| 부가 정보 | sm, md | 값보다 한 단 작게 | 값의 출처나 장치 이름 |

## 상태

| 상태 | 바탕 | 글자/아이콘 | 그 밖 |
| --- | --- | --- | --- |
| 기본 | bg-control | 값 text, 부가 정보와 앞 아이콘 text-2, 화살표 text-3 | |
| 마우스 올림 | bg-control-hover | 같음 | 100ms ease-out |
| 누름 | bg-control-hover | 같음 | |
| 열림 | bg-control-hover | 같음 | `aria-expanded="true"`. 메뉴가 닫힐 때까지 유지 |
| 포커스 | bg-control | 같음 | outline 2px accent, offset 1px(키보드일 때만) |
| 쓸 수 없음 | bg-control | 모두 text-off | hover 없음, 미디어 그림은 그대로. 이유는 툴팁 |

## 동작

- 누르거나 Enter, Space, 아래 화살표로 메뉴를 엽니다. 메뉴는 단추 아래 왼쪽 끝에 맞춰 열고, 메뉴 너비는 단추 너비보다 좁지 않게 합니다.
- 메뉴에서는 지금 값 앞 칸에 체크를 둡니다(`Menu` 규칙). 고르면 메뉴가 닫히고 포커스는 단추로 돌아옵니다. Esc는 고르지 않고 닫습니다.
- 날짜 단추는 달력 팝오버를 엽니다(`aria-haspopup="dialog"`). 그 밖은 `aria-haspopup="listbox"`.
- aria: `aria-expanded`, 보이는 이름이 값뿐이면 `aria-label`에 무엇을 고르는지 함께 씁니다(예: "기본 배경 따뜻한 빛").

## 글쓰기

- 단추에는 지금 값만 씁니다. "선택하세요", "고르기" 같은 말은 쓰지 않습니다. 값이 없을 때는 "없음".
- 부가 정보는 값이 어디서 왔는지를 짧은 명사로: "곡 기본값", "매크로". 문장으로 쓰지 않습니다.
- 날짜는 "11월 1일 일요일", 시간은 "오전 11:00"처럼 앱 전체와 같은 형식으로 씁니다.

## 구현 메모

- `<Select size="sm" value="따뜻한 빛" media={thumbUrl} options={backgrounds} />`
- `<Select size="md" block value="찬양" tile={{ color: 'teal', icon: 'song' }} meta="매크로" />`
- `<Select size="md" icon="cal" value="11월 1일 일요일" popup="dialog" />`
- 마크업: `button.ll-select[.ll-select--sm][.ll-select--block] > [img.ll-select__media | span.ll-select__tile | span.ll-i.ll-select__icon] + span.ll-select__value + [span.ll-select__meta] + span.ll-i.ll-i-down.ll-select__chevron`. 앞 요소에 따른 왼쪽 여백은 CSS가 `:has()`로 맞춥니다.
- 클래스: `ll-select`, `ll-select--sm`, `ll-select--block`, `ll-select__value`, `ll-select__meta`, `ll-select__chevron`, `ll-select__icon`, `ll-select__media`, `ll-select__tile`, `ll-select__tile--<색>`.
- 메뉴는 `Menu` 컴포넌트를 씁니다.

## 시안과 달라진 점

- Prefs, Screens, ScreensNDI, Looks, StageEditor, PrepService의 드롭다운: 바탕 #262626 → `bg-control`, 높이 28 → 30(PrepService는 이미 30), 왼쪽 10 그대로, 화살표 14 → 12.
- PrepService 배경: 미디어 40×24 → 36×20, 왼쪽 3 → 5. 시작할 때: 색 칸 22×22 모서리 5 → 20×20 `radius-md`, 왼쪽 4 → 5. 두 줄 모두 부가 정보 #8c8c8c → `text-2`.
- Screens 장치의 부가 정보(EPSON 프로젝터) #8c8c8c → `text-2`.
- NewService 날짜와 시간: 바탕 #262626 → `bg-control`, 화살표가 없던 것에 12px 화살표 추가, 아이콘 14 #8c8c8c → 16 `text-2`, 좌우 8/10 → 12/8.
- ShowH, Reflow, ImportEdit 기본 배경(sm): 화살표 14 → 12. Compact 기본 배경: 높이 24 → 26, 미디어 32×18 → 36×20, 사이 6 → 8.
- Bible 역본: 아이콘 #8c8c8c → `text-2`, 화살표 14 → 12, 오른쪽 8 → 6. 참조(장마다): 높이 24 → 26, 바탕 #262626 → `bg-control`, 좌우 8/6 → 10/6.
