import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext.jsx';

export function AppLayout() {
  const { user, isAuthenticated, isLoading } = useAuth();

  return (
    <div className="app-shell">
      <header className="site-header">
        <Link className="brand" to="/">Bep Nha</Link>
        <nav aria-label="Main navigation">
           <Link to="/cong-thuc">Khám phá</Link>
           <Link to="/thu-thach">Thử thách</Link>
           {!isLoading && isAuthenticated && <Link to="/cong-thuc-moi">Viết công thức</Link>}
           {!isLoading && isAuthenticated && <Link to="/feed">Feed</Link>}
           {!isLoading && isAuthenticated && <Link to="/thong-bao">Thông báo</Link>}
           {!isLoading && isAuthenticated && ['EDITOR', 'ADMIN'].includes(user?.role) && <Link to="/bien-tap">Biên tập</Link>}
           {!isLoading && isAuthenticated && ['MODERATOR', 'ADMIN'].includes(user?.role) && <Link to="/moderation">Moderation</Link>}
           {!isLoading && isAuthenticated && user?.role === 'ADMIN' && <Link to="/admin">Admin</Link>}
          {!isLoading && !isAuthenticated && <Link to="/dang-nhap">Đăng nhập</Link>}
          {!isLoading && !isAuthenticated && <Link className="nav-cta" to="/dang-ky">Tham gia</Link>}
          {!isLoading && isAuthenticated && <Link to="/tai-khoan">{user?.profile?.displayName || user?.username}</Link>}
        </nav>
      </header>
      <main className="site-main">
        <Outlet />
      </main>
      <footer className="site-footer">Cong dong cong thuc nau an</footer>
    </div>
  );
}
