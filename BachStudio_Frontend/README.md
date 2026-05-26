# BachStudio Frontend

React + TypeScript + Vite 기반 Bach Studio 프론트엔드입니다.

## 실행

```powershell
npm install
npm run dev
```

백엔드 API 주소를 바꾸려면 이 폴더에 `.env`를 만들고 아래 값을 넣습니다.

```text
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
```

## 주요 코드

```text
src/App.tsx
src/features/project/*
src/features/editor/MainEditor.tsx
src/features/editor/PianoRollOverlay.tsx
src/features/editor/TimelinePanel.tsx
src/features/editor/fileUtils.ts
```

## 백엔드 프로젝트 저장 API

프론트 저장 로직은 `src/features/editor/fileUtils.ts`에서 아래 API를 호출합니다.

| Method | Path | 용도 |
| --- | --- | --- |
| `POST` | `/api/v1/projects/` | 저장/덮어쓰기 |
| `GET` | `/api/v1/projects/{projectName}` | 불러오기 |
| `GET` | `/api/v1/projects/` | 목록 조회 |
| `DELETE` | `/api/v1/projects/{projectName}` | 삭제 |

저장 payload:

```ts
type ProjectData = {
  projectName: string;
  bpm: number;
  tracks: Track[];
  timestamp: number;
};
```

`tracks`는 프론트 JSON을 그대로 저장했다가 그대로 반환하면 됩니다.
