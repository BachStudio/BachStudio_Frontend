# Bach Studio

Bach Studio는 웹 DAW 프론트엔드와 Humming AI 백엔드를 같이 두는 프로젝트입니다.

## 폴더 구조

```text
BachStudio_Frontend/
├── BachStudio_Frontend/   # React + TypeScript + Vite 프론트엔드
└── BachStudio_Backend/    # FastAPI Humming AI 백엔드
```

## 프론트엔드 실행

```powershell
cd .\BachStudio_Frontend
npm install
npm run dev
```

## 백엔드 실행

백엔드 세부 설치와 RMVPE 설정은 `BachStudio_Backend/README.md`를 기준으로 봅니다.

```powershell
cd .\BachStudio_Backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

백엔드 확인 주소:

```text
http://127.0.0.1:8000/api/v1/health
```
