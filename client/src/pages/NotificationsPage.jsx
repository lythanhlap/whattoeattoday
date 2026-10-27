import { useCallback, useEffect, useState } from 'react';
import { notificationApi } from '../services/apiClient.js';
import { EmptyState, ErrorState, LoadingState } from '../features/recipes/RecipeStates.jsx';
import { useAuth } from '../features/auth/AuthContext.jsx';

export function NotificationsPage() {
  const { accessToken } = useAuth(); const [state, setState] = useState({ status: 'loading', items: [], meta: null, error: null });
  const load = useCallback(async () => { try { setState((current) => ({ ...current, status: 'loading' })); const result = await notificationApi.list(accessToken); setState({ status: 'success', items: result.data, meta: result.meta, error: null }); } catch (error) { setState({ status: 'error', items: [], meta: null, error }); } }, [accessToken]);
  useEffect(() => { load(); }, [load]);
  const markRead = async (id) => { await notificationApi.markRead(id, accessToken); setState((current) => ({ ...current, items: current.items.map((item) => item.id === id ? { ...item, readAt: new Date().toISOString() } : item), meta: { ...current.meta, unread: Math.max((current.meta?.unread || 1) - 1, 0) } })); };
  const markAllRead = async () => { await notificationApi.markAllRead(accessToken); setState((current) => ({ ...current, items: current.items.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })), meta: { ...current.meta, unread: 0 } })); };
  if (state.status === 'loading') return <LoadingState label="Đang tải thông báo..." />;
  if (state.status === 'error') return <ErrorState error={state.error} onRetry={load} />;
  return <section className="notifications-page"><div className="page-heading"><div><p className="eyebrow">Cập nhật</p><h1>Thông báo</h1><p className="lead">{state.meta?.unread || 0} thông báo chưa đọc.</p></div><button className="secondary-button" type="button" disabled={!state.meta?.unread} onClick={markAllRead}>Đánh dấu đã đọc</button></div>{state.items.length ? <ul className="notification-list">{state.items.map((item) => <li className={item.readAt ? 'notification-item' : 'notification-item is-unread'} key={item.id}><button type="button" onClick={() => item.readAt || markRead(item.id)}><strong>{item.title}</strong><span>{item.message}</span><small>{new Date(item.createdAt).toLocaleString()}</small></button></li>)}</ul> : <EmptyState title="Chưa có thông báo" />}</section>;
}
