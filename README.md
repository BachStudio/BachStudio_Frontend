# Bach Studio Frontend

Bach Studio는 React + TypeScript + Vite 기반의 웹 DAW 프로토타입입니다. 현재 핵심 구현은 `bach studio/src` 아래에 있고, 루트의 여러 `.html` 파일은 이전 화면 시안 또는 정적 목업에 가깝습니다.

이 문서는 친구가 만든 Humming AI 기능을 피아노롤에 연결할 때 필요한 프론트엔드 구조와 API 계약을 정리합니다.

## 실행

```powershell
cd "bach studio"
npm install
npm run dev
```

Vite 개발 서버가 열리면 `/`에서 새 프로젝트를 만들고, `/editor` 화면에서 트랙을 추가해 피아노롤을 열 수 있습니다.

## 코드 구조

```text
bach studio/src/App.tsx
bach studio/src/features/landing/LandingView.tsx
bach studio/src/features/project/*
bach studio/src/features/editor/MainEditor.tsx
bach studio/src/features/editor/PianoRollOverlay.tsx
bach studio/src/features/editor/TimelinePanel.tsx
bach studio/src/features/editor/types.ts
bach studio/src/features/editor/constants.ts
bach studio/src/features/editor/fileUtils.ts
```

- `App.tsx`: 라우팅과 새 프로젝트 모달을 관리합니다.
- `MainEditor.tsx`: 트랙, 클립, 피아노롤 노트 상태를 소유합니다. AI 결과를 실제 노트로 넣어야 하는 위치입니다.
- `PianoRollOverlay.tsx`: 피아노롤 UI와 오른쪽 `Humming AI` 패널을 렌더링합니다. 현재는 UI만 있고 실제 녹음/API 연결은 없습니다.
- `types.ts`: `Track`, `Clip`, `Note` 타입이 정의되어 있습니다.
- `constants.ts`: MIDI 범위, 그리드 크기, 1박당 스텝 수가 정의되어 있습니다.
- `fileUtils.ts`: 프로젝트를 `localStorage`에 저장/불러오기 합니다.

## 현재 피아노롤 데이터 모델

프론트엔드에서 피아노롤 노트는 아래 타입입니다.

```ts
export type Note = {
  id: number;
  start: number;
  pitch: number;
  length: number;
};
```

중요한 점은 `pitch`가 MIDI 번호가 아니라 피아노롤 row index라는 점입니다.

- `MIDI_LOW = 21`
- `MIDI_HIGH = 108`
- `pitch = MIDI_HIGH - midi`
- `midi = MIDI_HIGH - pitch`
- `PIANO_STEPS_PER_BEAT = 4`
- `start`와 `length`는 피아노롤 grid column 단위입니다.
- 예: `startBeat = 1`, `durationBeats = 0.5`라면 `start = 4`, `length = 2`

즉 AI가 `B3`, `F4` 같은 음 이름만 주면 프론트에서 정확한 위치를 만들 수 없습니다. 최소한 `midi`, `startBeat`, `durationBeats`가 필요합니다.

## Humming AI 연결 위치

현재 버튼과 패널은 여기에 있습니다.

```text
bach studio/src/features/editor/PianoRollOverlay.tsx
```

실제 노트를 넣는 상태 업데이트 함수는 여기에 있습니다.

```text
bach studio/src/features/editor/MainEditor.tsx
```

`MainEditor.tsx`의 `updateActiveClipNotes`가 현재 열린 피아노롤 클립의 `notes`를 갱신합니다. 따라서 권장 흐름은 다음과 같습니다.

1. `PianoRollOverlay`에서 마이크 녹음 UI를 추가합니다.
2. 녹음된 `Blob`을 Humming AI API로 보냅니다.
3. API 응답을 `MainEditor`에서 `Note[]`로 변환합니다.
4. `updateActiveClipNotes`로 현재 클립에 노트를 추가하거나 교체합니다.

## 권장 API 계약

프론트엔드에서 다루기 쉬운 형태는 아래와 같습니다.

```http
POST /api/humming/transcribe
Content-Type: multipart/form-data
```

요청 필드:

