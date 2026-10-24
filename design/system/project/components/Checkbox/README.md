# Checkbox

여러 개를 골라 담을 때 쓰는 16px 체크 상자와, 줄 어디를 눌러도 바뀌는 체크 줄입니다. 다른 예배에서 가져오기의 항목 나무, 출력 상태 복구의 복구할 상태, Look의 층 목록에 씁니다.

## 쓰는 곳

- 다른 예배에서 가져오기, 새 예배의 예배 순서: 묶음(예배 전, 찬양)과 항목을 골라 담기
- 출력 상태 복구: 복구할 상태(화면 출력, 마지막 장, 표시 중이던 항목)
- Look 편집의 층 목록(보이기)

## 쓰지 않는 곳

- 바로 적용되는 켜고 끄기 설정(항상 위, 절전 막기, 오류 보고 보내기): `Switch`를 씁니다.
- 하나만 고르는 곳: `SegmentedControl`이나 `Select`를 씁니다.
- 목록에서 지금 고른 줄을 나타낼 때: 목록 줄의 `selection` 바탕을 씁니다. 체크 상자를 덧붙이지 않습니다.

## 구성

- 상자 `ll-check`: 16×16, 모서리 `radius-sm`(3px).
  - 꺼짐: 바탕 `bg-well`, 테두리 `inset 0 0 0 1px` `line-control`.
  - 켜짐: 바탕 `accent-fill`, 흰 체크(`check` 12px, `text-on-fill`), 테두리 없음.
  - 일부: 바탕 `accent-fill`, 가운데 8×2 막대(`text-on-fill`, 모서리 1px).
- 체크 줄 `ll-check-row`: 높이 `size-row`(30), 상자와 다음 것 사이 `space-10`, 글자 `body`(13/18) `text`.
  - 종류 아이콘 `ll-check-row__icon`: 16px `text-2`, 글자와 10px.
  - 오른쪽 부가 정보 `ll-check-row__meta`: `caption`(11/14) `text-3`(예: 구성 이름 주일용).
  - 값이 붙는 줄(출력 상태 복구): 이름을 `ll-check-row__text--fixed`(168px)로 고정하고, 뒤에 값 `ll-check-row__value`(`label` 12/16, `text-3`, 말줄임)를 둡니다.
- 목록 안의 줄 `ll-check-row--list`: 좌우 `space-14`, 마우스 올림 `bg-raised`. 목록 줄과 같은 규칙입니다.
- 묶음 머리글 줄 `ll-check-row--group`: 글자 `caption-strong`(11/14/600) `text-3`. 그 묶음의 항목이 일부만 골라지면 상자가 일부 상태가 됩니다.
- 대화상자 안의 줄(출력 상태 복구)은 좌우 여백과 hover 없이 대화상자 몸통의 여백을 따릅니다.

## 크기와 변형

| 이름 | 높이 | 글자 | 쓰는 곳 |
| --- | --- | --- | --- |
| 상자 | 16 | - | 줄 안, 목록 머리글(모두 고르기) |
| 체크 줄 | 30 | body 13/18 | 대화상자 안의 고르기 |
| 목록 줄 | 30 | body 13/18, 좌우 14 | 다른 예배에서 가져오기, 새 예배, Look 층 |
| 묶음 머리글 줄 | 30 | caption-strong 11/14/600 text-3 | 항목 나무의 부모 |

## 상태

| 상태 | 바탕 | 글자/아이콘 | 그 밖 |
| --- | --- | --- | --- |
| 꺼짐 | bg-well | - | 테두리 line-control 1px |
| 켜짐 | accent-fill | 체크 text-on-fill | |
| 일부 | accent-fill | 막대 text-on-fill | `aria-checked="mixed"` |
| 마우스 올림 | 목록 줄은 bg-raised | 같음 | 상자 자체는 바뀌지 않습니다 |
| 포커스 | 같음 | 같음 | 상자에 outline 2px accent, offset 1px |
| 쓸 수 없음(꺼짐) | bg-well | 줄 글자, 아이콘, 부가 정보 text-off | 테두리 line-strong. hover 없음 |
| 쓸 수 없음(켜짐, 일부) | bg-control | 체크와 막대 text-off | 투명도를 낮추지 않습니다. 이유는 툴팁 |

## 동작

- 줄 전체가 `label`이라 상자, 아이콘, 이름 어디를 눌러도 바뀝니다. Space도 바꿉니다.
- 묶음 머리글을 누르면: 일부나 꺼짐이면 묶음 전체를 켜고, 켜짐이면 전체를 끕니다. 항목을 바꾸면 머리글 상태를 다시 셉니다(전부 켜짐, 일부, 전부 꺼짐).
- 목록(항목 나무) 안에서는 탭이 목록에 한 번만 들어가고, 위아래 화살표로 줄을 옮기며 Space로 바꿉니다. 대화상자 안의 몇 줄(출력 상태 복구)은 상자마다 탭이 멈춥니다.
- aria: `role="checkbox"`, `aria-checked="true|false|mixed"`. 나무 구조면 목록에 `role="tree"`, 줄에 `role="treeitem"`과 `aria-checked`를 줍니다.

## 글쓰기

- 줄 이름은 담길 것의 이름만 씁니다: "화면 출력", "마지막 장", "표시 중이던 항목". "~을 복구합니다" 같은 문장으로 쓰지 않습니다.
- 값은 지금 무엇이 들어 있는지를 쉼표로 늘어놓습니다: "본 화면, 무대 화면, 방송 자막".

## 구현 메모

- `<Checkbox checked={true | false | 'mixed'} onChange />`
- `<CheckRow checked label="주일 광고" icon="notice" meta="주일용" variant="list" />`, `<CheckRow group label="예배 전" checked="mixed" />`
- 마크업: `label.ll-check-row[.ll-check-row--list][.ll-check-row--group] > button.ll-check[role=checkbox][aria-checked] > span.ll-i.ll-i-check` + `[span.ll-i.ll-check-row__icon]` + `span.ll-check-row__text` + `[span.ll-check-row__value | span.ll-check-row__meta]`
- 일부 상태의 막대는 CSS가 `::after`로 그리므로 체크 아이콘 span은 늘 넣어 둡니다.
- 클래스: `ll-check`, `ll-check-row`, `ll-check-row--list`, `ll-check-row--group`, `ll-check-row__icon`, `ll-check-row__text`, `ll-check-row__text--fixed`, `ll-check-row__value`, `ll-check-row__meta`.

## 시안과 달라진 점

- NewService, ServiceImport, Recovery, Looks의 켜진 상자: 바탕 #3d8bf0(`accent`) → `accent-fill`.
- ServiceImport, Looks의 꺼진 상자: 테두리 #4a4a4a → `line-control`. Looks는 바탕 투명 → `bg-well`.
- ServiceImport, NewService 줄 높이 28 → 30. Recovery 줄 높이 36 → 30, 상자와 아이콘 사이 12 → 10. Looks 층 목록 줄 34 → 30, 좌우 12 → 14.
