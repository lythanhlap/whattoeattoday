import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { RecipeCard } from '../features/recipes/RecipeCard.jsx';
import { EmptyState, ErrorState, LoadingState, NotFoundState } from '../features/recipes/RecipeStates.jsx';
import { challengeApi, recipeApi, uploadImageToCloudinary } from '../services/apiClient.js';
import { useDocumentMeta } from '../lib/useDocumentMeta.js';
import { optimizedImageUrl } from '../utils/image.js';

const STATUS_LABELS = {
  DRAFT: 'Bản nháp',
  UPCOMING: 'Sắp diễn ra',
  ACTIVE: 'Đang diễn ra',
  ENDED: 'Đã kết thúc',
  ARCHIVED: 'Đã lưu trữ',
};

const EDITABLE_STATUSES = [
  { value: 'DRAFT', label: 'Bản nháp' },
  { value: 'UPCOMING', label: 'Sắp diễn ra' },
  { value: 'ACTIVE', label: 'Đang diễn ra' },
  { value: 'ENDED', label: 'Đã kết thúc' },
];

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value));
}

function toLocalInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function toIso(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function ChallengeDetailPage() {
  const { id } = useParams();
  const { user, accessToken } = useAuth();
  const [state, setState] = useState({ status: 'loading', challenge: null, error: null });
  const [recipes, setRecipes] = useState([]);
  const [recipeId, setRecipeId] = useState('');
  const [submitState, setSubmitState] = useState({ status: 'idle', error: null, message: null });
  const [removingId, setRemovingId] = useState(null);
  const [archiving, setArchiving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [editState, setEditState] = useState({ state: 'idle', error: null, message: null });
  const [bannerFile, setBannerFile] = useState(null);

  const load = useCallback(async () => {
    setState((current) => ({ ...current, status: 'loading', error: null }));
    try {
      const result = await challengeApi.get(id, accessToken);
      setState({ status: 'success', challenge: result.challenge, error: null });
    } catch (error) {
      setState({ status: error.code === 'CHALLENGE_NOT_FOUND' ? 'not-found' : 'error', challenge: null, error });
    }
  }, [accessToken, id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!accessToken) { setRecipes([]); return; }
    recipeApi.list({ mine: true, status: 'PUBLISHED', visibility: 'PUBLIC', limit: 50, accessToken })
      .then((result) => setRecipes(result.data))
      .catch(() => setRecipes([]));
  }, [accessToken]);

  const challenge = state.challenge;
  useDocumentMeta({
    title: challenge ? `${challenge.title} | Bếp Nhà` : 'Thử thách nấu ăn | Bếp Nhà',
    description: challenge?.description || 'Tham gia thử thách nấu ăn cùng cộng đồng Bếp Nhà.',
    url: window.location.href,
    image: challenge?.bannerUrl,
    noindex: state.status !== 'success' || ['DRAFT', 'ARCHIVED'].includes(challenge?.status),
  });

  if (state.status === 'loading') return <LoadingState label="Đang tải thử thách..." />;
  if (state.status === 'not-found') return <NotFoundState />;
  if (state.status === 'error') return <ErrorState error={state.error} onRetry={load} />;

  const isActive = challenge.status === 'ACTIVE';
  const canManage = accessToken && (challenge.createdById === user?.id || user?.role === 'ADMIN');

  const startEditing = () => {
    setEditForm({
      title: challenge.title,
      description: challenge.description || '',
      bannerUrl: challenge.bannerUrl || '',
      startsAt: toLocalInput(challenge.startsAt),
      endsAt: toLocalInput(challenge.endsAt),
      status: challenge.status === 'ARCHIVED' ? 'DRAFT' : challenge.status,
    });
    setEditState({ state: 'idle', error: null, message: null });
    setBannerFile(null);
    setEditing(true);
  };

  const saveEdit = async (event) => {
    event.preventDefault();
    setEditState({ state: 'submitting', error: null, message: null });
    try {
      let bannerUrl = editForm.bannerUrl;
      if (bannerFile) {
        const uploaded = await uploadImageToCloudinary(bannerFile, accessToken, 'challenge');
        bannerUrl = uploaded.secure_url;
      }
      await challengeApi.update(challenge.id, {
        ...editForm,
        bannerUrl: bannerUrl || null,
        startsAt: toIso(editForm.startsAt),
        endsAt: toIso(editForm.endsAt),
      }, accessToken);
      setBannerFile(null);
      setEditing(false);
      await load();
    } catch (error) {
      setEditState({ state: 'error', error, message: null });
    }
  };

  const submitEntry = async (event) => {
    event.preventDefault();
    if (!recipeId) { setSubmitState({ status: 'error', error: new Error('Hãy chọn một công thức đã xuất bản.'), message: null }); return; }
    setSubmitState({ status: 'submitting', error: null, message: null });
    try {
      await challengeApi.submitEntry(challenge.id, recipeId, accessToken);
      setSubmitState({ status: 'success', error: null, message: 'Đã gửi công thức tham gia thử thách.' });
      setRecipeId('');
      await load();
    } catch (error) {
      setSubmitState({ status: 'error', error, message: null });
    }
  };

  const canRemoveEntry = (entry) => Boolean(accessToken) && (
    entry.submittedById === user?.id
    || ['MODERATOR', 'ADMIN'].includes(user?.role)
    || (user?.role === 'EDITOR' && challenge.createdById === user?.id)
  );

  const removeEntry = async (entry) => {
    if (!window.confirm('Gỡ công thức khỏi thử thách này?')) return;
    setRemovingId(entry.id);
    try {
      await challengeApi.removeEntry(challenge.id, entry.id, accessToken);
      await load();
    } catch (error) {
      setSubmitState({ status: 'error', error, message: null });
    } finally {
      setRemovingId(null);
    }
  };

  const archive = async () => {
    if (!window.confirm('Lưu trữ thử thách? Thử thách sẽ không còn hiển thị công khai.')) return;
    setArchiving(true);
    try {
      await challengeApi.archive(challenge.id, accessToken);
      await load();
    } catch (error) {
      setSubmitState({ status: 'error', error, message: null });
    } finally {
      setArchiving(false);
    }
  };

  return (
    <article className="challenge-detail">
      <Link className="back-link" to="/thu-thach">← Tất cả thử thách</Link>
      {challenge.bannerUrl && <img className="challenge-banner" src={optimizedImageUrl(challenge.bannerUrl, { width: 1200, height: 600 })} alt={`Banner thử thách ${challenge.title}`} width="1200" height="600" />}
      <div className="detail-header">
        <div>
          <span className={`status-badge status-${challenge.status.toLowerCase()}`}>{STATUS_LABELS[challenge.status]}</span>
          <h1>{challenge.title}</h1>
          <p className="lead">{challenge.description || 'Tham gia bằng công thức public của bạn.'}</p>
          <p className="challenge-dates">{formatDate(challenge.startsAt)} – {formatDate(challenge.endsAt)}</p>
          <p className="author-line">Tạo bởi {challenge.createdBy?.profile?.displayName || challenge.createdBy?.username}</p>
        </div>
        {canManage && challenge.status !== 'ARCHIVED' && (
          <div className="detail-actions">
            <button className="secondary-button" type="button" onClick={editing ? () => setEditing(false) : startEditing}>
              {editing ? 'Đóng chỉnh sửa' : 'Chỉnh sửa thử thách'}
            </button>
            <button className="danger-button" type="button" disabled={archiving} onClick={archive}>
              {archiving ? 'Đang lưu trữ...' : 'Lưu trữ thử thách'}
            </button>
          </div>
        )}
      </div>

      {editing && editForm && canManage && (
        <section className="challenge-edit-panel">
          <h2>Chỉnh sửa thử thách</h2>
          {editState.error && <p className="form-error" role="alert">{editState.error.message}</p>}
          <form className="challenge-form" onSubmit={saveEdit}>
            <label>Tiêu đề<input required minLength="5" maxLength="150" value={editForm.title} onChange={(event) => setEditForm({ ...editForm, title: event.target.value })} /></label>
            <label>Mô tả<textarea rows="3" maxLength="2000" value={editForm.description} onChange={(event) => setEditForm({ ...editForm, description: event.target.value })} /></label>
            <label>Ảnh banner<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setBannerFile(event.target.files?.[0] || null)} /><span className="field-hint">Tải ảnh mới để thay banner hiện tại.</span></label>
            <label>Hoặc URL banner<input type="url" value={editForm.bannerUrl} onChange={(event) => setEditForm({ ...editForm, bannerUrl: event.target.value })} /></label>
            <div className="form-grid">
              <label>Bắt đầu<input type="datetime-local" required value={editForm.startsAt} onChange={(event) => setEditForm({ ...editForm, startsAt: event.target.value })} /></label>
              <label>Kết thúc<input type="datetime-local" required value={editForm.endsAt} onChange={(event) => setEditForm({ ...editForm, endsAt: event.target.value })} /></label>
              <label>Trạng thái<select value={editForm.status} onChange={(event) => setEditForm({ ...editForm, status: event.target.value })}>{EDITABLE_STATUSES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            </div>
            <div className="form-actions">
              <button className="primary-button" type="submit" disabled={editState.state === 'submitting'}>
                {editState.state === 'submitting' ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="challenge-entry-form">
        <h2>Gửi công thức tham gia</h2>
        {!accessToken && <p>Hãy <Link to="/dang-nhap">đăng nhập</Link> để gửi công thức.</p>}
        {accessToken && !isActive && <p>Thử thách chỉ nhận công thức khi đang diễn ra.</p>}
        {accessToken && isActive && (recipes.length === 0 ? (
          <p>Bạn chưa có công thức public nào. <Link to="/cong-thuc-moi">Viết công thức mới</Link> trước khi tham gia.</p>
        ) : (
          <form className="challenge-submit" onSubmit={submitEntry}>
            <label>
              Chọn công thức đã xuất bản
              <select value={recipeId} onChange={(event) => setRecipeId(event.target.value)} required>
                <option value="">— Chọn công thức —</option>
                {recipes.map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.title}</option>)}
              </select>
            </label>
            <button className="primary-button" type="submit" disabled={submitState.status === 'submitting'}>
              {submitState.status === 'submitting' ? 'Đang gửi...' : 'Tham gia thử thách'}
            </button>
          </form>
        ))}
        {submitState.error && <p className="form-error" role="alert">{submitState.error.message}</p>}
        {submitState.message && <p className="form-success" role="status">{submitState.message}</p>}
      </section>

      <section className="challenge-entries">
        <h2>Công thức tham gia ({challenge.entryCount})</h2>
        {challenge.entries.length === 0 ? (
          <EmptyState title="Chưa có công thức tham gia">
            <p>Hãy là người đầu tiên tham gia thử thách này.</p>
          </EmptyState>
        ) : (
          <div className="recipe-grid">
            {challenge.entries.map((entry) => (
              <div className="challenge-entry" key={entry.id}>
                <RecipeCard recipe={entry.recipe} />
                <div className="challenge-entry-meta">
                  <small>Gửi bởi {entry.submittedBy?.profile?.displayName || entry.submittedBy?.username}</small>
                  {canRemoveEntry(entry) && (
                    <button className="text-button" type="button" disabled={removingId === entry.id} onClick={() => removeEntry(entry)}>
                      {removingId === entry.id ? 'Đang gỡ...' : 'Gỡ khỏi thử thách'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </article>
  );
}
