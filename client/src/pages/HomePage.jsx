import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RecipeCard } from '../features/recipes/RecipeCard.jsx';
import { challengeApi, discoveryApi, recipeApi } from '../services/apiClient.js';
import { useDocumentMeta } from '../lib/useDocumentMeta.js';
import { optimizedImageUrl } from '../utils/image.js';

function useSection(loader) {
  const [state, setState] = useState({ status: 'loading', items: [], error: null });
  const load = useCallback(async () => {
    setState((current) => ({ ...current, status: 'loading', error: null }));
    try {
      const result = await loader();
      setState({ status: 'success', items: result.items, error: null });
    } catch (error) {
      setState({ status: 'error', items: [], error });
    }
  }, [loader]);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}

function SectionState({ section, emptyLabel }) {
  if (section.status === 'loading') return <p className="home-section-state" role="status">Đang tải...</p>;
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
  return challengeApi.list({ status: 'ACTIVE', limit: 3 }).then((result) => ({ items: result.data }));
}

function LatestRecipeLoader() {
  return recipeApi.list({ limit: 6, sort: 'newest' }).then((result) => ({ items: result.data }));
}

function PopularRecipeLoader() {
  return recipeApi.list({ limit: 3, sort: 'popular' }).then((result) => ({ items: result.data }));
}

function FeaturedRecipeLoader() {
  return recipeApi.list({ limit: 3, featured: true }).then((result) => ({ items: result.data }));
}

function VegetarianRecipeLoader() {
  return recipeApi.list({ limit: 3, diet: 'mon-chay' }).then((result) => ({ items: result.data }));
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

function RecipeSection({ id, title, section, emptyLabel, moreHref }) {
  return (
    <section className="home-section" aria-labelledby={id}>
      <div className="home-section-heading">
        <h2 id={id}>{title}</h2>
        <Link to={moreHref}>Xem thêm</Link>
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

export function HomePage() {
  const challenges = useSection(ActiveChallengeLoader);
  const latest = useSection(LatestRecipeLoader);
  const popular = useSection(PopularRecipeLoader);
  const featured = useSection(FeaturedRecipeLoader);
  const vegetarian = useSection(VegetarianRecipeLoader);
  const eatClean = useSection(EatCleanRecipeLoader);
  const cooksnaps = useSection(CooksnapRecipeLoader);
  const trending = useSection(TrendingLoader);

  useDocumentMeta({
    title: 'Bếp Nhà — Cộng đồng công thức nấu ăn',
    description: 'Khám phá công thức món Việt, món chay, eat clean và chia sẻ món ngon của riêng bạn.',
    url: window.location.origin,
  });

  return (
    <div className="home-page">
      <section className="home-hero" aria-labelledby="home-title">
        <p className="eyebrow">Cộng đồng công thức</p>
        <h1 id="home-title">Chia sẻ món ngon mỗi ngày</h1>
        <p className="lead">Khám phá những món ăn dễ làm hoặc chia sẻ công thức của riêng bạn với cộng đồng.</p>
        <div className="home-hero-actions">
          <Link className="primary-button button-link" to="/cong-thuc">Xem công thức</Link>
          <Link className="secondary-button button-link" to="/thu-thach">Tham gia thử thách</Link>
        </div>
        <div className="trending-keywords" aria-label="Từ khóa thịnh hành">
          <span>Từ khóa thịnh hành:</span>
          {trending.status === 'success' && trending.items.length === 0 && <em>Chưa có dữ liệu</em>}
          {trending.items.map((keyword) => (
            <Link key={keyword.slug} className="keyword-chip" to={`/cong-thuc?q=${encodeURIComponent(keyword.keyword)}`}>{keyword.keyword}</Link>
          ))}
        </div>
      </section>

      <section className="home-section" aria-labelledby="home-challenges">
        <div className="home-section-heading">
          <h2 id="home-challenges">Thử thách đang diễn ra</h2>
          <Link to="/thu-thach">Tất cả thử thách</Link>
        </div>
        <SectionState section={challenges} emptyLabel="Hiện chưa có thử thách nào đang diễn ra." />
        {challenges.items.length > 0 && (
          <div className="challenge-grid">
            {challenges.items.map((challenge) => (
              <article className="challenge-card" key={challenge.id}>
                {challenge.bannerUrl && <img src={optimizedImageUrl(challenge.bannerUrl, { width: 1200, height: 600 })} alt={`Banner thử thách ${challenge.title}`} loading="lazy" width="1200" height="600" />}
                <div className="challenge-card-body">
                  <span className="status-badge status-active">Đang diễn ra</span>
                  <h3><Link to={`/thu-thach/${challenge.id}`}>{challenge.title}</Link></h3>
                  <p>{challenge.description || 'Gửi công thức public của bạn để tham gia.'}</p>
                  <small>{challenge.entryCount} công thức tham gia</small>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <RecipeSection id="home-featured" title="Nội dung biên tập nổi bật" section={featured} emptyLabel="Chưa có công thức nổi bật." moreHref="/cong-thuc" />
      <RecipeSection id="home-latest" title="Công thức mới nhất" section={latest} emptyLabel="Chưa có công thức nào. Hãy là người đầu tiên chia sẻ." moreHref="/cong-thuc?sort=newest" />
      <RecipeSection id="home-vegetarian" title="Món chay dễ nấu" section={vegetarian} emptyLabel="Chưa có công thức món chay." moreHref="/cong-thuc?diet=mon-chay" />
      <RecipeSection id="home-eat-clean" title="Eat clean và lành mạnh" section={eatClean} emptyLabel="Chưa có công thức eat clean." moreHref="/cong-thuc?diet=eat-clean" />
      <RecipeSection id="home-cooksnaps" title="Được nấu nhiều nhất" section={cooksnaps} emptyLabel="Chưa có ảnh đã nấu nào." moreHref="/cong-thuc?hasCooksnap=true&sort=cooksnaps" />
      <RecipeSection id="home-popular" title="Được lưu nhiều" section={popular} emptyLabel="Chưa có công thức nổi bật." moreHref="/cong-thuc?sort=popular" />
    </div>
  );
}
