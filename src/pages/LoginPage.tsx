import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AuthModal } from '../components/AuthModal';
import { useLayout } from '../hooks/useLayout';
import { authService } from '../services/authService';

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useLayout();
  const [showModal, setShowModal] = useState(true);

  const redirectBack = searchParams.get('redirect_back');

  useEffect(() => {
    if (isAuthenticated && redirectBack) {
      performRedirect(redirectBack);
    }
  }, [isAuthenticated, redirectBack]);

  function performRedirect(url: string) {
    const token = authService.getToken();
    const isExternal = url.startsWith('http');

    if (isExternal) {
      const target = new URL(url);
      if (token) target.searchParams.set('token', token);
      window.location.href = target.toString();
    } else {
      navigate(url, { replace: true });
    }
  }

  const handleSuccess = () => {
    if (redirectBack) {
      performRedirect(redirectBack);
    } else {
      navigate('/', { replace: true });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <AuthModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          if (!redirectBack) navigate('/', { replace: true });
        }}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
