import { useState } from 'react';
import { Route, Routes, useNavigate } from 'react-router-dom';
import { MainEditor } from './features/editor/MainEditor';
import { LandingView } from './features/landing/LandingView';
import { ProjectManagerView } from './features/project/ProjectManagerView';
import { NewProjectModal } from './features/project/NewProjectModal';
import { getAllProjects } from './features/editor/fileUtils';

const generateUniqueName = () => {
  const projects = getAllProjects();
  const existingNames = new Set(projects.map(p => p.projectName));

  // SESSION_YYYYMMDD_HHMMSS 형식으로 고유한 이름 생성
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  let baseName = `SESSION_${year}${month}${day}_${hours}${minutes}${seconds}`;
  let finalName = baseName;
  let counter = 1;

  // 중복이 없을 때까지 번호 추가
  while (existingNames.has(finalName)) {
    finalName = `${baseName}_${counter}`;
    counter++;
  }

  return finalName;
};

export default function App() {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('Vocal Mask');
  const [projectName, setProjectName] = useState('');
  const [projectBpm, setProjectBpm] = useState('128');

  const handleOpenModal = () => {
    setProjectName(generateUniqueName());
    setIsModalOpen(true);
  };

  const handleStart = () => {
    const normalizedName = projectName.trim() || generateUniqueName();
    
    // 중복 체크: 이미 존재하는 프로젝트명인지 확인
    const existingProjects = getAllProjects();
    const isDuplicate = existingProjects.some(
      (project) => project.projectName.toLowerCase() === normalizedName.toLowerCase()
    );
    
    if (isDuplicate) {
      alert('이 프로젝트 이름은 이미 존재합니다.');
      return;
    }

    const parsedBpm = Number.parseFloat(projectBpm);
    const normalizedBpm = Number.isFinite(parsedBpm) ? String(parsedBpm) : '128';

    setIsModalOpen(false);
    navigate(`/editor?projectName=${encodeURIComponent(normalizedName)}&bpm=${encodeURIComponent(normalizedBpm)}`);
  };

  return (
    <Routes>
      <Route
        path="/"
        element={(
          <>
            <LandingView
              onStartProject={handleOpenModal}
              onOpenProjectManager={() => navigate('/projects')}
            />
            <NewProjectModal
              isOpen={isModalOpen}
              selectedTemplate={selectedTemplate}
              projectName={projectName}
              projectBpm={projectBpm}
              onClose={() => setIsModalOpen(false)}
              onStart={handleStart}
              onSelectTemplate={setSelectedTemplate}
              onProjectNameChange={setProjectName}
              onProjectBpmChange={setProjectBpm}
            />
          </>
        )}
      />
      <Route path="/projects" element={<ProjectManagerView />} />
      <Route path="/editor" element={<MainEditor />} />
    </Routes>
  );
}
