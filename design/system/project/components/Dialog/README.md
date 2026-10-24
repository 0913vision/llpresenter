# Dialog

작업 하나를 끝내야 닫히는 대화상자입니다. 44px 머리글, 안쪽 16px의 몸통, 52px 바닥글로 되어 있고 메뉴줄 아래를 막으로 덮습니다. 새 예배, 다른 예배에서 가져오기, 텍스트 가져오기에 씁니다.

## 쓰는 곳

- 새 예배: `dialog-l`, 두 칸 몸통(왼쪽 틀과 지난 예배, 오른쪽 예배 순서) + 바닥글 위 입력 줄(이름, 날짜, 시간)
- 다른 예배에서 가져오기: `dialog-l`, 두 칸 몸통
- 텍스트 가져오기: `dialog-xl`, 머리글 아래 옵션 줄(장 나누기, 한 장에, 이름표 인식) + 장 미리보기

## 쓰지 않는 곳

- 질문 하나에 답하는 창(덮어쓸까요?, 출력 상태 복구): `AlertDialog`를 씁니다.
- 짧은 목록에서 하나 고르기: `Menu`의 팝오버 목록을 씁니다.
- 알리기만 하는 것: `Notification`을 씁니다.

## 구성

- 막 `ll-scrim`: 바탕 `scrim`, 메뉴줄(`size-menubar` 30px) 아래부터 창 끝까지 덮고 대화상자를 가운데 둡니다. 좌우 16px은 남깁니다. 쌓임 `z-dialog`. 메뉴줄은 덮지 않지만 대화상자가 열린 동안 메뉴는 열리지 않습니다.
- 면 `ll-dialog`: 바탕 `bg-dialog`, 모서리 `radius-2xl`(8px), 그림자 `shadow-dialog`(1px `line-strong` 테두리 포함). 너비는 `dialog-s/m/l/xl` 중 하나(`ll-dialog--s` … `--xl`). 높이는 내용이 정하거나 화면이 정한 값(새 예배 700). 창이 작으면 너비 = 창 너비 − 32, 높이 최대 = 창 높이 − 64이고 몸통만 스크롤합니다.
- 머리글 `ll-dialog__header`: 높이 `size-dialog-header`(44px), 왼쪽 `dialog-inset`(16px) 오른쪽 `space-8`, 아래 1px `line`.
  - 제목 `ll-dialog__title`: `title`(13/18/600).
  - 부제 `ll-dialog__subtitle`: 제목 뒤 `space-12`, `label`(12/16) `text-3`, 앞 아이콘 14px(사이 `space-6`). 다루는 대상의 이름(파일 이름).
  - 닫기 `ll-dialog__close`: 30×30 투명 아이콘 버튼, `x` 16px `text-2`, 오른쪽 끝.
- 옵션 줄과 입력 줄 `ll-dialog__bar`: 높이 52px(`size-dialog-footer`와 같음), 좌우 16px, 항목 사이 `space-20`, 항목 이름(`label` 12/16 `text-2`)과 컨트롤 사이 `space-10`. 컨트롤은 md(30px). 바닥글 위에 두면 위 1px `line`, 머리글 아래에 두면(`--top`) 아래 1px `line`.
- 몸통 `ll-dialog__body`: 안쪽 16px, 남는 높이를 쓰고 넘치면 몸통만 스크롤합니다.
  - 두 칸 `ll-dialog__body--split`: 왼쪽 `ll-dialog__aside` 260px(오른쪽 1px `line`, 토큰 없음)과 오른쪽 `ll-dialog__main`(안쪽 16px, 상자 사이 `space-12`).
  - 왼쪽 고르기 목록은 `ListRow`의 `ll-rowlist--inset`(안쪽 8px, 두 줄 항목 44px). 목록 아래에 붙는 동작은 `ll-dialog__aside-foot`(좌우 8 아래 8, 투명 sm 버튼 "지금 예배를 틀로 저장").
  - 목록 상자 `ll-dialog__box`: 바탕 `bg-inset`, 안쪽 1px `line` 테두리, 모서리 `radius-lg`. 머리글 `ll-dialog__box-header` 34px(`label-strong` 12/16/600, 앞에 모두 고르기 체크 상자, 오른쪽 개수 `ll-dialog__box-meta` `text-3`), 몸통 `ll-dialog__box-body`(위 4 아래 8)에 `Checkbox`의 체크 줄.
- 바닥글 `ll-dialog__footer`: 높이 `size-dialog-footer`(52px), 좌우 16px, 위 1px `line`. 버튼은 md(30px), 오른쪽 정렬, 사이 `space-8`, 순서는 [취소] … [주 버튼]. 주 버튼은 하나이고 맨 오른쪽입니다.

## 크기와 변형

| 이름 | 높이 | 글자 | 쓰는 곳 |
| --- | --- | --- | --- |
| dialog-s (460) | 내용 | - | 확인 창(`AlertDialog`) |
| dialog-m (600) | 내용 | - | 출력 상태 복구(`AlertDialog` 목록형) |
| dialog-l (820) | 700 | - | 새 예배, 다른 예배에서 가져오기 |
| dialog-xl (1080) | 내용 | - | 텍스트 가져오기 |
| 머리글 | 44 | title 13/18/600, 부제 label text-3 | 모든 대화상자 |
| 옵션 줄, 입력 줄 | 52 | 이름 label text-2, 컨트롤 md | 텍스트 가져오기 옵션, 새 예배 이름, 날짜, 시간 |
| 바닥글 | 52 | 버튼 md body | 모든 대화상자 |

