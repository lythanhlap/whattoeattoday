import { Link } from 'react-router-dom';
import { optimizedImageUrl } from '../../utils/image.js';

export function RecipeCard({ recipe }) {
  const coverUrl = optimizedImageUrl(recipe.coverImage?.secureUrl, { width: 640, height: 420 });
  return (
    <article className="recipe-card">
      {coverUrl ? (
        <img
          className="recipe-card-image"
          src={coverUrl}
          alt={`Ảnh món ${recipe.title}`}
          loading="lazy"
          width="640"
          height="420"
        />
      ) : (
        <div className="recipe-card-image recipe-card-placeholder" aria-hidden="true">
          {recipe.category?.name?.slice(0, 1) || recipe.title?.slice(0, 1) || 'M'}
        </div>
      )}
      <div className="recipe-card-body">
        <p className="recipe-category">{recipe.category?.name || 'Công thức nhà làm'}</p>
        <h2><Link to={`/cong-thuc/${recipe.slug}`}>{recipe.title}</Link></h2>
        <p>{recipe.description || 'Một công thức dễ làm cho bữa cơm gia đình.'}</p>
        <div className="recipe-card-meta">
          <span>{recipe.totalTimeMinutes ? `${recipe.totalTimeMinutes} phút` : 'Linh hoạt'}</span>
          <span>{recipe.difficulty === 'HARD' ? 'Nâng cao' : recipe.difficulty === 'MEDIUM' ? 'Trung bình' : 'Dễ làm'}</span>
        </div>
        <div className="recipe-card-social">
          <span>{recipe.saveCount ?? 0} lượt lưu</span>
          <span>{recipe.cookSnapCount ?? 0} ảnh đã nấu</span>
        </div>
      </div>
    </article>
  );
}
