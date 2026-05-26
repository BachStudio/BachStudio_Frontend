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
