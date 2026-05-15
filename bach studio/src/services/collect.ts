const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

// Record<string, string> 타입을 명시합니다.
const getAuthHeader = (): Record<string, string> => {
  const token = localStorage.getItem('access_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

export const collectApi = {
  // 전체 Collect 목록 조회
  async getAll() {
    const res = await fetch(`${API_BASE_URL}/collects/`, {
      headers: { ...getAuthHeader() }
    });
    if (!res.ok) throw new Error('Failed to fetch collects');
    return res.json();
  },

  // 새 Collect 생성
  async create(data: { name: string; bpm: number; tracks: any[] }) {
    const res = await fetch(`${API_BASE_URL}/collects/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  // 특정 Collect 상세 정보 로드
  async getById(id: string) {
    const res = await fetch(`${API_BASE_URL}/collects/${id}`, {
      headers: { ...getAuthHeader() }
    });
    return res.json();
  },

  // Collect 정보 수정 및 저장
  async update(id: string, data: any) {
    const res = await fetch(`${API_BASE_URL}/collects/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  // Collect 삭제
  async delete(id: string) {
    const res = await fetch(`${API_BASE_URL}/collects/${id}`, {
      method: 'DELETE',
      headers: { ...getAuthHeader() }
    });
    return res.json();
  }
};