## 상태

| 상태 | 바탕 | 글자/아이콘 | 그 밖 |
| --- | --- | --- | --- |
| 열림 | 막 `scrim` + 면 `bg-dialog` | | 막과 면 160ms 페이드. `prefers-reduced-motion`이면 바로 |
| 닫기 기본 | 투명 | `text-2` | |
| 닫기 마우스 올림 | `bg-raised` | `text-2` | 100ms ease-out |
| 닫기 누름 | `bg-control-hover` | `text` | |
| 닫기 포커스 | 그대로 | 그대로 | outline 2px `accent`, offset 1px |
| 주 버튼 쓸 수 없음 | `bg-control` | `text-off` | 필요한 값이 비었을 때. 이유는 툴팁(`Button`) |
| 몸통 넘침 | 그대로 | 그대로 | 몸통만 스크롤, 머리글, 줄, 바닥글은 고정 |

## 동작

- 열면 첫 입력 칸에 포커스를 두고 글자를 모두 고릅니다(새 예배: 이름 칸). 입력 칸이 없으면 주 버튼에 둡니다.
- 포커스는 대화상자 안에서만 돕니다(Tab, Shift+Tab). 순서는 화면 순서: 닫기 → 몸통 → 줄 → 바닥글.
- Enter는 주 버튼(포커스가 여러 줄 입력 칸이나 목록 안이 아닐 때). Esc와 닫기 버튼은 [취소]와 같습니다.
- 막을 눌러도 닫지 않습니다.
- 닫으면 포커스를 대화상자를 연 버튼이나 메뉴 항목으로 돌려 둡니다.
- 대화상자가 열려 있어도 출력 지우기 단축키(F1~F7)는 동작합니다. 예배 중 화면을 곧바로 지울 수 있어야 하기 때문입니다.
- `Notification`은 막 위에 보이고, 알림의 동작 버튼은 대화상자가 열려 있어도 누를 수 있습니다.
- aria: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`에 제목 id. 열린 동안 뒤의 앱은 `inert`로 둡니다(알림 층은 빼고).

## 글쓰기

- 제목은 하는 일의 이름: "새 예배", "다른 예배에서 가져오기", "텍스트 가져오기". 물음표나 설명을 붙이지 않습니다.
- 주 버튼은 동사: "만들기", "가져오기", "편집". "확인", "예"를 쓰지 않습니다.
- 몸통 위에 안내 문단을 두지 않습니다. 필요한 말은 항목 이름이나 툴팁에 씁니다.
- 부제는 대상 이름만: "만복의 근원 하나님.txt".

## 구현 메모

- `<Dialog size="l" title="새 예배" onClose footer={<><Button size="md">취소</Button><Button size="md" variant="primary">만들기</Button></>}>…</Dialog>`
- `<Dialog size="xl" title="텍스트 가져오기" subtitle={{ icon: 'filetext', text: '만복의 근원 하나님.txt' }} bar={<DialogBar position="top">…</DialogBar>}>`
- 부품: `<DialogSplit aside={…}>`, `<DialogBox title="예배 순서" meta="항목 9개" checkAll>`, `<DialogBar position="top" | "bottom">`, `<DialogField label="이름">`.
- 너비와 높이 제한은 CSS(`max-width: calc(100vw - 32px)`, `max-height: calc(100vh - 64px)`)가 맡습니다.
- 클래스: `ll-scrim`, `ll-dialog`, `ll-dialog--s`, `--m`, `--l`, `--xl`, `ll-dialog__header`, `ll-dialog__title`, `ll-dialog__subtitle`, `ll-dialog__close`, `ll-dialog__bar`, `ll-dialog__bar--top`, `ll-dialog__field`, `ll-dialog__field-label`, `ll-dialog__body`, `ll-dialog__body--split`, `ll-dialog__aside`, `ll-dialog__aside-foot`, `ll-dialog__main`, `ll-dialog__box`, `ll-dialog__box-header`, `ll-dialog__box-meta`, `ll-dialog__box-body`, `ll-dialog__footer`.

## 시안과 달라진 점

- NewService, ServiceImport: 닫기 버튼 28 → 30. 바닥글 버튼 글자 12 → 13(md), 주 버튼 바탕 #3d8bf0 → `accent-fill`, 주 버튼 좌우 16 → 14.
- NewService 입력 줄: 높이 60 → 52. 날짜, 시간 드롭다운 바탕 #262626 → `bg-control`(`Select`).
- ImportText: 너비 980 → `dialog-xl` 1080, 머리글 48 → 44, 제목 14px → 13px, 좌우 18 → 16, 옵션 줄 항목 사이 28 → 20, 바닥글 56 → 52, 바닥글 버튼 32 → 30, 그림자 0 20px 48px → `shadow-dialog`, 막 창 전체 → 메뉴줄 아래부터.
