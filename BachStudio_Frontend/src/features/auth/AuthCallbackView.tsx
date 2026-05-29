import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { completeGoogleLogin } from './authUtils';

export function AuthCallbackView() {
  const navigate = useNavigate();
  const [message, setMessage] = useState('Completing Google login...');

  useEffect(() => {
    let isCancelled = false;

    void completeGoogleLogin()
      .then(({ returnTo }) => {
        if (!isCancelled) {
          navigate(returnTo, { replace: true });
        }
      })
      .catch((error) => {
        if (!isCancelled) {
          setMessage(error instanceof Error ? error.message : 'Google login failed');
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-[#f4ffc6] flex items-center justify-center font-mono uppercase tracking-widest">
      <div className="border border-outline-variant/30 bg-surface-container p-8 text-center">
        <div className="text-xs">{message}</div>
      </div>
    </div>
  );
}
