# LoveLight Presenter

교회 예배에서 가사, 성경 구절, 공지를 여러 화면에 내보내는 Windows용 앱입니다. 지금 `rewrite` 브랜치에서 처음부터 다시 만들고 있습니다.

- 무엇을 만드는지와 지금 상태: [docs/HANDOFF.md](docs/HANDOFF.md)
- 기능 명세: [docs/spec/](docs/spec/)
- 디자인 시스템과 시안: [design/](design/)
- 기술 결정과 품질 기준: [docs/TECH.md](docs/TECH.md)
- 구현 계획과 작업 방식: [docs/PLAN.md](docs/PLAN.md), [docs/WORKFLOW.md](docs/WORKFLOW.md)

## 개발

```bash
npm ci
npm run dev
```

- `npm run typecheck`, `npm test`, `npm run build`
- 개발 서버 포트와 앱 데이터 폴더는 `LLP_DEV_PORT`, `LLP_USER_DATA`로 바꿉니다.
