import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../services/apiClient.js';
import { useDocumentMeta } from '../lib/useDocumentMeta.js';
import { EmptyState, ErrorState, LoadingState } from '../features/recipes/RecipeStates.jsx';
import { useAuth } from '../features/auth/AuthContext.jsx';

const CONTENT_TABS = [
  { value: 'recipes', label: 'Công thức' },
  { value: 'comments', label: 'Bình luận' },
  { value: 'cooksnaps', label: 'Cooksnap' },
];

function formatDate(value) {
  return value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—';
}

function isHiddenContent(type, item) {
  if (type === 'recipes') return Boolean(item.hiddenAt || item.deletedAt);
  return item.status !== 'ACTIVE' || Boolean(item.deletedAt);
}

function contentTitle(type, item) {
  if (type === 'recipes') return item.title;
  if (type === 'comments') return item.content;
  return item.caption || 'Ảnh cooksnap';
}

export function AdminPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('accounts');

  useDocumentMeta({ title: 'Quản trị hệ thống | Bếp Nhà', description: 'Quản lý tài khoản, nội dung và audit log.', noindex: true });

  if (user?.role !== 'ADMIN') {
    return (
      <section className="admin-page">
        <h1>Quản trị hệ thống</h1>
        <p>Bạn cần quyền quản trị viên để truy cập trang này.</p>
        <Link className="primary-button button-link" to="/">Về trang chủ</Link>
      </section>
    );
  }

  return (
    <section className="admin-page">
      <p className="eyebrow">Administration</p>
      <h1>Quản trị hệ thống</h1>
      <AdminStats />
      <div className="tab-list" role="tablist" aria-label="Khu vực quản trị">
        <button className={tab === 'accounts' ? 'tab-button active' : 'tab-button'} type="button" role="tab" aria-selected={tab === 'accounts'} onClick={() => setTab('accounts')}>Tài khoản</button>
        <button className={tab === 'content' ? 'tab-button active' : 'tab-button'} type="button" role="tab" aria-selected={tab === 'content'} onClick={() => setTab('content')}>Nội dung</button>
        <button className={tab === 'audit' ? 'tab-button active' : 'tab-button'} type="button" role="tab" aria-selected={tab === 'audit'} onClick={() => setTab('audit')}>Audit log</button>
      </div>
      {tab === 'accounts' && <UserManager />}
      {tab === 'content' && <ContentManager />}
      {tab === 'audit' && <AuditLogManager />}
    </section>
  );
}

