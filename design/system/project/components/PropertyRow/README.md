# PropertyRow

속성 칸과 설정 화면에서 이름 하나와 조작 하나를 가로로 놓는 줄, 그리고 그 줄들을 묶는 묶음입니다. 항목 설정, 화면 설정, Look 편집, 무대 배치, 미디어 속성, 환경설정에 씁니다.

## 쓰는 곳

- 오른쪽 열(480, 좁은 창 360)의 속성 패널: 항목 설정(PrepService), 화면 설정의 속성(Screens, ScreensNDI), 무대 배치의 요소(StageEditor), 미디어 속성(Media)
- 가운데 편집 면의 속성 격자: Look 편집의 글자 속성(두 단)
- 환경설정 창의 모든 설정 줄

## 쓰지 않는 곳

- 목록(예배 순서, 라이브러리, 단축키 표): 목록 줄을 씁니다.
- 대화상자 아래의 가로 입력 줄(새 예배의 이름, 날짜, 시간, 텍스트 가져오기의 설정 줄): 이름과 조작을 `space-10`으로 붙여 가로로 늘어놓습니다. 이름 칸 너비를 맞추지 않습니다.
- 고를 것이 줄마다 체크인 목록(출력 상태 복구): `Checkbox`의 값이 붙는 줄입니다.

## 구성

- 묶음 `ll-prop-group`: 위 `space-12`, 아래 `space-8`, 아래에 1px `line`. 마지막 묶음은 선이 없습니다.
- 묶음 이름 `ll-prop-group__title`: `caption-strong`(11/14/600), `text-3`, 아래 `space-4`. 앞 아이콘이 필요하면 12px, 이름과 6px(메모).
- 줄 `ll-prop`: 이름 칸 + 조작 칸, 세로 가운데 정렬.
- 이름 `ll-prop__label`: `label`(12/16), `text-2`. 조작과 이어지도록 `label for`로 씁니다.
- 조작 칸 `ll-prop__control`: 남는 너비. 안의 것들 사이 `space-8`. md 조작(`size-control-md` 30)을 둡니다: `TextField`, `Select`(`--block`), `SegmentedControl`(`--fill`), `Switch`, `Slider`(`--block`), 숫자 칸 + 단위.
- 값 `ll-prop__value`: 읽기만 하는 값. `body`(13/18), `text-2`, 고정폭 숫자, 넘치면 말줄임(주사율 60Hz, 현재 버전 1.0.0, 마지막 백업 오늘 07:58). 이름처럼 읽어야 하는 값(원본 곡 이름)은 `ll-prop__value--primary`로 `text`. 값 앞 아이콘은 14px `text-3`(원본 곡의 `link`).
- 값 뒤 부가 정보 `ll-prop__meta`: `label`(12/16) `text-3`(라이브러리).
- 여러 줄 조작(메모)은 이름 칸 없이 묶음 이름 아래에 칸 너비 전체로 둡니다. 여러 줄 조작에 이름 칸이 꼭 필요하면 `ll-prop--top`으로 이름을 첫 줄에 맞춥니다.

### 이름 칸 너비 규칙

이름 칸 너비는 줄이 놓인 곳으로 정합니다. 화면마다 따로 정하지 않습니다.

| 놓인 곳 | 이름 칸 | 이름과 조작 사이 | 줄 높이 | 조작 칸 |
| --- | --- | --- | --- | --- |
| 패널(오른쪽 열 480, 360, Look 편집 격자) | 84px | `space-12` | 36px 이상 | 남는 너비 |
| 창(환경설정) | 168px | `space-16` | 38px 이상 | 최대 340px |

- 패널 84px에는 12px 글자로 "위치 미세 조정", "연결이 끊기면"까지 한 줄에 들어갑니다. 넘치는 이름은 두 줄로 접지 말고 이름을 줄입니다.
- Look 편집처럼 넓은 면에서 두 단으로 놓을 때는 `ll-prop-cols`로 단 사이 `space-24`. 단 안의 줄은 패널 규칙(84px)을 따릅니다.

## 크기와 변형

| 이름 | 높이 | 글자 | 쓰는 곳 |
| --- | --- | --- | --- |
| 패널 줄 | 36 | 이름 label 12/16 text-2 | 속성 패널, Look 격자 |
| 창 줄 `ll-props--window` | 38 | 같음 | 환경설정 |
| 묶음 이름 | 14 | caption-strong 11/14/600 text-3 | 모든 묶음 |
| 값 | 18 | body 13/18 text-2 | 읽기만 하는 값 |

## 상태

| 상태 | 바탕 | 글자/아이콘 | 그 밖 |
| --- | --- | --- | --- |
| 기본 | 투명(패널 바탕) | 이름 text-2, 값 text-2 | 줄 자체는 hover가 없습니다 |
| 조작이 쓸 수 없음 | 투명 | 이름 text-off, 조작은 그 조작의 규칙 | 조작 칸 안에 `disabled`가 있으면 CSS가 이름을 따라 바꿉니다. 이유는 조작의 툴팁 |

## 동작

- 이름을 누르면 그 조작에 포커스가 가고, 스위치와 체크 상자는 바뀝니다(`label for`).
- 탭 순서는 위에서 아래, 줄 안에서는 왼쪽에서 오른쪽입니다. 이름과 값 글자는 탭이 멈추지 않습니다.
- 묶음 이름은 접고 펴지 않습니다. 묶음이 많아 길어지면 패널 몸통만 스크롤합니다.

## 글쓰기

- 이름은 명사로 짧게: "배경", "시작할 때", "연결이 끊기면", "가장자리 여백". 물음표나 "설정"을 붙이지 않습니다.
- 묶음 이름은 한두 단어: "원본", "이번 예배", "출력", "안정성", "보정", "백업".
- 값 글자에 설명을 덧붙이지 않습니다. 단위만 붙입니다(60Hz, 4.3MB).

## 구현 메모

- `<PropertyGroup title="이번 예배"><PropertyRow label="배경"><Select block … /></PropertyRow></PropertyGroup>`
- `<Properties variant="panel | window">`가 이름 칸 너비와 줄 높이를 정합니다. 화면 쪽에서 너비를 넘기지 않습니다.
- `<PropertyRow label="주사율" value="60Hz" />`처럼 값만 있는 줄은 `ll-prop__value`를 그립니다.
- 마크업: `div.ll-props[.ll-props--window] > div.ll-prop-group > p.ll-prop-group__title + div.ll-prop > label.ll-prop__label + span.ll-prop__control`
- 클래스: `ll-props`, `ll-props--window`, `ll-prop-cols`, `ll-prop-group`, `ll-prop-group__title`, `ll-prop`, `ll-prop--top`, `ll-prop__label`, `ll-prop__control`, `ll-prop__value`, `ll-prop__value--primary`, `ll-prop__meta`.

## 시안과 달라진 점

- Screens, ScreensNDI 속성: 이름 칸 112 → 84.
- Media 속성: 이름 칸 96 → 84.
- PrepService 이번 예배의 줄 높이 40 → 36.
- Looks 글자 속성: 줄 38 → 36, 줄마다 있던 아래 선을 없앰, 두 단 사이 28 → 24.
- 묶음 구분선(PrepService, Screens, ScreensNDI, StageEditor, Media, Prefs): #262626 → `line`.
- 묶음 여백: Screens, ScreensNDI, StageEditor, Media 12/6 → 12/8, Prefs 14/8 → 12/8.
- 모든 속성 칸의 조작 높이 28 → 30(`TextField`, `Select` 문서에 같은 내용).