- `audio`: `webm`, `wav`, `mp3` 중 하나의 음성 파일
- `bpm`: 현재 프로젝트 BPM
- `clipLengthBeats`: 현재 피아노롤 클립 길이
- `quantize`: 예: `1/16`

응답 예시:

```json
{
  "key": "D minor",
  "notes": [
    {
      "midi": 59,
      "note": "B3",
      "startBeat": 0,
      "durationBeats": 0.5,
      "confidence": 0.93
    },
    {
      "midi": 65,
      "note": "F4",
      "startBeat": 0.5,
      "durationBeats": 0.5,
      "confidence": 0.91
    }
  ]
}
```

`note`는 화면 표시용이고, 실제 변환에는 `midi`를 기준으로 쓰는 것이 안전합니다. `startBeat`는 현재 열린 클립 시작점을 0으로 보는 상대 위치로 맞추는 것이 가장 단순합니다.

## 변환 로직 예시

```ts
import {
  GRID_TOTAL_ROWS,
  MIDI_HIGH,
  PIANO_STEPS_PER_BEAT,
} from './constants';
import type { Note } from './types';

type HummingAiNote = {
  midi: number;
  startBeat: number;
  durationBeats: number;
  confidence?: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

function convertHummingNotesToPianoRollNotes(
  aiNotes: HummingAiNote[],
  clipLengthBeats: number,
): Note[] {
  const maxCols = Math.max(1, clipLengthBeats * PIANO_STEPS_PER_BEAT);

  return aiNotes.map((note, index) => {
    const start = clamp(
      Math.round(note.startBeat * PIANO_STEPS_PER_BEAT),
      0,
      maxCols - 1,
    );
    const length = clamp(
      Math.round(note.durationBeats * PIANO_STEPS_PER_BEAT),
      1,
      maxCols - start,
    );
    const pitch = clamp(MIDI_HIGH - note.midi, 0, GRID_TOTAL_ROWS - 1);

    return {
      id: Date.now() + index,
      start,
      pitch,
      length,
    };
  });
}
```

연결할 때는 `PianoRollOverlay`에 `onConvertHumming` 같은 prop을 추가하고, `MainEditor`에서 이 함수를 구현하는 방식이 현재 구조와 가장 잘 맞습니다.

## 환경 변수

AI 서버 주소는 하드코딩하지 말고 Vite 환경 변수로 받는 것을 권장합니다.

```text
VITE_HUMMING_AI_URL=http://localhost:8000
```

사용 예:

```ts
const baseUrl = import.meta.env.VITE_HUMMING_AI_URL;
```

## 연결 체크리스트

1. `Instrument` 트랙을 추가합니다.
2. 트랙 lane을 더블클릭해 MIDI 클립을 만들거나 기존 클립을 더블클릭합니다.
3. 피아노롤 상단의 `Humming AI` 버튼을 눌러 패널을 엽니다.
4. 마이크 녹음 버튼을 추가하고 `MediaRecorder`로 오디오를 캡처합니다.
5. 녹음이 끝나면 AI API에 `audio`, `bpm`, `clipLengthBeats`를 보냅니다.
6. 응답의 `notes`를 `Note[]`로 변환합니다.
7. 현재 클립에 노트를 넣고, 화면에 블록이 생성되는지 확인합니다.
8. 저장 버튼 또는 `Ctrl+S`로 프로젝트가 `localStorage`에 저장되는지 확인합니다.

## 주의할 점

- 멜로디 AI는 `Instrument` 트랙에 먼저 연결하는 것이 안전합니다. `Drums`도 피아노롤을 열 수 있지만, 재생 로직은 드럼 lane에 맞춰 다르게 동작합니다.
- AI가 절대 타임라인 기준 `startBeat`를 반환한다면, 프론트에서 `activeClip.start`를 빼서 클립 상대 위치로 바꿔야 합니다.
- 브라우저 마이크 권한 때문에 개발 서버는 `localhost` 또는 HTTPS 환경에서 테스트해야 합니다.
- API 서버가 다른 포트에서 뜨면 CORS 허용이 필요합니다.
- 현재 프로젝트 저장은 서버가 아니라 브라우저 `localStorage` 기준입니다.
