import { useEffect, useState } from 'react';
import { Route, Routes, useNavigate } from 'react-router-dom';
import { MainEditor } from './features/editor/MainEditor';
import { LandingView } from './features/landing/LandingView';
import { ProjectManagerView } from './features/project/ProjectManagerView';
import { NewProjectModal } from './features/project/NewProjectModal';
import { clearLegacyLocalProjects, getAllBackendProjects } from './features/editor/fileUtils';
import { AuthCallbackView } from './features/auth/AuthCallbackView';
import { clearStoredAuth, getStoredAuth, startGoogleLogin } from './features/auth/authUtils';

const generateUniqueName = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  return `SESSION_${year}${month}${day}_${hours}${minutes}${seconds}`;
};

export default function App() {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectBpm, setProjectBpm] = useState('128');
  const [authSession, setAuthSession] = useState(() => getStoredAuth());
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    clearLegacyLocalProjects();

    const syncAuthSession = () => {
      setAuthSession(getStoredAuth());
    };

    window.addEventListener('bach-studio-auth-change', syncAuthSession);
    window.addEventListener('storage', syncAuthSession);

    return () => {
      window.removeEventListener('bach-studio-auth-change', syncAuthSession);
      window.removeEventListener('storage', syncAuthSession);
    };
  }, []);

  const handleOpenModal = () => {
    if (!authSession) {
      void handleGoogleLogin();
      return;
    }

    setProjectName(generateUniqueName());
    setIsModalOpen(true);
  };

  const handleStart = async () => {
    if (!authSession) {
      await handleGoogleLogin();
      return;
    }

    const normalizedName = projectName.trim() || generateUniqueName();

    const existingProjects = await getAllBackendProjects();
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

  const handleGoogleLogin = async () => {
    setIsSigningIn(true);
    try {
      await startGoogleLogin(`${window.location.pathname}${window.location.search}`);
    } catch (error) {
      setIsSigningIn(false);
      alert(error instanceof Error ? error.message : 'Google login failed');
    }
  };

  const handleLogout = () => {
    clearStoredAuth();
    clearLegacyLocalProjects();
    setAuthSession(null);
    setIsModalOpen(false);
    navigate('/');
  };

  return (
    <Routes>
      <Route
        path="/"
        element={(
          <>
            <LandingView
              onStartProject={handleOpenModal}
              onOpenProjectManager={() => {
                if (authSession) {
                  navigate('/projects');
                  return;
                }
                void handleGoogleLogin();
              }}
              authUser={authSession?.user ?? null}
              isSigningIn={isSigningIn}
              onGoogleLogin={handleGoogleLogin}
              onLogout={handleLogout}
            />
            <NewProjectModal
              isOpen={isModalOpen}
              projectName={projectName}
              projectBpm={projectBpm}
              onClose={() => setIsModalOpen(false)}
              onStart={handleStart}
              onProjectNameChange={setProjectName}
              onProjectBpmChange={setProjectBpm}
            />
          </>
        )}
      />
      <Route path="/auth/callback" element={<AuthCallbackView />} />
      <Route path="/projects" element={authSession ? <ProjectManagerView /> : <LandingRedirect onLogin={handleGoogleLogin} />} />
      <Route path="/editor" element={authSession ? <MainEditor /> : <LandingRedirect onLogin={handleGoogleLogin} />} />
    </Routes>
  );
}

function LandingRedirect({ onLogin }: { onLogin: () => Promise<void> }) {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/', { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-[#f4ffc6] flex items-center justify-center">
      <button
        onClick={() => {
          void onLogin();
        }}
        className="ghost-border px-6 py-3 text-xs font-black uppercase tracking-widest"
      >
        Google Login Required
      </button>
    </div>
  );
}
