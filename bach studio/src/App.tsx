import { useState } from 'react';
import { Route, Routes, useNavigate } from 'react-router-dom';
import { MainEditor } from './features/editor/MainEditor';
import { LandingView } from './features/landing/LandingView';
import { NewProjectModal } from './features/project/NewProjectModal';

export default function App() {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('Vocal Mask');
  const [projectName, setProjectName] = useState('SESSION_2023_X4');
  const [projectBpm, setProjectBpm] = useState('128');

  const handleStart = () => {
    const normalizedName = projectName.trim() || 'SESSION_2023_X4';
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
            <LandingView onStartProject={() => setIsModalOpen(true)} />
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
      <Route path="/editor" element={<MainEditor />} />
    </Routes>
  );
}
