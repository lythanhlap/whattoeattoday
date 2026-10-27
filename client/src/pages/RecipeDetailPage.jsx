import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { communityApi, recipeApi, uploadImageToCloudinary } from '../services/apiClient.js';
import { ErrorState, LoadingState, NotFoundState } from '../features/recipes/RecipeStates.jsx';
import { RecipeCard } from '../features/recipes/RecipeCard.jsx';
import { scaleQuantity } from '../utils/quantity.js';
import { optimizedImageUrl } from '../utils/image.js';
import { useDocumentMeta } from '../lib/useDocumentMeta.js';

const REPORT_REASONS = [
  { value: 'SPAM', label: 'Spam' },
  { value: 'COPIED_CONTENT', label: 'Sao chép nội dung' },
  { value: 'IRRELEVANT_IMAGE', label: 'Hình ảnh không liên quan' },
  { value: 'DANGEROUS_OR_MISLEADING', label: 'Nguy hiểm hoặc gây hiểu lầm' },
  { value: 'HARASSMENT', label: 'Quấy rối hoặc công kích' },
  { value: 'COPYRIGHT', label: 'Vi phạm bản quyền' },
  { value: 'OFF_TOPIC', label: 'Không liên quan đến nấu ăn' },
  { value: 'OTHER', label: 'Lý do khác' },
];

const STATUS_LABELS = {
  DRAFT: 'Bản nháp',
  PENDING_REVIEW: 'Đang chờ duyệt',
  PUBLISHED: 'Đã xuất bản',
  REJECTED: 'Bị từ chối',
  ARCHIVED: 'Đã lưu trữ',
};

function displayName(person) {
  return person?.profile?.displayName || person?.username || 'Thành viên';
}

