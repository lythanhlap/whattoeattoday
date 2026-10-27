import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { challengeApi } from '../services/apiClient.js';
import { EmptyState, ErrorState, LoadingState } from '../features/recipes/RecipeStates.jsx';

const STATUS_LABELS = {
  DRAFT: 'Bản nháp',
  UPCOMING: 'Sắp diễn ra',
  ACTIVE: 'Đang diễn ra',
  ENDED: 'Đã kết thúc',
  ARCHIVED: 'Đã lưu trữ',
};

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(value));
}

export function ChallengesPage() {
  const { user, accessToken } = useAuth();
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ status: 'loading', items: [], meta: null, error: null });
  const [createState, setCreateState] = useState({ status: 'idle', error: null });
  const [formKey, setFormKey] = useState(0);
  const canCreate = ['EDITOR', 'ADMIN'].includes(user?.role);

  const load = useCallback(async () => {
    setState((current) => ({ ...current, status: 'loading', error: null }));
    try {
      const result = await challengeApi.list({ page, status: statusFilter || undefined });
      setState({ status: 'success', items: result.data, meta: result.meta, error: null });
    } catch (error) {
      setState({ status: 'error', items: [], meta: null, error });
    }
  }, [page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const createChallenge = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input = {
      title: String(form.get('title') || '').trim(),
      description: String(form.get('description') || '').trim() || null,
      bannerUrl: String(form.get('bannerUrl') || '').trim() || null,
      startsAt: new Date(form.get('startsAt')).toISOString(),
      endsAt: new Date(form.get('endsAt')).toISOString(),
      status: form.get('status'),
    };
    setCreateState({ status: 'submitting', error: null });
    try {
      await challengeApi.create(input, accessToken);
      setCreateState({ status: 'success', error: null });
      setFormKey((value) => value + 1);
      setStatusFilter('');
      setPage(1);
      load();
    } catch (error) {
      setCreateState({ status: 'error', error });
    }
  };

  return (
    <section className="challenges-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Thử thách</p>
          <h1>Cùng nấu theo chủ đề</h1>
          <p className="lead">Tham gia thử thách đang diễn ra bằng công thức public của bạn.</p>
        </div>
      </div>

      <form className="challenge-filter" onSubmit={(event) => event.preventDefault()}>
        <label>
          Trạng thái
          <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} aria-label="Lọc thử thách theo trạng thái">
            <option value="">Tất cả</option>
            <option value="ACTIVE">Đang diễn ra</option>
            <option value="UPCOMING">Sắp diễn ra</option>
            <option value="ENDED">Đã kết thúc</option>
          </select>
        </label>
      </form>

      {canCreate && (
        <details className="challenge-create">
          <summary>Tạo thử thách mới</summary>
          <form key={formKey} className="challenge-form" onSubmit={createChallenge}>
            <label>Tiêu đề<input name="title" required minLength="5" maxLength="150" /></label>
            <label>Mô tả<textarea name="description" rows="3" maxLength="2000" /></label>
            <label>Banner URL<input name="bannerUrl" type="url" placeholder="https://..." /></label>
            <div className="form-grid">
              <label>Bắt đầu<input name="startsAt" type="datetime-local" required /></label>
              <label>Kết thúc<input name="endsAt" type="datetime-local" required /></label>
              <label>Trạng thái<select name="status" defaultValue="DRAFT"><option value="DRAFT">Lưu nháp</option><option value="ACTIVE">Công khai ngay</option></select></label>
            </div>
            {createState.error && <p className="form-error" role="alert">{createState.error.message}</p>}
            {createState.status === 'success' && <p className="form-success" role="status">Đã tạo thử thách.</p>}
            <div className="form-actions">
              <button className="primary-button" type="submit" disabled={createState.status === 'submitting'}>
                {createState.status === 'submitting' ? 'Đang tạo...' : 'Tạo thử thách'}
              </button>
            </div>
          </form>
        </details>
      )}

      {state.status === 'loading' && <LoadingState label="Đang tải thử thách..." />}
      {state.status === 'error' && <ErrorState error={state.error} onRetry={load} />}
      {state.status === 'success' && (state.items.length === 0 ? (
        <EmptyState title="Chưa có thử thách">
          <p>Hãy quay lại khi cộng đồng mở thử thách mới.</p>
        </EmptyState>
      ) : (
        <>
          <div className="challenge-grid">
            {state.items.map((challenge) => (
              <article className="challenge-card" key={challenge.id}>
                {challenge.bannerUrl && <img src={challenge.bannerUrl} alt={`Banner thử thách ${challenge.title}`} loading="lazy" />}
                <div className="challenge-card-body">
                  <span className={`status-badge status-${challenge.status.toLowerCase()}`}>{STATUS_LABELS[challenge.status]}</span>
                  <h2><Link to={`/thu-thach/${challenge.id}`}>{challenge.title}</Link></h2>
                  <p>{challenge.description || 'Tham gia bằng công thức public của bạn.'}</p>
                  <small>{formatDate(challenge.startsAt)} – {formatDate(challenge.endsAt)}</small>
                  <small>{challenge.entryCount} công thức tham gia</small>
                </div>
              </article>
            ))}
          </div>
          {state.meta?.totalPages > 1 && (
            <div className="pagination" aria-label="Phân trang thử thách">
              <button className="secondary-button" type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Trước</button>
              <span>Trang {state.meta.page} / {state.meta.totalPages}</span>
              <button className="secondary-button" type="button" disabled={page >= state.meta.totalPages} onClick={() => setPage((value) => value + 1)}>Sau</button>
            </div>
          )}
        </>
      ))}
    </section>
  );
}
