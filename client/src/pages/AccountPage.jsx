import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi, communityApi, recipeApi, uploadImageToCloudinary } from '../services/apiClient.js';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { EmptyState, ErrorState, LoadingState } from '../features/recipes/RecipeStates.jsx';
import { RecipeCard } from '../features/recipes/RecipeCard.jsx';
import { optimizedImageUrl } from '../utils/image.js';

const STATUS_LABELS = {
  DRAFT: 'Bản nháp',
  PENDING_REVIEW: 'Chờ duyệt',
  PUBLISHED: 'Đã xuất bản',
  REJECTED: 'Bị từ chối',
  ARCHIVED: 'Đã lưu trữ',
};

export function AccountPage() {
  const { user, accessToken, signOut, updateUser } = useAuth();
  const [tab, setTab] = useState('profile');
  const [bookmarks, setBookmarks] = useState([]);
  const [collections, setCollections] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [listState, setListState] = useState({ status: 'loading', error: null });
  const [collectionForm, setCollectionForm] = useState({ name: '', description: '', visibility: 'PRIVATE' });
  const [collectionEdit, setCollectionEdit] = useState(null);
  const [collectionCoverState, setCollectionCoverState] = useState({ status: 'idle', error: null });
  const [listError, setListError] = useState(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setListState({ status: 'loading', error: null });
    try {
      const [saved, owned, myRecipes] = await Promise.all([
        communityApi.bookmarks(accessToken),
        communityApi.collections(accessToken),
        recipeApi.list({ mine: true, limit: 50, accessToken }),
      ]);
      setBookmarks(saved);
      setCollections(owned);
      setRecipes(myRecipes.data);
      setListState({ status: 'success', error: null });
    } catch (error) {
      setListState({ status: 'error', error });
    }
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  const createCollection = async (event) => {
    event.preventDefault();
    try {
      await communityApi.createCollection(collectionForm, accessToken);
      setCollectionForm({ name: '', description: '', visibility: 'PRIVATE' });
      load();
    } catch (error) { setListError(error); }
  };

  const toggleCollectionVisibility = async (collection) => {
    try {
      await communityApi.updateCollection(collection.id, {
        name: collection.name,
        description: collection.description,
        visibility: collection.visibility === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC',
      }, accessToken);
      load();
    } catch (error) { setListError(error); }
  };

  const renameCollection = async (collection) => {
    setCollectionEdit({
      id: collection.id,
      name: collection.name,
      description: collection.description || '',
      visibility: collection.visibility,
      coverImageId: collection.coverImageId || '',
      coverPreview: collection.coverImage?.secureUrl || '',
    });
    setCollectionCoverState({ status: 'idle', error: null });
  };

  const uploadCollectionCover = async (file) => {
    if (!file) return;
    if (!accessToken) {
      setCollectionCoverState({ status: 'error', error: new Error('Hãy đăng nhập lại để upload ảnh.') });
      return;
    }
    setCollectionCoverState({ status: 'uploading', error: null });
    try {
      const uploaded = await uploadImageToCloudinary(file, accessToken, 'collection');
      setCollectionEdit((current) => current && ({ ...current, coverImageId: uploaded.mediaAssetId, coverPreview: uploaded.secure_url }));
      setCollectionCoverState({ status: 'success', error: null });
    } catch (error) {
      setCollectionCoverState({ status: 'error', error });
    }
  };

  const saveCollection = async (event) => {
    event.preventDefault();
    if (!collectionEdit) return;
    try {
      await communityApi.updateCollection(collectionEdit.id, {
        name: collectionEdit.name,
        description: collectionEdit.description || null,
        visibility: collectionEdit.visibility,
        coverImageId: collectionEdit.coverImageId || null,
      }, accessToken);
      setCollectionEdit(null);
      setCollectionCoverState({ status: 'idle', error: null });
      load();
    } catch (error) { setListError(error); }
  };

  const removeCollection = async (id) => {
    if (!window.confirm('Xóa bộ sưu tập này? Các công thức đã lưu vẫn được giữ trong tài khoản.')) return;
    try { await communityApi.deleteCollection(id, accessToken); load(); } catch (error) { setListError(error); }
  };

  const removeBookmark = async (recipeId) => {
    try { await communityApi.removeBookmark(recipeId, accessToken); load(); } catch (error) { setListError(error); }
  };

  return (
    <section className="account-page" aria-labelledby="account-title">
      <div className="account-header">
        <div>
          <p className="eyebrow">Tài khoản của bạn</p>
          <h1 id="account-title">Xin chào, {user?.profile?.displayName || user?.username}</h1>
          <p className="lead">Quản lý hồ sơ, mật khẩu, công thức và bộ sưu tập cá nhân.</p>
        </div>
        <button className="secondary-button" type="button" onClick={signOut}>Đăng xuất</button>
      </div>

      <div className="account-summary">
        <div><span className="summary-label">Username</span><strong>@{user?.username}</strong></div>
        <div><span className="summary-label">Email</span><strong>{user?.email}</strong></div>
        <div><span className="summary-label">Trạng thái</span><strong>{user?.status}</strong></div>
      </div>

      <div className="tab-list" role="tablist" aria-label="Quản lý tài khoản">
        <button className={tab === 'profile' ? 'tab-button active' : 'tab-button'} type="button" role="tab" aria-selected={tab === 'profile'} onClick={() => setTab('profile')}>Hồ sơ</button>
        <button className={tab === 'password' ? 'tab-button active' : 'tab-button'} type="button" role="tab" aria-selected={tab === 'password'} onClick={() => setTab('password')}>Mật khẩu</button>
        <button className={tab === 'recipes' ? 'tab-button active' : 'tab-button'} type="button" role="tab" aria-selected={tab === 'recipes'} onClick={() => setTab('recipes')}>Công thức của tôi</button>
        <button className={tab === 'library' ? 'tab-button active' : 'tab-button'} type="button" role="tab" aria-selected={tab === 'library'} onClick={() => setTab('library')}>Kho đã lưu</button>
      </div>

      {tab === 'profile' && <ProfilePanel user={user} accessToken={accessToken} updateUser={updateUser} />}
      {tab === 'password' && <PasswordPanel accessToken={accessToken} />}
      {tab === 'recipes' && <MyRecipesPanel state={listState} recipes={recipes} onRetry={load} />}
      {tab === 'library' && (
        <div className="account-next-step">
          <h2>Công thức đã lưu</h2>
          {listError && <p className="form-error">{listError.message}</p>}
          {listState.status === 'loading' && <LoadingState label="Đang tải kho đã lưu..." />}
          {listState.status === 'error' && <ErrorState error={listState.error} onRetry={load} />}
          {listState.status === 'success' && (
            <>
              {bookmarks.length ? (
                <ul className="saved-list">
                  {bookmarks.map((bookmark) => (
                    <li key={`${bookmark.userId}-${bookmark.recipeId}`}>
                      <Link to={`/cong-thuc/${bookmark.recipe.slug}`}>
                        {bookmark.recipe.status === 'PUBLISHED' && bookmark.recipe.visibility === 'PUBLIC'
                          ? bookmark.recipe.title
                          : `${bookmark.recipe.title} (không khả dụng)`}
                      </Link>
                      <span>
                        {bookmark.collection?.name || 'Chưa phân loại'}{' '}
                        <button className="icon-button" type="button" aria-label={`Bỏ lưu ${bookmark.recipe.title}`} onClick={() => removeBookmark(bookmark.recipeId)}>×</button>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : <p>Chưa có công thức nào được lưu.</p>}

              <h2 className="collection-heading">Bộ sưu tập</h2>
              <form className="collection-form" onSubmit={createCollection}>
                <input required maxLength="120" placeholder="Tên bộ sưu tập mới" aria-label="Tên bộ sưu tập mới" value={collectionForm.name} onChange={(event) => setCollectionForm({ ...collectionForm, name: event.target.value })} />
                <input maxLength="500" placeholder="Mô tả (tùy chọn)" aria-label="Mô tả bộ sưu tập mới" value={collectionForm.description} onChange={(event) => setCollectionForm({ ...collectionForm, description: event.target.value })} />
                <select aria-label="Chế độ hiển thị bộ sưu tập" value={collectionForm.visibility} onChange={(event) => setCollectionForm({ ...collectionForm, visibility: event.target.value })}>
                  <option value="PRIVATE">Riêng tư</option>
                  <option value="PUBLIC">Công khai</option>
                </select>
                <button className="primary-button" type="submit">Tạo</button>
              </form>
              {collections.length ? (
                <ul className="saved-list">
                  {collections.map((collection) => (
                    <li key={collection.id}>
                      {collectionEdit?.id === collection.id ? (
                        <form className="collection-edit-form" onSubmit={saveCollection}>
                          <input required maxLength="120" aria-label="Tên bộ sưu tập" value={collectionEdit.name} onChange={(event) => setCollectionEdit({ ...collectionEdit, name: event.target.value })} />
                          <textarea rows="2" maxLength="500" placeholder="Mô tả (tùy chọn)" aria-label="Mô tả bộ sưu tập" value={collectionEdit.description} onChange={(event) => setCollectionEdit({ ...collectionEdit, description: event.target.value })} />
                          <select aria-label="Chế độ hiển thị bộ sưu tập" value={collectionEdit.visibility} onChange={(event) => setCollectionEdit({ ...collectionEdit, visibility: event.target.value })}>
                            <option value="PRIVATE">Riêng tư</option>
                            <option value="PUBLIC">Công khai</option>
                          </select>
                          <div className="collection-cover-editor">
                            {collectionEdit.coverPreview && <img className="collection-cover" src={optimizedImageUrl(collectionEdit.coverPreview, { width: 240, height: 160 })} alt={`Ảnh đại diện bộ sưu tập ${collectionEdit.name}`} width="240" height="160" />}
                            <label>
                              Ảnh đại diện (tùy chọn)
                              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { uploadCollectionCover(event.target.files?.[0]); event.target.value = ''; }} />
                            </label>
                            {collectionEdit.coverPreview && (
                              <button className="text-button" type="button" onClick={() => setCollectionEdit({ ...collectionEdit, coverImageId: '', coverPreview: '' })}>Bỏ ảnh</button>
                            )}
                          </div>
                          {collectionCoverState.status === 'uploading' && <p className="field-hint" role="status">Đang upload ảnh...</p>}
                          {collectionCoverState.error && <p className="field-error">{collectionCoverState.error.message}</p>}
                          <div className="form-actions">
                            <button className="primary-button" type="submit">Lưu</button>
                            <button className="secondary-button" type="button" onClick={() => { setCollectionEdit(null); setCollectionCoverState({ status: 'idle', error: null }); }}>Hủy</button>
                          </div>
                        </form>
                      ) : (
                        <>
                          {collection.coverImage?.secureUrl && (
                            <img className="collection-thumb" src={optimizedImageUrl(collection.coverImage.secureUrl, { width: 96, height: 64 })} alt="" width="96" height="64" loading="lazy" />
                          )}
                          <Link to={`/bo-suu-tap/${collection.id}`}>{collection.name}</Link>
                          <span>
                            {collection._count?.bookmarks || 0} món · {collection.visibility === 'PUBLIC' ? 'Công khai' : 'Riêng tư'}{' '}
                            <button className="text-button" type="button" onClick={() => renameCollection(collection)}>Sửa</button>
                            <button className="text-button" type="button" onClick={() => toggleCollectionVisibility(collection)}>
                              {collection.visibility === 'PUBLIC' ? 'Chuyển riêng tư' : 'Chuyển công khai'}
                            </button>
                            <button className="icon-button" type="button" aria-label={`Xóa bộ sưu tập ${collection.name}`} onClick={() => removeCollection(collection.id)}>×</button>
                          </span>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              ) : <p>Chưa có bộ sưu tập nào.</p>}
            </>
          )}
        </div>
      )}
    </section>
  );
}

function ProfilePanel({ user, accessToken, updateUser }) {
  const [values, setValues] = useState({
    displayName: user?.profile?.displayName || '',
    bio: user?.profile?.bio || '',
    username: user?.username || '',
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(user?.profile?.avatarUrl || '');
  const [status, setStatus] = useState({ state: 'idle', error: null, message: null, fieldErrors: null });

  const update = (field, value) => setValues((current) => ({ ...current, [field]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setStatus({ state: 'submitting', error: null, message: null, fieldErrors: null });
    try {
      let avatarMediaId;
      if (avatarFile) {
        const uploaded = await uploadImageToCloudinary(avatarFile, accessToken, 'avatar');
        avatarMediaId = uploaded.mediaAssetId;
        setAvatarPreview(uploaded.secure_url);
      }
      const result = await communityApi.updateProfile({ ...values, ...(avatarMediaId ? { avatarMediaId } : {}) }, accessToken);
      updateUser(result.user);
      setAvatarFile(null);
      setStatus({ state: 'success', error: null, message: 'Đã cập nhật hồ sơ.', fieldErrors: null });
    } catch (error) {
      setStatus({ state: 'error', error, message: null, fieldErrors: error.details || null });
    }
  };

  return (
    <div className="account-panel">
      <h2>Hồ sơ công khai</h2>
      <p className="field-hint">Tên hiển thị và ảnh đại diện xuất hiện trên công thức, bình luận và hồ sơ của bạn.</p>
      {status.message && <p className="form-success" role="status">{status.message}</p>}
      {status.error && <p className="form-error" role="alert">{status.error.message}</p>}
      <form className="account-form" onSubmit={submit}>
        {avatarPreview && <img className="avatar-preview" src={optimizedImageUrl(avatarPreview, { width: 96, height: 96 })} alt="Ảnh đại diện hiện tại" width="96" height="96" />}
        <label>
          Ảnh đại diện
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setAvatarFile(event.target.files?.[0] || null)} />
          <span className="field-hint">JPG, PNG hoặc WEBP. Ảnh được tải lên object storage.</span>
        </label>
        <label>
          Tên hiển thị
          <input required minLength="2" maxLength="100" value={values.displayName} onChange={(event) => update('displayName', event.target.value)} />
          {status.fieldErrors?.displayName && <span className="field-error">{status.fieldErrors.displayName}</span>}
        </label>
        <label>
          Username
          <input required minLength="3" maxLength="30" pattern="[a-zA-Z0-9._]{3,30}" value={values.username} onChange={(event) => update('username', event.target.value)} />
          <span className="field-hint">3–30 ký tự, chỉ gồm chữ, số, dấu chấm hoặc gạch dưới.</span>
          {status.fieldErrors?.username && <span className="field-error">{status.fieldErrors.username}</span>}
        </label>
        <label>
          Giới thiệu
          <textarea rows="3" maxLength="500" value={values.bio} onChange={(event) => update('bio', event.target.value)} />
          {status.fieldErrors?.bio && <span className="field-error">{status.fieldErrors.bio}</span>}
        </label>
        <div className="form-actions">
          <button className="primary-button" type="submit" disabled={status.state === 'submitting'}>
            {status.state === 'submitting' ? 'Đang lưu...' : 'Lưu hồ sơ'}
          </button>
        </div>
      </form>
    </div>
  );
}

function PasswordPanel({ accessToken }) {
  const [values, setValues] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [status, setStatus] = useState({ state: 'idle', error: null, message: null });
  const update = (field, value) => setValues((current) => ({ ...current, [field]: value }));

  const submit = async (event) => {
    event.preventDefault();
    if (values.newPassword !== values.confirmPassword) {
      setStatus({ state: 'error', error: new Error('Mật khẩu xác nhận không khớp.'), message: null });
      return;
    }
    setStatus({ state: 'submitting', error: null, message: null });
    try {
      await authApi.changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword }, accessToken);
      setValues({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setStatus({ state: 'success', error: null, message: 'Đã đổi mật khẩu. Các phiên đăng nhập khác đã bị đăng xuất.' });
    } catch (error) {
      setStatus({ state: 'error', error, message: null });
    }
  };

  return (
    <div className="account-panel">
      <h2>Đổi mật khẩu</h2>
      <p className="field-hint">Sau khi đổi mật khẩu, mọi phiên đăng nhập khác sẽ bị thu hồi.</p>
      {status.message && <p className="form-success" role="status">{status.message}</p>}
      {status.error && <p className="form-error" role="alert">{status.error.message}</p>}
      <form className="account-form" onSubmit={submit}>
        <label>Mật khẩu hiện tại<input type="password" required autoComplete="current-password" value={values.currentPassword} onChange={(event) => update('currentPassword', event.target.value)} /></label>
        <label>Mật khẩu mới<input type="password" required minLength="8" maxLength="72" autoComplete="new-password" value={values.newPassword} onChange={(event) => update('newPassword', event.target.value)} /></label>
        <label>Nhập lại mật khẩu mới<input type="password" required minLength="8" maxLength="72" autoComplete="new-password" value={values.confirmPassword} onChange={(event) => update('confirmPassword', event.target.value)} /></label>
        <div className="form-actions">
          <button className="primary-button" type="submit" disabled={status.state === 'submitting'}>
            {status.state === 'submitting' ? 'Đang cập nhật...' : 'Đổi mật khẩu'}
          </button>
        </div>
      </form>
    </div>
  );
}

function MyRecipesPanel({ state, recipes, onRetry }) {
  if (state.status === 'loading') return <LoadingState label="Đang tải công thức của bạn..." />;
  if (state.status === 'error') return <ErrorState error={state.error} onRetry={onRetry} />;
  if (recipes.length === 0) {
    return (
      <EmptyState title="Bạn chưa có công thức nào">
        <p>Bắt đầu chia sẻ món ngon đầu tiên của bạn.</p>
        <Link className="primary-button button-link" to="/cong-thuc-moi">Viết công thức</Link>
      </EmptyState>
    );
  }
  return (
    <div className="account-panel">
      <div className="account-panel-heading">
        <h2>Công thức của tôi <span className="count-badge">{recipes.length}</span></h2>
        <Link className="secondary-button button-link" to="/cong-thuc-moi">Viết công thức mới</Link>
      </div>
      <div className="recipe-grid">
        {recipes.map((recipe) => (
          <div className="my-recipe" key={recipe.id}>
            <RecipeCard recipe={recipe} />
            <div className="my-recipe-actions">
              <span className={`status-badge status-${recipe.status.toLowerCase()}`}>{STATUS_LABELS[recipe.status] || recipe.status}</span>
              <Link className="text-button" to={`/cong-thuc/${recipe.slug}/chinh-sua`}>Chỉnh sửa</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
