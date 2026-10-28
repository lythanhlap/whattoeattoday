import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import { LoadingState } from '../recipes/RecipeStates.jsx';

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingState label="Đang khôi phục phiên đăng nhập..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/dang-nhap" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
