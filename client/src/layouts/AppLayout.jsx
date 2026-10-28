import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { notificationApi } from '../services/apiClient.js';
import { Icon } from '../components/Icon.jsx';

const PRIMARY_LINKS = [
  { to: '/cong-thuc', label: 'Khám phá' },
  { to: '/thu-thach', label: 'Thử thách' },
];

function initials(user) {
  const name = user?.profile?.displayName || user?.username || 'B';
  return name.trim().slice(0, 1).toUpperCase();
}

function navClass({ isActive }) {
  return isActive ? 'nav-link is-active' : 'nav-link';
}

export function AppLayout() {
  const { user, isAuthenticated, isLoading, accessToken, signOut } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const headerRef = useRef(null);

  const role = user?.role;
  const isEditor = ['EDITOR', 'ADMIN'].includes(role);
  const isModerator = ['MODERATOR', 'ADMIN'].includes(role);

  useEffect(() => {
    setMenuOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!menuOpen && !userMenuOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        setUserMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen, userMenuOpen]);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      setUnread(0);
      return undefined;
    }
    let active = true;
    notificationApi
      .list(accessToken)
      .then((result) => { if (active) setUnread(result.meta?.unread || 0); })
      .catch(() => {});
    return () => { active = false; };
  }, [accessToken, isAuthenticated, location.pathname]);

  const handleSignOut = async () => {
    setUserMenuOpen(false);
    await signOut();
  };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Bỏ qua điều hướng</a>

      <header className="site-header" ref={headerRef}>
        <div className="site-header-inner">
          <Link className="brand" to="/" aria-label="Bếp Nhà - trang chủ">
            <span className="brand-mark" aria-hidden="true"><Icon name="chef" size={22} /></span>
            <span className="brand-text">
              <span className="brand-name">Bếp Nhà</span>
              <span className="brand-tagline">công thức nhà làm</span>
            </span>
          </Link>

          <nav className="site-nav" aria-label="Điều hướng chính">
            {PRIMARY_LINKS.map((link) => (
              <NavLink key={link.to} to={link.to} className={navClass}>{link.label}</NavLink>
            ))}
            {!isLoading && isAuthenticated && (
              <NavLink to="/feed" className={navClass}>Feed</NavLink>
            )}
          </nav>

          <div className="header-actions">
            {!isLoading && !isAuthenticated && (
              <>
                <Link className="text-link header-signin" to="/dang-nhap">Đăng nhập</Link>
                <Link className="primary-button header-cta" to="/dang-ky">Tham gia</Link>
              </>
            )}

            {!isLoading && isAuthenticated && (
              <>
                <Link className="primary-button header-cta" to="/cong-thuc-moi">
                  <Icon name="plus" size={17} />
                  Viết công thức
                </Link>

                <Link className="icon-button notification-button" to="/thong-bao" aria-label={unread ? `Thông báo, ${unread} chưa đọc` : 'Thông báo'}>
                  <Icon name="bell" size={21} />
                  {unread > 0 && <span className="notification-badge">{unread > 9 ? '9+' : unread}</span>}
                </Link>

                <div className="user-menu">
                  <button
                    className="user-chip"
                    type="button"
                    aria-expanded={userMenuOpen}
                    aria-haspopup="menu"
                    onClick={() => setUserMenuOpen((open) => !open)}
                  >
                    {user?.profile?.avatarUrl ? (
                      <img className="user-chip-avatar" src={user.profile.avatarUrl} alt="" width="34" height="34" />
                    ) : (
                      <span className="user-chip-avatar user-chip-initial" aria-hidden="true">{initials(user)}</span>
                    )}
                    <span className="user-chip-name">{user?.profile?.displayName || user?.username}</span>
                    <Icon name="chevron-down" size={16} className="user-chip-caret" />
                  </button>

                  {userMenuOpen && (
                    <>
                      <button className="menu-backdrop" type="button" aria-label="Đóng menu" tabIndex={-1} onClick={() => setUserMenuOpen(false)} />
                      <div className="user-menu-panel" role="menu">
                        <div className="user-menu-head">
                          <strong>{user?.profile?.displayName || user?.username}</strong>
                          <span>@{user?.username}</span>
                        </div>
                        <Link role="menuitem" to="/tai-khoan" onClick={() => setUserMenuOpen(false)}><Icon name="user" size={17} />Tài khoản</Link>
                        <Link role="menuitem" to="/cong-thuc?mine=true" onClick={() => setUserMenuOpen(false)}><Icon name="book" size={17} />Công thức của tôi</Link>
                        <Link role="menuitem" to="/thong-bao" onClick={() => setUserMenuOpen(false)}><Icon name="bell" size={17} />Thông báo</Link>
                        {isEditor && <Link role="menuitem" to="/bien-tap" onClick={() => setUserMenuOpen(false)}><Icon name="sparkles" size={17} />Biên tập</Link>}
                        {isModerator && <Link role="menuitem" to="/moderation" onClick={() => setUserMenuOpen(false)}><Icon name="shield" size={17} />Kiểm duyệt</Link>}
                        {role === 'ADMIN' && <Link role="menuitem" to="/admin" onClick={() => setUserMenuOpen(false)}><Icon name="shield" size={17} />Quản trị</Link>}
                        <button role="menuitem" type="button" onClick={handleSignOut}><Icon name="logout" size={17} />Đăng xuất</button>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}

            <button
              className="icon-button menu-toggle"
              type="button"
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <Icon name={menuOpen ? 'close' : 'menu'} size={22} />
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="mobile-nav" id="mobile-nav" aria-label="Điều hướng di động">
            {PRIMARY_LINKS.map((link) => (
              <NavLink key={link.to} to={link.to} className={navClass}>{link.label}</NavLink>
            ))}
            {isAuthenticated && <NavLink to="/feed" className={navClass}>Feed</NavLink>}
            {isAuthenticated && <NavLink to="/thong-bao" className={navClass}>Thông báo</NavLink>}
            {isAuthenticated && <NavLink to="/cong-thuc-moi" className={navClass}>Viết công thức</NavLink>}
            {isAuthenticated && <NavLink to="/tai-khoan" className={navClass}>Tài khoản</NavLink>}
            {isEditor && <NavLink to="/bien-tap" className={navClass}>Biên tập</NavLink>}
            {isModerator && <NavLink to="/moderation" className={navClass}>Kiểm duyệt</NavLink>}
            {role === 'ADMIN' && <NavLink to="/admin" className={navClass}>Quản trị</NavLink>}
            {!isLoading && !isAuthenticated && (
              <div className="mobile-nav-auth">
                <Link className="secondary-button button-link" to="/dang-nhap">Đăng nhập</Link>
                <Link className="primary-button button-link" to="/dang-ky">Tham gia</Link>
              </div>
            )}
            {isAuthenticated && (
              <button className="text-button mobile-signout" type="button" onClick={handleSignOut}>
                <Icon name="logout" size={17} />Đăng xuất
              </button>
            )}
          </nav>
        )}
      </header>

      <main className="site-main" id="main-content">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <Link className="brand" to="/">
              <span className="brand-mark" aria-hidden="true"><Icon name="chef" size={22} /></span>
              <span className="brand-text">
                <span className="brand-name">Bếp Nhà</span>
                <span className="brand-tagline">công thức nhà làm</span>
              </span>
            </Link>
            <p>Cộng đồng chia sẻ công thức nấu ăn Việt Nam: món nhà làm, món chay, eat clean và những bữa cơm ấm cúng.</p>
          </div>
          <div className="footer-column">
            <h2>Khám phá</h2>
            <Link to="/cong-thuc">Tất cả công thức</Link>
            <Link to="/cong-thuc?sort=popular">Được lưu nhiều</Link>
            <Link to="/cong-thuc?hasCooksnap=true">Ảnh đã nấu</Link>
            <Link to="/thu-thach">Thử thách nấu ăn</Link>
          </div>
          <div className="footer-column">
            <h2>Cộng đồng</h2>
            <Link to="/feed">Feed của bạn</Link>
            <Link to="/thong-bao">Thông báo</Link>
            <Link to="/cong-thuc-moi">Chia sẻ công thức</Link>
            <Link to="/tai-khoan">Tài khoản</Link>
          </div>
          <div className="footer-column">
            <h2>Về Bếp Nhà</h2>
            <p className="footer-note">Nội dung do cộng đồng đóng góp. Hãy tôn trọng bản quyền và ghi rõ nguồn ảnh.</p>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Bếp Nhà</span>
          <span>Nấu ăn bằng cả tấm lòng.</span>
        </div>
      </footer>
    </div>
  );
}
