import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { communityApi } from '../services/apiClient.js';
import { EmptyState, ErrorState, LoadingState, NotFoundState } from '../features/recipes/RecipeStates.jsx';
import { RecipeCard } from '../features/recipes/RecipeCard.jsx';
import { useDocumentMeta } from '../lib/useDocumentMeta.js';

function displayName(person) {
  return person?.profile?.displayName || person?.username || 'Thành viên';
}

export function ProfilePage() {
  const { username } = useParams();
  const { accessToken, user } = useAuth();
  const [state, setState] = useState({ status: 'loading', profile: null, followers: [], following: [], error: null });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setState({ status: 'loading', profile: null, followers: [], following: [], error: null });
    try {
      const [profileResult, followers, following] = await Promise.all([
        communityApi.profile(username, accessToken),
        communityApi.profileConnections(username, 'followers'),
        communityApi.profileConnections(username, 'following'),
      ]);
      setState({ status: 'success', profile: profileResult.profile, followers, following, error: null });
    } catch (error) {
      setState({ status: error.code === 'USER_NOT_FOUND' ? 'not-found' : 'error', profile: null, followers: [], following: [], error });
    }
  }, [accessToken, username]);

  useEffect(() => { load(); }, [load]);

  const toggle = async () => {
    if (!accessToken) return;
    setBusy(true);
    try {
      if (state.profile.isFollowing) await communityApi.unfollow(state.profile.id, accessToken);
      else await communityApi.follow(state.profile.id, accessToken);
      await load();
    } catch (error) {
      setState((current) => ({ ...current, error }));
    } finally { setBusy(false); }
  };

  const profile = state.profile;
  useDocumentMeta({
    title: profile ? `${displayName(profile)} (@${profile.username}) | Bếp Nhà` : 'Hồ sơ thành viên | Bếp Nhà',
    description: profile?.profile?.bio || `Công thức và ảnh đã nấu của ${profile?.username || 'thành viên'} trên Bếp Nhà.`,
    url: window.location.href,
    type: 'profile',
    noindex: state.status !== 'success',
  });

  if (state.status === 'loading') return <LoadingState label="Đang tải hồ sơ..." />;
  if (state.status === 'not-found') return <NotFoundState />;
  if (state.status === 'error') return <ErrorState error={state.error} onRetry={load} />;

  const { followers, following } = state;
  const isOwnProfile = user?.id === profile.id;

  return (
    <section className="profile-page">
      <header className="profile-header">
        {profile.profile?.avatarUrl
          ? <img className="profile-avatar" src={profile.profile.avatarUrl} alt={`Ảnh đại diện của ${displayName(profile)}`} width="96" height="96" />
          : <div className="profile-avatar profile-avatar-placeholder" aria-hidden="true">{displayName(profile).slice(0, 1)}</div>}
        <div>
          <p className="eyebrow">Hồ sơ thành viên</p>
          <h1>{displayName(profile)}</h1>
          <p className="author-line">@{profile.username}</p>
          {profile.profile?.bio && <p className="lead">{profile.profile.bio}</p>}
        </div>
        <div className="profile-actions">
          {isOwnProfile && <Link className="secondary-button button-link" to="/tai-khoan">Chỉnh sửa hồ sơ</Link>}
          {!isOwnProfile && accessToken && (
            <button className="primary-button" type="button" disabled={busy} onClick={toggle}>
              {profile.isFollowing ? 'Đang theo dõi' : 'Theo dõi'}
            </button>
          )}
          {!isOwnProfile && !accessToken && <Link className="primary-button button-link" to="/dang-nhap">Đăng nhập để theo dõi</Link>}
        </div>
      </header>

      <div className="profile-connections">
        <section>
          <h2>Người theo dõi <span>{profile._count.followsTo}</span></h2>
          {followers.length ? (
            <ul className="saved-list">
              {followers.map((item) => (
                <li key={item.id}>
                  <Link to={`/nguoi-dung/${item.username}`}>{displayName(item)}</Link>
                  <span>@{item.username}</span>
                </li>
              ))}
            </ul>
          ) : <p>Chưa có người theo dõi.</p>}
        </section>
        <section>
          <h2>Đang theo dõi <span>{profile._count.followsFrom}</span></h2>
          {following.length ? (
            <ul className="saved-list">
              {following.map((item) => (
                <li key={item.id}>
                  <Link to={`/nguoi-dung/${item.username}`}>{displayName(item)}</Link>
                  <span>@{item.username}</span>
                </li>
              ))}
            </ul>
          ) : <p>Chưa theo dõi ai.</p>}
        </section>
      </div>

      <section className="profile-section">
        <h2>Công thức công khai <span className="count-badge">{profile._count.recipes}</span></h2>
        {profile.recipes.length
          ? <div className="recipe-grid">{profile.recipes.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} />)}</div>
          : <EmptyState title="Chưa có công thức công khai"><p>Thành viên này chưa xuất bản công thức nào.</p></EmptyState>}
      </section>

      <section className="profile-section">
        <h2>Ảnh đã nấu</h2>
        {profile.cooksnaps?.length ? (
          <div className="cooksnap-grid">
            {profile.cooksnaps.map((cooksnap) => (
              <figure key={cooksnap.id}>
                <img
                  src={cooksnap.imageUrl}
                  alt={`Món ${cooksnap.recipe?.title || 'đã nấu'} do ${displayName(profile)} thực hiện`}
                  loading="lazy"
                  width="480"
                  height="360"
                />
                <figcaption>
                  <Link to={`/cong-thuc/${cooksnap.recipe?.slug}`}>{cooksnap.recipe?.title}</Link>
                  {cooksnap.caption && <span>{cooksnap.caption}</span>}
                </figcaption>
              </figure>
            ))}
          </div>
        ) : <p>Chưa có ảnh đã nấu nào.</p>}
      </section>

      <section className="profile-section">
        <h2>Bộ sưu tập công khai</h2>
        {profile.collections?.length ? (
          <ul className="collection-grid">
            {profile.collections.map((collection) => (
              <li key={collection.id}>
                <Link to={`/bo-suu-tap/${collection.id}`}>{collection.name}</Link>
                <span>{collection._count?.bookmarks || 0} công thức</span>
                {collection.description && <p>{collection.description}</p>}
              </li>
            ))}
          </ul>
        ) : <p>Chưa có bộ sưu tập công khai.</p>}
      </section>
    </section>
  );
}
