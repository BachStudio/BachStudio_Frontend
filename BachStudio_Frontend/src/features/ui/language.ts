export type AppLanguage = 'ko' | 'en' | 'ja';

export const LANGUAGE_STORAGE_KEY = 'bach-studio-ui-language';
export const APP_LANGUAGE_CHANGE_EVENT = 'bach-studio-language-change';

export const LANGUAGE_OPTIONS: Array<{ value: AppLanguage; label: string }> = [
  { value: 'ko', label: '한국어' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
];

export function isAppLanguage(value: string | null): value is AppLanguage {
  return value === 'ko' || value === 'en' || value === 'ja';
}

export function getStoredLanguage(): AppLanguage {
  try {
    const storedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isAppLanguage(storedLanguage) ? storedLanguage : 'ko';
  } catch {
    return 'ko';
  }
}

export function applyLanguage(language: AppLanguage) {
  document.documentElement.lang = language;
  document.documentElement.dataset.appLanguage = language;
}

export function setStoredLanguage(language: AppLanguage) {
  applyLanguage(language);
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Language still applies for this session if local persistence is unavailable.
  }
  window.dispatchEvent(new CustomEvent(APP_LANGUAGE_CHANGE_EVENT, { detail: language }));
}

export const utilityCopy = {
  ko: {
    help: '도움말',
    settings: '설정',
    close: '닫기',
    backendDocs: '백엔드 API 문서',
    projectManager: '프로젝트 매니저',
    language: '언어',
    audioInput: '마이크 입력',
    audioOutput: '오디오 출력',
    midiInput: 'MIDI 입력',
    defaultDevice: '기본 장치',
    noMidiDevices: 'MIDI 장치 없음',
    devicePermission: '장치 권한 허용',
    clearCache: '이전 로컬 캐시 삭제',
    storage: '프로젝트 저장소: 온라인 전용',
    cacheCleared: '이전 로컬 프로젝트 캐시를 삭제했습니다',
    languageSet: '언어 설정',
  },
  en: {
    help: 'Help',
    settings: 'Settings',
    close: 'Close',
    backendDocs: 'Backend API Docs',
    projectManager: 'Project Manager',
    language: 'Language',
    audioInput: 'Microphone Input',
    audioOutput: 'Audio Output',
    midiInput: 'MIDI Input',
    defaultDevice: 'Default Device',
    noMidiDevices: 'No MIDI Devices',
    devicePermission: 'Allow Device Access',
    clearCache: 'Clear Old Local Cache',
    storage: 'Project storage: online only',
    cacheCleared: 'Old local project cache cleared',
    languageSet: 'Language set',
  },
  ja: {
    help: 'ヘルプ',
    settings: '設定',
    close: '閉じる',
    backendDocs: 'バックエンド API ドキュメント',
    projectManager: 'プロジェクトマネージャー',
    language: '言語',
    audioInput: 'マイク入力',
    audioOutput: 'オーディオ出力',
    midiInput: 'MIDI 入力',
    defaultDevice: '既定のデバイス',
    noMidiDevices: 'MIDI デバイスなし',
    devicePermission: 'デバイスアクセスを許可',
    clearCache: '古いローカルキャッシュを削除',
    storage: 'プロジェクト保存先: オンラインのみ',
    cacheCleared: '古いローカルプロジェクトキャッシュを削除しました',
    languageSet: '言語設定',
  },
} satisfies Record<AppLanguage, Record<string, string>>;

