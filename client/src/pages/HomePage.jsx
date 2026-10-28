import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { RecipeCard } from '../features/recipes/RecipeCard.jsx';
import { SkeletonGrid } from '../features/recipes/RecipeStates.jsx';
import { challengeApi, discoveryApi, recipeApi, taxonomyApi } from '../services/apiClient.js';
import { useDocumentMeta } from '../lib/useDocumentMeta.js';
import { optimizedImageUrl } from '../utils/image.js';
import { Icon } from '../components/Icon.jsx';

function useSection(loader) {
  const [state, setState] = useState({ status: 'loading', items: [], meta: null, error: null });
  const load = useCallback(async () => {
    setState((current) => ({ ...current, status: 'loading', error: null }));
    try {
      const result = await loader();
      setState({ status: 'success', items: result.items, meta: result.meta ?? null, error: null });
    } catch (error) {
      setState({ status: 'error', items: [], meta: null, error });
    }
  }, [loader]);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}

function SectionState({ section, emptyLabel }) {
  if (section.status === 'loading') return <SkeletonGrid count={3} />;
  if (section.status === 'error') {
    return (
      <p className="home-section-state">
        Không thể tải nội dung.{' '}
        <button className="text-button" type="button" onClick={section.reload}>Thử lại</button>
      </p>
    );
  }
  if (section.items.length === 0) return <p className="home-section-state">{emptyLabel}</p>;
  return null;
}

function ActiveChallengeLoader() {
  return challengeApi.list({ status: 'ACTIVE', limit: 3 }).then((result) => ({ items: result.data, meta: result.meta }));
}

function LatestRecipeLoader() {
  return recipeApi.list({ limit: 6, sort: 'newest' }).then((result) => ({ items: result.data, meta: result.meta }));
}

function PopularRecipeLoader() {
  return recipeApi.list({ limit: 3, sort: 'popular' }).then((result) => ({ items: result.data }));
}

function FeaturedRecipeLoader() {
  return recipeApi.list({ limit: 3, featured: true }).then((result) => ({ items: result.data }));
}

function VegetarianRecipeLoader() {
  return recipeApi.list({ limit: 3, diet: 'mon-chay' }).then((result) => ({ items: result.data, meta: result.meta }));
}

function EatCleanRecipeLoader() {
  return recipeApi.list({ limit: 3, diet: 'eat-clean' }).then((result) => ({ items: result.data }));
}

function CooksnapRecipeLoader() {
  return recipeApi.list({ limit: 3, hasCooksnap: true, sort: 'cooksnaps' }).then((result) => ({ items: result.data }));
}

function TrendingLoader() {
  return discoveryApi.trendingKeywords().then((result) => ({ items: result.keywords }));
}

function CategoriesLoader() {
  return taxonomyApi.categories().then((items) => ({ items }));
}

function RecipeSection({ id, title, subtitle, section, emptyLabel, moreHref, moreLabel = 'Xem tất cả' }) {
  return (
    <section className="home-section" aria-labelledby={id}>
      <div className="home-section-heading">
        <div>
          <h2 id={id}>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <Link className="section-link" to={moreHref}>
          {moreLabel}<Icon name="arrow-right" size={16} />
        </Link>
      </div>
      <SectionState section={section} emptyLabel={emptyLabel} />
      {section.items.length > 0 && (
        <div className="recipe-grid">
          {section.items.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} />)}
        </div>
      )}
    </section>
  );
}

function formatDate(value, style = 'short') {
  if (!value) return '';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: style }).format(new Date(value));
}

