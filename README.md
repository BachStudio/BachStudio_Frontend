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

## 필요한 프로젝트 저장 API

프론트엔드는 `VITE_API_BASE_URL` 기본값으로 `http://127.0.0.1:8000/api/v1`을 씁니다. 프로젝트 저장 기능을 백엔드에 붙이려면 아래 엔드포인트가 필요합니다.

| Method | Path | 용도 |
| --- | --- | --- |
| `POST` | `/api/v1/projects/` | 프로젝트 저장 또는 덮어쓰기 |
| `GET` | `/api/v1/projects/{projectName}` | 프로젝트 단건 불러오기 |
| `GET` | `/api/v1/projects/` | 프로젝트 목록 불러오기 |
| `DELETE` | `/api/v1/projects/{projectName}` | 프로젝트 삭제 |

저장 요청 body:

```json
{
  "projectName": "My Song",
  "bpm": 128,
  "tracks": [],
  "timestamp": 1716350000000
}
```

응답은 저장한 프로젝트를 그대로 반환하면 됩니다. 프론트는 `projectName`, `bpm`, `tracks`, `timestamp`를 기대하고, `tracks`는 프론트 `Track[]` JSON을 그대로 저장/반환하는 방식이면 됩니다.

주의: `DELETE /api/v1/projects/{projectName}`는 응답 body 없이 `204 No Content`를 반환하거나, body를 줄 거면 `200 OK`로 반환해야 합니다. FastAPI에서 `204`에 body가 있으면 서버가 뜨지 않습니다.
