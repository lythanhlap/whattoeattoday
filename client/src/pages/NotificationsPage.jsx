import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { notificationApi } from '../services/apiClient.js';
import { EmptyState, ErrorState, SkeletonGrid } from '../features/recipes/RecipeStates.jsx';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { Icon } from '../components/Icon.jsx';

const TYPE_ICONS = {
  COMMENT_REPLY: 'reply',
  RECIPE_COMMENT: 'utc',
  RECIPE_COOKSNAP: 'image',
  NEW_FOLLOWER: 'users',
  RECIPE_APPROVED: 'check',
  RECIPE_REJECTED: 'alert',
  RECIPE_CHANGES_REQUESTED: 'pen',
  MODERATION_WARNING: 'alert',
  ACCOUNT_SUSPENDED: 'lock',
  CHALLENGE_ENTRY_CREATED: 'trophy',
};

function relativeTime(value) {
  const seconds = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  const units = [['năm', 31_536_000], ['tháng', 2_592_000], ['tuần', 604_800], ['ngày', 86_400], ['giờ', 3_600], ['phút', 60]];
  for (const [label, size] of units) {
    if (seconds >= size) return `${Math.floor(seconds / size)} ${label} trước`;
  }
  return 'vừa xong';
}

function NotificationBody({ item }) {
  return (
    <>
      <strong>{item.title}</strong>
      <span>{item.message}</span>
      <small>{relativeTime(item.createdAt)}</small>
    </>
  );
}

export function NotificationsPage() {
  const { accessToken } = useAuth();
  const [state, setState] = useState({ status: 'loading', items: [], meta: null, error: null });

  const load = useCallback(async () => {
    try {
      setState((current) => ({ ...current, status: 'loading' }));
      const result = await notificationApi.list(accessToken);
      setState({ status: 'success', items: result.data, meta: result.meta, error: null });
    } catch (error) {
      setState({ status: 'error', items: [], meta: null, error });
    }
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  const markRead = async (id) => {
    try {
      await notificationApi.markRead(id, accessToken);
      setState((current) => ({ ...current, items: current.items.map((item) => item.id === id ? { ...item, readAt: new Date().toISOString() } : item), meta: { ...current.meta, unread: Math.max((current.meta?.unread || 1) - 1, 0) } }));
    } catch {
      // Keep the notification unread when the request fails so the action can be retried.
    }
  };

  const markAllRead = async () => {
    try {
      await notificationApi.markAllRead(accessToken);
      setState((current) => ({ ...current, items: current.items.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })), meta: { ...current.meta, unread: 0 } }));
    } catch (error) {
      setState((current) => ({ ...current, error }));
    }
  };

  if (state.status === 'loading') return <SkeletonGrid count={4} className="feed-list" />;
  if (state.status === 'error') return <ErrorState error={state.error} onRetry={load} />;

  const unread = state.meta?.unread || 0;

  return (
    <section className="notifications-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Cập nhật</p>
          <h1>Thông báo</h1>
          <p className="lead">{unread ? `Bạn có ${unread} thông báo chưa đọc.` : 'Bạn đã đọc hết thông báo.'}</p>
        </div>
        <button className="secondary-button" type="button" disabled={!unread} onClick={markAllRead}>
          <Icon name="check" size={16} />Đánh dấu đã đọc
        </button>
      </div>

      {state.items.length ? (
        <ul className="notification-list">
          {state.items.map((item) => {
            const body = <NotificationBody item={item} />;
            return (
              <li className={item.readAt ? 'notification-item' : 'notification-item is-unread'} key={item.id}>
                <span className="notification-icon" aria-hidden="true">
                  <Icon name={TYPE_ICONS[item.type] || 'bell'} size={19} />
                </span>
                {item.actionUrl ? (
                  <Link to={item.actionUrl} onClick={() => item.readAt || markRead(item.id)}>{body}</Link>
                ) : (
                  <button type="button" onClick={() => item.readAt || markRead(item.id)}>{body}</button>
                )}
                {!item.readAt && <span className="unread-dot" aria-label="Chưa đọc" />}
              </li>
            );
          })}
        </ul>
      ) : <EmptyState title="Chưa có thông báo" icon="bell"><p>Hoạt động của cộng đồng sẽ xuất hiện ở đây.</p></EmptyState>}
      {state.error && <p className="form-error" role="alert">{state.error.message}</p>}
    </section>
  );
}