export const landingCopy = {
  ko: {
    brand: 'Bach Studio',
    account: '계정',
    logout: '로그아웃',
    googleLogin: 'Google 로그인',
    signingIn: '로그인 중',
    heroEyebrow: '신호 처리: 활성',
    heroTitleLine1: '당신의 목소리를',
    heroTitleLine2: '음악으로.',
    heroBody: '작곡가를 위한 전문적인 Mumble-to-MIDI 기술. 제로 레이턴시 엔진으로 실시간 녹음, 변환 및 다듬기를 진행하세요.',
    startProject: '새 프로젝트 시작하기',
    projectManager: '프로젝트 매니저',
    coreEngine: '코어 엔진',
    aiTranscription: 'AI 전사',
    aiBody: '저희 신경망은 보컬 멜로디, 비트박싱, 콧노래 리프를 깨끗하고 정량화 가능한 MIDI 데이터로 즉시 변환합니다. 더 이상 아이디어를 잃어버릴 걱정은 없습니다.',
    analyzing: '화성 스펙트럼 분석 중...',
    realTimeAnalysis: '실시간 분석',
    realTimeBody: '즉각적인 키 감지 및 스펙트럼 시각화 기능을 제공합니다. 연주하는 동안 음성이 구조화된 악보로 변환되는 모습을 확인하세요.',
    vstSupport: 'VST 지원',
    vstBody: 'MIDI를 선호하는 서드파티 신시사이저와 오케스트라 라이브러리로 바로 라우팅하세요.',
    inputGain: '입력 게인',
    modularWorkflow: '모듈형 워크플로',
    modularBody: '하드웨어처럼 이펙트와 프로세서를 연결하세요. 랙 기반 구조로 자유로운 신호 라우팅과 정밀한 조정이 가능합니다.',
    readyTitle: '작곡할 준비가 되셨나요?',
    readyBody: '상상과 악기 사이의 간격을 이어주는 Bach Studio의 보컬-to-MIDI 엔진을 경험해보세요.',
    startComposing: '작곡 시작하기',
    signInWithGoogle: 'Google로 로그인',
  },
  en: {
    brand: 'Bach Studio',
    account: 'Account',
    logout: 'Logout',
    googleLogin: 'Google Login',
    signingIn: 'Signing In',
    heroEyebrow: 'Signal Processing: Active',
    heroTitleLine1: 'Your Voice,',
    heroTitleLine2: 'Into Music.',
    heroBody: 'Professional Mumble-to-MIDI technology for composers. Record, convert, and refine in real-time with zero-latency engine.',
    startProject: 'Start New Project',
    projectManager: 'Project Manager',
    coreEngine: 'Core Engine',
    aiTranscription: 'AI Transcription',
    aiBody: 'Our neural network converts vocal melodies, beatboxing, and hummed riffs into clean, quantizable MIDI data instantly. No more lost ideas.',
    analyzing: 'Analyzing Harmonic Spectrum...',
    realTimeAnalysis: 'Real-Time Analysis',
    realTimeBody: 'Instant key detection and spectral visualization. Watch your voice become structured notation as you perform.',
    vstSupport: 'VST Support',
    vstBody: 'Route MIDI directly to your favorite third-party synthesizers and orchestral libraries.',
    inputGain: 'Input Gain',
    modularWorkflow: 'Modular Workflow',
    modularBody: 'Chain effects and processors just like hardware. Our rack-based architecture allows infinite signal routing and precision tweaking.',
    readyTitle: 'Ready to Compose?',
    readyBody: "Experience the world's most advanced vocal-to-MIDI engine. Bridge the gap between imagination and instrumentation.",
    startComposing: 'Start Composing',
    signInWithGoogle: 'Sign In With Google',
  },
  ja: {
    brand: 'Bach Studio',
    account: 'アカウント',
    logout: 'ログアウト',
    googleLogin: 'Google ログイン',
    signingIn: 'ログイン中',
    heroEyebrow: '信号処理: 有効',
    heroTitleLine1: 'あなたの声を',
    heroTitleLine2: '音楽へ。',
    heroBody: '作曲家のための Mumble-to-MIDI 技術。ゼロレイテンシーエンジンで録音、変換、調整をリアルタイムに行えます。',
    startProject: '新規プロジェクト',
    projectManager: 'プロジェクト管理',
    coreEngine: 'コアエンジン',
    aiTranscription: 'AI 変換',
    aiBody: 'ニューラルネットワークがボーカルメロディ、ビートボックス、ハミングをクリーンで量子化可能な MIDI データへ即座に変換します。',
    analyzing: '倍音スペクトル解析中...',
    realTimeAnalysis: 'リアルタイム解析',
    realTimeBody: '即時のキー検出とスペクトル可視化により、声が構造化された譜面へ変わる様子を確認できます。',
    vstSupport: 'VST 対応',
    vstBody: 'MIDI をお気に入りのシンセサイザーやオーケストラ音源へ直接ルーティングできます。',
    inputGain: '入力ゲイン',
    modularWorkflow: 'モジュラーワークフロー',
    modularBody: 'ハードウェアのようにエフェクトとプロセッサーを接続し、柔軟な信号ルーティングと細かな調整ができます。',
    readyTitle: '作曲を始めますか?',
    readyBody: '想像と楽器をつなぐ Bach Studio のボーカル-to-MIDI エンジンを体験してください。',
    startComposing: '作曲を始める',
    signInWithGoogle: 'Google でログイン',
  },
} satisfies Record<AppLanguage, Record<string, string>>;