export function RecipeDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user, accessToken } = useAuth();
  const [state, setState] = useState({ status: 'loading', recipe: null, error: null });
  const [saved, setSaved] = useState(false);
  const [bookmarking, setBookmarking] = useState(false);
  const [collections, setCollections] = useState([]);
  const [collectionId, setCollectionId] = useState('');
  const [reportReason, setReportReason] = useState('OTHER');
  const [reportDescription, setReportDescription] = useState('');
  const [reportMessage, setReportMessage] = useState(null);
  const [cooksnaps, setCooksnaps] = useState([]);
  const [cooksnapError, setCooksnapError] = useState(null);
  const [cooksnapStatus, setCooksnapStatus] = useState('idle');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [comments, setComments] = useState([]);
  const [commentContent, setCommentContent] = useState('');
  const [commentError, setCommentError] = useState(null);
  const [commentStatus, setCommentStatus] = useState('idle');
  const [servings, setServings] = useState(1);
  const [shareMessage, setShareMessage] = useState(null);
  const [related, setRelated] = useState([]);
  const [editingCooksnapId, setEditingCooksnapId] = useState(null);
  const [editCaption, setEditCaption] = useState('');

  const load = useCallback(async () => {
    setState({ status: 'loading', recipe: null, error: null });
    try {
      const result = await recipeApi.getBySlug(slug, accessToken);
      setState({ status: 'success', recipe: result.recipe, error: null });
    } catch (error) {
      setState({ status: error.code === 'RECIPE_NOT_FOUND' ? 'not-found' : 'error', recipe: null, error });
    }
  }, [accessToken, slug]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!imageFile) { setImagePreview(''); return undefined; }
    const preview = URL.createObjectURL(imageFile);
    setImagePreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [imageFile]);

  const recipeId = state.recipe?.id;
  const categoryId = state.recipe?.categoryId;
  const servingFactor = useMemo(() => {
    const base = state.recipe?.servings;
    return base > 0 ? servings / base : 1;
  }, [servings, state.recipe?.servings]);

  useEffect(() => {
    if (state.recipe?.servings) setServings(state.recipe.servings);
  }, [state.recipe?.id, state.recipe?.servings]);

  useEffect(() => {
    if (!recipeId) return undefined;
    const storageKey = `recipe-viewed:${recipeId}`;
    let alreadyViewed = false;
    try {
      alreadyViewed = window.sessionStorage.getItem(storageKey) === '1';
      if (!alreadyViewed) window.sessionStorage.setItem(storageKey, '1');
    } catch {
      alreadyViewed = false;
    }
    if (alreadyViewed) return undefined;
    let active = true;
    recipeApi.recordView(recipeId, accessToken).then((result) => {
      if (!active || !result?.recorded) return;
      setState((current) => (current.recipe?.id === recipeId ? { ...current, recipe: { ...current.recipe, viewCount: result.viewCount } } : current));
    }).catch(() => {});
    return () => { active = false; };
  }, [accessToken, recipeId]);

  useEffect(() => {
    if (!recipeId) return;
    communityApi.cooksnaps(recipeId, accessToken).then(setCooksnaps).catch(setCooksnapError);
    communityApi.comments(recipeId, accessToken).then(setComments).catch(setCommentError);
    if (accessToken) {
      communityApi.collections(accessToken).then(setCollections).catch(() => {});
      communityApi.bookmarks(accessToken).then((bookmarks) => {
        const current = bookmarks.find((bookmark) => bookmark.recipeId === recipeId);
        if (current) { setSaved(true); setCollectionId(current.collection?.id || ''); }
      }).catch(() => {});
    }
  }, [accessToken, recipeId]);

  useEffect(() => {
    if (!categoryId || !recipeId) { setRelated([]); return; }
    recipeApi.list({ categoryId, limit: 4 })
      .then((result) => setRelated(result.data.filter((item) => item.id !== recipeId).slice(0, 3)))
      .catch(() => setRelated([]));
  }, [categoryId, recipeId]);

  const jsonLd = useMemo(() => {
    const recipe = state.recipe;
    if (!recipe) return null;
    return {
      '@context': 'https://schema.org',
      '@type': 'Recipe',
      name: recipe.title,
      description: recipe.description || undefined,
      image: recipe.coverImage?.secureUrl ? [recipe.coverImage.secureUrl] : undefined,
      author: { '@type': 'Person', name: displayName(recipe.author) },
      datePublished: recipe.publishedAt || undefined,
      dateModified: recipe.updatedAt || undefined,
      recipeYield: recipe.servings ? `${recipe.servings} phần` : undefined,
      prepTime: recipe.prepTimeMinutes != null ? `PT${recipe.prepTimeMinutes}M` : undefined,
      cookTime: recipe.cookTimeMinutes != null ? `PT${recipe.cookTimeMinutes}M` : undefined,
      totalTime: recipe.totalTimeMinutes != null ? `PT${recipe.totalTimeMinutes}M` : undefined,
      recipeCategory: recipe.category?.name || undefined,
      keywords: recipe.tags?.map((item) => item.tag.name).join(', ') || undefined,
      recipeIngredient: recipe.ingredients?.map((item) => [item.quantity, item.unit, item.displayName].filter(Boolean).join(' ')) || [],
      recipeInstructions: recipe.steps?.map((step) => ({ '@type': 'HowToStep', text: step.instruction })) || [],
    };
  }, [state.recipe]);

  useDocumentMeta({
    title: state.recipe ? `${state.recipe.title} | Bếp Nhà` : 'Công thức | Bếp Nhà',
    description: state.recipe?.description || 'Công thức nấu ăn từ cộng đồng Bếp Nhà.',
    url: window.location.href,
    image: state.recipe?.coverImage?.secureUrl,
    type: 'article',
    jsonLd,
    noindex: Boolean(state.recipe && state.recipe.status !== 'PUBLISHED'),
  });

  if (state.status === 'loading') return <LoadingState label="Đang tải công thức..." />;
  if (state.status === 'not-found') return <NotFoundState />;
  if (state.status === 'error') return <ErrorState error={state.error} onRetry={load} />;

  const { recipe } = state;
  const isAuthor = user?.id === recipe.authorId;
  const canEdit = isAuthor || ['EDITOR', 'ADMIN'].includes(user?.role);

  const shareRecipe = async () => {
    const url = window.location.href;
    const shareData = { title: recipe.title, text: recipe.description || 'Công thức từ Bếp Nhà', url };
    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(url);
        setShareMessage('Đã sao chép đường dẫn công thức.');
      }
    } catch (error) {
      if (error.name !== 'AbortError') setShareMessage('Không thể chia sẻ tự động. Hãy sao chép đường dẫn trên trình duyệt.');
    }
  };

  const toggleBookmark = async () => {
    if (!accessToken) { navigate('/dang-nhap'); return; }
    setBookmarking(true);
    try {
      if (saved) await communityApi.removeBookmark(recipe.id, accessToken);
      else await communityApi.addBookmark(recipe.id, collectionId || undefined, accessToken);
      setSaved(!saved);
    } catch (error) {
      setReportMessage(error.message);
    } finally { setBookmarking(false); }
  };

  const changeCollection = async (value) => {
    setCollectionId(value);
    if (saved && accessToken) { setBookmarking(true); try { await communityApi.addBookmark(recipe.id, value || undefined, accessToken); } finally { setBookmarking(false); } }
  };

  const report = async () => {
    if (!accessToken) { navigate('/dang-nhap'); return; }
    try {
      await communityApi.reportRecipe(recipe.id, { reason: reportReason, description: reportDescription || undefined }, accessToken);
      setReportMessage('Đã gửi báo cáo để moderator kiểm tra.');
      setReportDescription('');
    } catch (error) { setReportMessage(error.message); }
  };

  const submitCooksnap = async (event) => {
    event.preventDefault();
    if (!accessToken) { navigate('/dang-nhap'); return; }
    setCooksnapStatus('submitting'); setCooksnapError(null);
    try {
      const uploaded = imageFile ? await uploadImageToCloudinary(imageFile, accessToken, 'cooksnap') : null;
      const result = await communityApi.createCooksnap(recipe.id, { ...(uploaded?.mediaAssetId ? { mediaAssetId: uploaded.mediaAssetId } : { imageUrl }), caption }, accessToken);
      setCooksnaps((current) => [result.cooksnap, ...current]);
      setImageFile(null); setImageUrl(''); setCaption(''); setCooksnapStatus('success');
    } catch (error) { setCooksnapError(error); setCooksnapStatus('error'); }
  };

  const saveCooksnap = async (cooksnap) => {
    try {
      const result = await communityApi.updateCooksnap(cooksnap.id, { caption: editCaption }, accessToken);
      setCooksnaps((current) => current.map((item) => (item.id === cooksnap.id ? result.cooksnap : item)));
      setEditingCooksnapId(null);
      setEditCaption('');
    } catch (error) { setCooksnapError(error); }
  };

  const removeCooksnap = async (cooksnap) => {
    if (!window.confirm('Xóa ảnh đã nấu này?')) return;
    try {
      await communityApi.deleteCooksnap(cooksnap.id, accessToken);
      setCooksnaps((current) => current.filter((item) => item.id !== cooksnap.id));
    } catch (error) { setCooksnapError(error); }
  };

  const submitComment = async (event) => {
    event.preventDefault();
    if (!accessToken) { navigate('/dang-nhap'); return; }
    setCommentStatus('submitting'); setCommentError(null);
    try {
      const result = await communityApi.createComment(recipe.id, commentContent, accessToken);
      setComments((current) => [...current, result.comment]);
      setCommentContent('');
      setCommentStatus('success');
    } catch (error) { setCommentError(error); setCommentStatus('error'); }
  };

  const removeComment = async (comment) => {
    if (!window.confirm('Xóa bình luận này?')) return;
    try {
      await communityApi.deleteComment(comment.id, accessToken);
      setComments((current) => current.filter((item) => item.id !== comment.id));
    } catch (error) { setCommentError(error); }
  };

  const reportCommunityItem = async (targetType, id) => {
    if (!accessToken) { navigate('/dang-nhap'); return; }
    try {
      await communityApi.reportTarget(targetType, id, { reason: 'OTHER' }, accessToken);
      setReportMessage('Đã gửi báo cáo để moderator kiểm tra.');
    } catch (error) { setReportMessage(error.message); }
  };

  return (
    <article className="recipe-detail">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Trang chủ</Link>
        <span aria-hidden="true">/</span>
        <Link to="/cong-thuc">Công thức</Link>
        {recipe.category && <><span aria-hidden="true">/</span><Link to={`/cong-thuc?categoryId=${recipe.category.id}`}>{recipe.category.name}</Link></>}
        <span aria-hidden="true">/</span>
        <span aria-current="page">{recipe.title}</span>
      </nav>

      {isAuthor && recipe.status !== 'PUBLISHED' && (
        <div className="author-status" role="status">
          <strong>{STATUS_LABELS[recipe.status] || recipe.status}</strong>
          {recipe.status === 'PENDING_REVIEW' && <span> Công thức đang chờ biên tập viên duyệt.</span>}
          {recipe.reviewNote && <span> Ghi chú từ biên tập: {recipe.reviewNote}</span>}
        </div>
      )}
      {recipe.hiddenAt && <p className="form-error">Công thức đang bị ẩn và chỉ bạn có thể xem.</p>}

      <div className="detail-header">
        <div>
          <p className="eyebrow">{recipe.category?.name || 'Công thức cộng đồng'}</p>
          <h1>{recipe.title}</h1>
          <p className="lead">{recipe.description}</p>
          <p className="author-line">Bởi <Link to={`/nguoi-dung/${recipe.author?.username}`}>{displayName(recipe.author)}</Link>{recipe.publishedAt && <span> · đăng {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'long' }).format(new Date(recipe.publishedAt))}</span>}</p>
          {recipe.tags?.length > 0 && (
            <ul className="tag-list" aria-label="Tag công thức">
              {recipe.tags.map(({ tag }) => <li key={tag.id}><Link className="keyword-chip" to={`/cong-thuc?tags=${tag.slug}`}>{tag.name}</Link></li>)}
            </ul>
          )}
        </div>
        <div className="detail-actions">
          {canEdit && <Link className="secondary-button button-link" to={`/cong-thuc/${recipe.slug}/chinh-sua`}>Chỉnh sửa</Link>}
          {accessToken && collections.length > 0 && (
            <select value={collectionId} onChange={(event) => changeCollection(event.target.value)} aria-label="Bộ sưu tập lưu recipe">
              <option value="">Không phân loại</option>
              {collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}
            </select>
          )}
          <button className="primary-button" type="button" disabled={bookmarking} onClick={toggleBookmark}>{saved ? 'Đã lưu' : 'Lưu công thức'}</button>
          <button className="secondary-button" type="button" onClick={() => window.print()}>In công thức</button>
          <button className="secondary-button" type="button" onClick={shareRecipe}>Chia sẻ</button>
        </div>
      </div>

      {reportMessage && <p className="form-success" role="status">{reportMessage}</p>}
      {shareMessage && <p className="form-success" role="status">{shareMessage}</p>}

      {recipe.coverImage?.secureUrl && (
        <img className="recipe-cover" src={optimizedImageUrl(recipe.coverImage.secureUrl, { width: 1200, height: 700 })} alt={`Ảnh món ${recipe.title}`} width="1200" height="700" />
      )}

      <div className="detail-stats">
        <span><strong>{recipe.prepTimeMinutes ?? '—'}</strong> phút chuẩn bị</span>
        <span><strong>{recipe.cookTimeMinutes ?? '—'}</strong> phút nấu</span>
        <span><strong>{recipe.totalTimeMinutes ?? '—'}</strong> phút tổng</span>
        <span><strong>{recipe.servings ?? '—'}</strong> khẩu phần</span>
        <span><strong>{recipe.difficulty === 'HARD' ? 'Khó' : recipe.difficulty === 'MEDIUM' ? 'Vừa' : 'Dễ'}</strong> độ khó</span>
        <span><strong>{recipe.viewCount ?? 0}</strong> lượt xem</span>
      </div>

      {recipe.images?.length > 0 && (
        <section className="recipe-gallery" aria-label="Ảnh bổ sung của công thức">
          <h2>Ảnh bổ sung</h2>
          <ul className="recipe-gallery-grid">
            {recipe.images.map((image, index) => image.mediaAsset?.secureUrl && (
              <li key={image.id}>
                <a href={image.mediaAsset.secureUrl} target="_blank" rel="noreferrer">
                  <img
                    src={optimizedImageUrl(image.mediaAsset.secureUrl, { width: 480, height: 360 })}
                    alt={`Ảnh bổ sung ${index + 1} của ${recipe.title}`}
                    loading="lazy"
                    width="480"
                    height="360"
                  />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="detail-columns">
        <section>
          <div className="ingredient-heading">
            <h2>Nguyên liệu</h2>
            <div className="serving-control" aria-label="Điều chỉnh khẩu phần">
              <button className="icon-button" type="button" aria-label="Giảm khẩu phần" onClick={() => setServings((value) => Math.max(1, value - 1))}>−</button>
              <span><strong>{servings}</strong> khẩu phần</span>
              <button className="icon-button" type="button" aria-label="Tăng khẩu phần" onClick={() => setServings((value) => value + 1)}>+</button>
              {recipe.servings && servings !== recipe.servings && <button className="text-button" type="button" onClick={() => setServings(recipe.servings)}>Đặt lại</button>}
            </div>
          </div>
          <ul className="ingredient-list">
            {recipe.ingredients.map((ingredient) => (
              <li key={ingredient.id}>
                <span>{ingredient.displayName}{ingredient.isOptional ? ' (tùy chọn)' : ''}</span>
                <span>{[scaleQuantity(ingredient.quantity, servingFactor), ingredient.unit].filter(Boolean).join(' ') || 'Vừa đủ'}</span>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2>Cách làm</h2>
          <ol className="steps-list">
            {recipe.steps.map((step) => (
              <li key={step.id}>
                <span className="step-number">{step.stepNumber}</span>
                <p>{step.instruction}</p>
                {step.durationMinutes != null && <small>{step.durationMinutes} phút</small>}
              </li>
            ))}
          </ol>
        </section>
      </div>

      {(recipe.tips || recipe.substitutions || recipe.storageInstructions) && (
        <section className="recipe-notes">
          <h2>Mẹo và ghi chú</h2>
          {recipe.tips && <div><h3>Mẹo nấu ăn</h3><p>{recipe.tips}</p></div>}
          {recipe.substitutions && <div><h3>Gợi ý thay thế</h3><p>{recipe.substitutions}</p></div>}
          {recipe.storageInstructions && <div><h3>Bảo quản</h3><p>{recipe.storageInstructions}</p></div>}
        </section>
      )}

      <section className="report-section">
        <h2>Báo cáo công thức</h2>
        {!accessToken ? <p>Hãy <Link to="/dang-nhap">đăng nhập</Link> để báo cáo nội dung.</p> : (
          <div className="report-form">
            <label>Lý do<select value={reportReason} onChange={(event) => setReportReason(event.target.value)} aria-label="Lý do báo cáo">{REPORT_REASONS.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}</select></label>
            <label>Mô tả thêm<textarea rows="2" maxLength="1000" value={reportDescription} onChange={(event) => setReportDescription(event.target.value)} /></label>
            <button className="secondary-button" type="button" onClick={report}>Gửi báo cáo</button>
          </div>
        )}
      </section>

      <section className="cooksnap-section">
        <h2>Ảnh đã nấu</h2>
        {cooksnapError && <p className="form-error">{cooksnapError.message}</p>}
        {cooksnaps.length ? (
          <div className="cooksnap-grid">
            {cooksnaps.map((cooksnap) => (
              <figure key={cooksnap.id}>
                <img src={optimizedImageUrl(cooksnap.imageUrl, { width: 480, height: 360 })} alt={`Món ${recipe.title} do ${displayName(cooksnap.author)} thực hiện`} loading="lazy" width="480" height="360" />
                <figcaption>
                  {editingCooksnapId === cooksnap.id ? (
                    <span className="figure-actions">
                      <input
                        aria-label="Sửa nhận xét ảnh đã nấu"
                        maxLength="1000"
                        value={editCaption}
                        onChange={(event) => setEditCaption(event.target.value)}
                        placeholder="Nhận xét cho ảnh đã nấu"
                      />
                      <button className="text-button" type="button" onClick={() => saveCooksnap(cooksnap)}>Lưu</button>
                      <button className="text-button" type="button" onClick={() => { setEditingCooksnapId(null); setEditCaption(''); }}>Hủy</button>
                    </span>
                  ) : (
                    <>
                      {cooksnap.caption || `Bởi ${displayName(cooksnap.author)}`}
                      {accessToken && (
                        <span className="figure-actions">
                          {cooksnap.authorId === user?.id && <button className="text-button" type="button" onClick={() => { setEditingCooksnapId(cooksnap.id); setEditCaption(cooksnap.caption || ''); }}>Sửa</button>}
                          {cooksnap.authorId === user?.id && <button className="text-button" type="button" onClick={() => removeCooksnap(cooksnap)}>Xóa</button>}
                          <button className="text-button" type="button" onClick={() => reportCommunityItem('COOKSNAP', cooksnap.id)}>Báo cáo</button>
                        </span>
                      )}
                    </>
                  )}
                </figcaption>
              </figure>
            ))}
          </div>
        ) : <p>Chưa có ảnh đã nấu.</p>}
        {accessToken && (
          <form className="cooksnap-form" onSubmit={submitCooksnap}>
            <label>Chọn ảnh<input type="file" accept="image/jpeg,image/png,image/webp" required={!imageUrl} onChange={(event) => setImageFile(event.target.files?.[0] || null)} /></label>
            {imagePreview && <img className="cooksnap-upload-preview" src={imagePreview} alt="Xem trước ảnh đã chọn" />}
            <label>Hoặc URL ảnh object storage<input type="url" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} /></label>
            <label>Nhận xét<textarea rows="2" maxLength="1000" value={caption} onChange={(event) => setCaption(event.target.value)} /></label>
            <button className="primary-button" type="submit" disabled={cooksnapStatus === 'submitting'}>{cooksnapStatus === 'submitting' ? 'Đang upload...' : 'Đăng ảnh đã nấu'}</button>
          </form>
        )}
      </section>

      <section className="comments-section">
        <h2>Bình luận</h2>
        {commentError && <p className="form-error">{commentError.message}</p>}
        {comments.length ? (
          <ul className="comment-list">
            {comments.map((comment) => (
              <li key={comment.id}>
                <div className="comment-heading">
                  <strong>{displayName(comment.author)}</strong>
                  {accessToken && (
                    <span className="figure-actions">
                      {comment.authorId === user?.id && <button className="text-button" type="button" onClick={() => removeComment(comment)}>Xóa</button>}
                      <button className="text-button" type="button" onClick={() => reportCommunityItem('COMMENT', comment.id)}>Báo cáo</button>
                    </span>
                  )}
                </div>
                <p>{comment.content}</p>
              </li>
            ))}
          </ul>
        ) : <p>Chưa có bình luận.</p>}
        {accessToken ? (
          <form className="comment-form" onSubmit={submitComment}>
            <label>Viết bình luận<textarea required maxLength="2000" rows="3" value={commentContent} onChange={(event) => setCommentContent(event.target.value)} /></label>
            <button className="primary-button" type="submit" disabled={commentStatus === 'submitting'}>{commentStatus === 'submitting' ? 'Đang gửi...' : 'Đăng bình luận'}</button>
          </form>
        ) : <p><Link to="/dang-nhap">Đăng nhập</Link> để bình luận.</p>}
      </section>

      <section className="related-section">
        <h2>Công thức liên quan</h2>
        {related.length ? <div className="recipe-grid">{related.map((item) => <RecipeCard key={item.id} recipe={item} />)}</div> : <p>Chưa có công thức liên quan.</p>}
      </section>
    </article>
  );
}