function AdminStats() {
  const { accessToken } = useAuth();
  const [state, setState] = useState({ status: 'loading', stats: null, error: null });

  const load = useCallback(async () => {
    setState({ status: 'loading', stats: null, error: null });
    try {
      setState({ status: 'success', stats: await adminApi.contentStats(accessToken), error: null });
    } catch (error) {
      setState({ status: 'error', stats: null, error });
    }
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  if (state.status === 'loading') return <LoadingState label="Đang tải số liệu..." />;
  if (state.status === 'error') return <ErrorState error={state.error} onRetry={load} />;

  return (
    <div className="account-summary admin-summary">
      <div><span className="summary-label">Công thức</span><strong>{state.stats.recipes}</strong></div>
      <div><span className="summary-label">Bình luận</span><strong>{state.stats.comments}</strong></div>
      <div><span className="summary-label">Cooksnap</span><strong>{state.stats.cooksnaps}</strong></div>
      <div><span className="summary-label">Báo cáo mở</span><strong>{state.stats.openReports}</strong></div>
    </div>
  );
}

function UserManager() {
  const { accessToken } = useAuth();
  const [state, setState] = useState({ status: 'loading', users: [], error: null });
  const [workingId, setWorkingId] = useState(null);
  const [message, setMessage] = useState(null);

  const load = useCallback(async () => {
    setState((current) => ({ ...current, status: 'loading', error: null }));
    try {
      const users = await adminApi.users(accessToken);
      setState({ status: 'success', users, error: null });
    } catch (error) {
      setState({ status: 'error', users: [], error });
    }
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  const update = async (id, input) => {
    setWorkingId(id); setMessage(null);
    try {
      const result = await adminApi.updateUser(id, input, accessToken);
      setState((current) => ({ ...current, users: current.users.map((user) => user.id === id ? result.user : user) }));
      setMessage({ type: 'success', text: 'Đã cập nhật tài khoản.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally { setWorkingId(null); }
  };

  const warn = async (id) => {
    const messageText = window.prompt('Nội dung cảnh báo');
    if (!messageText) return;
    setWorkingId(id); setMessage(null);
    try {
      await adminApi.warnUser(id, messageText, accessToken);
      setMessage({ type: 'success', text: 'Đã gửi cảnh báo cho người dùng.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally { setWorkingId(null); }
  };

  if (state.status === 'loading') return <LoadingState label="Đang tải danh sách tài khoản..." />;
  if (state.status === 'error') return <ErrorState error={state.error} onRetry={load} />;

  return (
    <div className="admin-panel">
      {message && <p className={message.type === 'error' ? 'form-error' : 'form-success'} role="status">{message.text}</p>}
      <div className="admin-toolbar"><p className="field-hint">Quản lý vai trò, trạng thái và gửi cảnh báo.</p><button className="secondary-button" type="button" onClick={load}>Làm mới</button></div>
      {state.users.length ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Người dùng</th><th>Vai trò</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
            <tbody>
              {state.users.map((user) => (
                <tr key={user.id}>
                  <td><strong>{user.profile?.displayName || user.username}</strong><small>@{user.username}<br />{user.email}</small></td>
                  <td><select aria-label={`Vai trò của ${user.username}`} value={user.role} disabled={workingId === user.id} onChange={(event) => update(user.id, { role: event.target.value })}><option>USER</option><option>EDITOR</option><option>MODERATOR</option><option>ADMIN</option></select></td>
                  <td>
                    <select aria-label={`Trạng thái của ${user.username}`} value={user.status} disabled={workingId === user.id} onChange={(event) => update(user.id, { status: event.target.value })}><option>ACTIVE</option><option>PENDING</option><option>SUSPENDED</option><option>DELETED</option></select>
                    {user.status === 'SUSPENDED' && <small>{user.suspendedUntil ? `Khóa đến ${formatDate(user.suspendedUntil)}` : 'Khóa không thời hạn'}</small>}
                  </td>
                  <td><button className="text-button" type="button" disabled={workingId === user.id} onClick={() => warn(user.id)}>Cảnh báo</button><small>{user.lastLoginAt ? `Đăng nhập ${formatDate(user.lastLoginAt)}` : 'Chưa đăng nhập'}</small></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <EmptyState title="Chưa có tài khoản" />}
    </div>
  );
}

function ContentManager() {
  const { accessToken } = useAuth();
  const [type, setType] = useState('recipes');
  const [filters, setFilters] = useState({ state: 'all', q: '' });
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ status: 'loading', items: [], meta: null, error: null });
  const [selected, setSelected] = useState([]);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState(null);

  const load = useCallback(async () => {
    setState((current) => ({ ...current, status: 'loading', error: null }));
    try {
      const result = await adminApi.content({ type, page, limit: 20, ...filters }, accessToken);
      setState({ status: 'success', items: result.data, meta: result.meta, error: null });
      setSelected([]);
    } catch (error) {
      setState({ status: 'error', items: [], meta: null, error });
    }
  }, [accessToken, filters, page, type]);

  useEffect(() => { load(); }, [load]);

  const allSelected = state.items.length > 0 && selected.length === state.items.length;

  const toggleAll = () => setSelected(allSelected ? [] : state.items.map((item) => item.id));
  const toggleOne = (id) => setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);

  const act = async (action, ids = selected) => {
    if (!ids.length) return;
    if (action === 'DELETE' && !window.confirm(`Xóa mềm ${ids.length} nội dung đã chọn?`)) return;
    const note = ['HIDE', 'DELETE'].includes(action) ? (window.prompt('Ghi chú xử lý (tùy chọn)') || null) : null;
    setWorking(true); setMessage(null);
    try {
      if (ids.length === 1) {
        await adminApi.contentAction(type, ids[0], { action, note }, accessToken);
      } else {
        await adminApi.bulkContentAction({ type, ids, action, note }, accessToken);
      }
      setMessage({ type: 'success', text: `Đã xử lý ${ids.length} nội dung.` });
      await load();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally { setWorking(false); }
  };

  const feature = async (item) => {
    setWorking(true); setMessage(null);
    try {
      await adminApi.featureRecipe(item.id, !item.featuredAt, accessToken);
      setMessage({ type: 'success', text: item.featuredAt ? 'Đã bỏ nổi bật công thức.' : 'Đã gắn nổi bật công thức.' });
      await load();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally { setWorking(false); }
  };

  const changeType = (nextType) => { setType(nextType); setPage(1); setFilters({ state: 'all', q: '' }); setQuery(''); };

  return (
    <div className="admin-panel">
      <div className="admin-toolbar admin-content-toolbar">
        <div className="admin-segmented" role="group" aria-label="Loại nội dung">
          {CONTENT_TABS.map((item) => <button className={type === item.value ? 'active' : ''} key={item.value} type="button" onClick={() => changeType(item.value)}>{item.label}</button>)}
        </div>
        <form className="admin-filter-form" onSubmit={(event) => { event.preventDefault(); setPage(1); setFilters((current) => ({ ...current, q: query })); }}>
          <label>Tìm kiếm<input value={query} maxLength="120" onChange={(event) => setQuery(event.target.value)} placeholder="Tiêu đề, nội dung..." /></label>
          <label>Trạng thái<select value={filters.state} onChange={(event) => { setPage(1); setFilters((current) => ({ ...current, state: event.target.value })); }}><option value="all">Tất cả</option><option value="visible">Đang hiển thị</option><option value="hidden">Đã ẩn/xóa</option></select></label>
          <button className="secondary-button" type="submit">Lọc</button>
        </form>
      </div>
      {message && <p className={message.type === 'error' ? 'form-error' : 'form-success'} role="status">{message.text}</p>}
      <div className="admin-bulk-actions">
        <span className="field-hint">Đã chọn {selected.length} nội dung</span>
        <div>
          <button className="secondary-button" type="button" disabled={working || selected.length === 0} onClick={() => act('HIDE')}>Ẩn đã chọn</button>
          <button className="secondary-button" type="button" disabled={working || selected.length === 0} onClick={() => act('RESTORE')}>Khôi phục</button>
          <button className="danger-button" type="button" disabled={working || selected.length === 0} onClick={() => act('DELETE')}>Xóa mềm</button>
        </div>
      </div>
      {state.status === 'loading' && <LoadingState label="Đang tải nội dung..." />}
      {state.status === 'error' && <ErrorState error={state.error} onRetry={load} />}
      {state.status === 'success' && state.items.length === 0 && <EmptyState title="Không có nội dung phù hợp"><p>Thử đổi bộ lọc hoặc từ khóa tìm kiếm.</p></EmptyState>}
      {state.status === 'success' && state.items.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table admin-content-table">
            <thead><tr><th><input type="checkbox" aria-label="Chọn tất cả nội dung" checked={allSelected} onChange={toggleAll} /></th><th>Nội dung</th><th>Tác giả</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
            <tbody>
              {state.items.map((item) => {
                const hidden = isHiddenContent(type, item);
                const deleted = Boolean(item.deletedAt);
                return (
                  <tr key={item.id}>
                    <td><input type="checkbox" aria-label={`Chọn ${contentTitle(type, item)}`} checked={selected.includes(item.id)} onChange={() => toggleOne(item.id)} /></td>
                    <td>
                      {type === 'recipes' ? <Link to={`/cong-thuc/${item.slug}`}><strong>{item.title}</strong></Link> : <strong>{contentTitle(type, item)}</strong>}
                      {type !== 'recipes' && item.recipe && <small><Link to={`/cong-thuc/${item.recipe.slug}`}>{item.recipe.title}</Link></small>}
                      <small>{type === 'recipes' ? `${item.status} · ${item.visibility}` : `Tạo ${formatDate(item.createdAt)}`}{deleted ? ' · đã xóa mềm' : ''}</small>
                    </td>
                    <td><Link to={`/nguoi-dung/${item.author?.username}`}>@{item.author?.username}</Link><small>{item.author?.profile?.displayName || '—'}</small></td>
                    <td>
                      <span className={`status-badge status-${hidden ? 'rejected' : 'published'}`}>{hidden ? (deleted ? 'Đã xóa' : 'Đã ẩn') : 'Hiển thị'}</span>
                      {type === 'recipes' && item.featuredAt && <small>Nổi bật</small>}
                    </td>
                    <td>
                      <div className="admin-row-actions">
                        {hidden && <button className="text-button" type="button" disabled={working} onClick={() => act('RESTORE', [item.id])}>Khôi phục</button>}
                        {!hidden && <button className="text-button" type="button" disabled={working} onClick={() => act('HIDE', [item.id])}>Ẩn</button>}
                        {type === 'recipes' && !deleted && <button className="text-button" type="button" disabled={working} onClick={() => feature(item)}>{item.featuredAt ? 'Bỏ nổi bật' : 'Nổi bật'}</button>}
                        {!deleted && <button className="text-button danger-text" type="button" disabled={working} onClick={() => act('DELETE', [item.id])}>Xóa</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {state.meta && state.meta.totalPages > 1 && (
        <div className="pagination">
          <button className="secondary-button" type="button" disabled={page <= 1 || working} onClick={() => setPage((current) => current - 1)}>Trang trước</button>
          <span>Trang {state.meta.page}/{state.meta.totalPages} · {state.meta.total} nội dung</span>
          <button className="secondary-button" type="button" disabled={page >= state.meta.totalPages || working} onClick={() => setPage((current) => current + 1)}>Trang sau</button>
        </div>
      )}
    </div>
  );
}

function AuditLogManager() {
  const { accessToken } = useAuth();
  const [state, setState] = useState({ status: 'loading', logs: [], error: null });

  const load = useCallback(async () => {
    setState((current) => ({ ...current, status: 'loading', error: null }));
    try {
      setState({ status: 'success', logs: await adminApi.auditLogs(accessToken), error: null });
    } catch (error) {
      setState({ status: 'error', logs: [], error });
    }
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => state.logs.slice(0, 50), [state.logs]);

  if (state.status === 'loading') return <LoadingState label="Đang tải audit log..." />;
  if (state.status === 'error') return <ErrorState error={state.error} onRetry={load} />;

  return (
    <div className="admin-panel">
      <div className="admin-toolbar"><p className="field-hint">50 sự kiện gần nhất.</p><button className="secondary-button" type="button" onClick={load}>Làm mới</button></div>
      {rows.length ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Thời gian</th><th>Hành động</th><th>Người thực hiện</th><th>Đối tượng</th></tr></thead>
            <tbody>{rows.map((log) => <tr key={log.id}><td>{formatDate(log.createdAt)}</td><td><strong>{log.action}</strong></td><td>@{log.actor.username}<small>{log.actor.role}</small></td><td>{log.targetType}<small>{log.targetId}</small></td></tr>)}</tbody>
          </table>
        </div>
      ) : <EmptyState title="Chưa có audit event" />}
    </div>
  );
}