export function HomePage() {
  const navigate = useNavigate();
  const challenges = useSection(ActiveChallengeLoader);
  const latest = useSection(LatestRecipeLoader);
  const popular = useSection(PopularRecipeLoader);
  const featured = useSection(FeaturedRecipeLoader);
  const vegetarian = useSection(VegetarianRecipeLoader);
  const eatClean = useSection(EatCleanRecipeLoader);
  const cooksnaps = useSection(CooksnapRecipeLoader);
  const trending = useSection(TrendingLoader);
  const categories = useSection(CategoriesLoader);
  const [searchTerm, setSearchTerm] = useState('');

  useDocumentMeta({
    title: 'Bếp Nhà — Cộng đồng công thức nấu ăn',
    description: 'Khám phá công thức món Việt, món chay, eat clean và chia sẻ món ngon của riêng bạn.',
    url: window.location.origin,
  });

  const submitSearch = (event) => {
    event.preventDefault();
    navigate(searchTerm.trim() ? `/cong-thuc?q=${encodeURIComponent(searchTerm.trim())}` : '/cong-thuc');
  };

  const spotlight = featured.items[0] || latest.items[0] || null;
  const spotlightCover = optimizedImageUrl(spotlight?.coverImage?.secureUrl, { width: 900, height: 1000 });
  const secondary = featured.items[1] || latest.items[1] || null;
  const secondaryCover = optimizedImageUrl(secondary?.coverImage?.secureUrl, { width: 360, height: 280 });

  return (
    <div className="home-page">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="hero-copy">
          <p className="eyebrow"><Icon name="sparkles" size={15} />Cộng đồng công thức nấu ăn</p>
          <h1 id="home-title">Mỗi bữa cơm,<br /><em>một câu chuyện.</em></h1>
          <p className="lead">
            Khám phá công thức được cộng đồng nấu thử mỗi ngày, hoặc lưu lại món ngon của riêng bạn
            để cả nhà cùng thưởng thức.
          </p>

          <form className="hero-search" role="search" onSubmit={submitSearch}>
            <Icon name="search" size={20} />
            <input
              type="search"
              name="q"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Bạn muốn nấu món gì hôm nay?"
              aria-label="Tìm công thức nấu ăn"
            />
            <button className="primary-button" type="submit">Tìm món</button>
          </form>

          <div className="trending-keywords" aria-label="Từ khóa thịnh hành">
            <span className="trending-label">Đang được tìm:</span>
            {trending.status === 'loading' && <span className="trending-placeholder">đang cập nhật…</span>}
            {trending.status === 'success' && trending.items.length === 0 && <em>Chưa có dữ liệu</em>}
            {trending.items.slice(0, 5).map((keyword) => (
              <Link key={keyword.slug} className="keyword-chip" to={`/cong-thuc?q=${encodeURIComponent(keyword.keyword)}`}>
                {keyword.keyword}
              </Link>
            ))}
          </div>

          <dl className="hero-stats">
            <div><dt>Công thức</dt><dd>{latest.meta?.total ?? '—'}</dd></div>
            <div><dt>Thử thách</dt><dd>{challenges.meta?.total ?? '—'}</dd></div>
            <div><dt>Món chay</dt><dd>{vegetarian.meta?.total ?? '—'}</dd></div>
          </dl>
        </div>

        <div className="hero-visual">
          <span className="hero-visual-glow" aria-hidden="true" />
          {spotlight ? (
            <Link className="hero-feature" to={`/cong-thuc/${spotlight.slug}`}>
              {spotlightCover ? (
                <img src={spotlightCover} alt={`Ảnh món ${spotlight.title}`} width="900" height="1000" />
              ) : (
                <span className="hero-feature-placeholder" aria-hidden="true"><Icon name="chef" size={44} /></span>
              )}
              <span className="hero-feature-body">
                <span className="hero-feature-label">{spotlight.featured ? 'Nổi bật tuần này' : 'Mới lên sóng'}</span>
                <strong>{spotlight.title}</strong>
                <span>{spotlight.category?.name || 'Công thức cộng đồng'} · {spotlight.totalTimeMinutes ? `${spotlight.totalTimeMinutes} phút` : 'Dễ làm'}</span>
              </span>
            </Link>
          ) : (
            <div className="hero-feature hero-feature-empty">
              <span className="hero-feature-placeholder" aria-hidden="true"><Icon name="chef" size={44} /></span>
              <span className="hero-feature-body">
                <strong>Căn bếp đang chờ món đầu tiên</strong>
                <span>Chia sẻ công thức của bạn với cộng đồng.</span>
              </span>
            </div>
          )}

          {secondary && (
            <Link className="hero-side-card" to={`/cong-thuc/${secondary.slug}`}>
              {secondaryCover
                ? <img src={secondaryCover} alt={`Ảnh món ${secondary.title}`} width="360" height="280" loading="lazy" />
                : <span className="hero-side-placeholder" aria-hidden="true"><Icon name="utc" size={22} /></span>}
              <span>
                <small>Gợi ý cho bạn</small>
                <strong>{secondary.title}</strong>
              </span>
            </Link>
          )}
        </div>
      </section>

      {categories.items.length > 0 && (
        <nav className="category-strip" aria-label="Danh mục công thức">
          {categories.items.slice(0, 8).map((category) => (
            <Link key={category.id} className="category-pill" to={`/cong-thuc?categoryId=${category.id}`}>
              {category.name}
            </Link>
          ))}
          <Link className="category-pill category-pill-more" to="/cong-thuc">
            Tất cả<Icon name="arrow-right" size={15} />
          </Link>
        </nav>
      )}

      <section className="home-section" aria-labelledby="home-challenges">
        <div className="home-section-heading">
          <div>
            <h2 id="home-challenges">Thử thách đang diễn ra</h2>
            <p>Nấu theo chủ đề, khoe thành quả và học từ những căn bếp khác.</p>
          </div>
          <Link className="section-link" to="/thu-thach">Tất cả thử thách<Icon name="arrow-right" size={16} /></Link>
        </div>
        <SectionState section={challenges} emptyLabel="Hiện chưa có thử thách nào đang diễn ra." />
        {challenges.items.length > 0 && (
          <div className="challenge-grid">
            {challenges.items.map((challenge) => (
              <article className="challenge-card" key={challenge.id}>
                <Link className="challenge-media" to={`/thu-thach/${challenge.id}`} tabIndex={-1} aria-hidden="true">
                  {challenge.bannerUrl
                    ? <img src={optimizedImageUrl(challenge.bannerUrl, { width: 1200, height: 600 })} alt={`Banner thử thách ${challenge.title}`} loading="lazy" width="1200" height="600" />
                    : <span className="challenge-placeholder"><Icon name="trophy" size={34} /></span>}
                  <span className="status-badge status-active">Đang diễn ra</span>
                </Link>
                <div className="challenge-card-body">
                  <h3><Link to={`/thu-thach/${challenge.id}`}>{challenge.title}</Link></h3>
                  <p>{challenge.description || 'Gửi công thức public của bạn để tham gia.'}</p>
                  <div className="challenge-meta">
                    <span><Icon name="calendar" size={15} />{formatDate(challenge.endsAt)}</span>
                    <span><Icon name="users" size={15} />{challenge.entryCount} bài dự thi</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <RecipeSection
        id="home-featured"
        title="Nội dung biên tập nổi bật"
        subtitle="Những công thức được ban biên tập chọn lọc."
        section={featured}
        emptyLabel="Chưa có công thức nổi bật."
        moreHref="/cong-thuc"
      />

      <RecipeSection
        id="home-latest"
        title="Công thức mới nhất"
        subtitle="Vừa ra lò từ các căn bếp trong cộng đồng."
        section={latest}
        emptyLabel="Chưa có công thức nào. Hãy là người đầu tiên chia sẻ."
        moreHref="/cong-thuc?sort=newest"
      />

      <RecipeSection
        id="home-vegetarian"
        title="Món chay dễ nấu"
        subtitle="Bữa cơm thanh đạm mà vẫn tròn vị."
        section={vegetarian}
        emptyLabel="Chưa có công thức món chay."
        moreHref="/cong-thuc?diet=mon-chay"
      />

      <RecipeSection
        id="home-eat-clean"
        title="Eat clean lành mạnh"
        subtitle="Nguyên liệu tươi, cách nấu nhẹ nhàng."
        section={eatClean}
        emptyLabel="Chưa có công thức eat clean."
        moreHref="/cong-thuc?diet=eat-clean"
      />

      <RecipeSection
        id="home-cooksnaps"
        title="Được nấu nhiều nhất"
        subtitle="Công thức có nhiều ảnh thực hành từ cộng đồng."
        section={cooksnaps}
        emptyLabel="Chưa có ảnh đã nấu nào."
        moreHref="/cong-thuc?hasCooksnap=true&sort=cooksnaps"
      />

      <RecipeSection
        id="home-popular"
        title="Được lưu nhiều"
        section={popular}
        emptyLabel="Chưa có công thức nổi bật."
        moreHref="/cong-thuc?sort=popular"
      />

      <section className="home-cta" aria-labelledby="home-cta-title">
        <div>
          <p className="eyebrow">Dành cho bạn</p>
          <h2 id="home-cta-title">Có một món ngon đang chờ được kể?</h2>
          <p>Đăng công thức, nhận góp ý từ cộng đồng và lưu lại những lần nấu thành công.</p>
        </div>
        <div className="home-cta-actions">
          <Link className="primary-button button-link" to="/cong-thuc-moi">Viết công thức</Link>
          <Link className="secondary-button button-link" to="/thu-thach">Xem thử thách</Link>
        </div>
      </section>
    </div>
  );
}
