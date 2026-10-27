import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="route-state">Đang khôi phục phiên đăng nhập...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/dang-nhap" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
