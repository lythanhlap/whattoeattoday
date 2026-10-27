export const READABLE_VISIBILITIES = ['PUBLIC', 'UNLISTED'];

export const readableRecipeWhere = {
  status: 'PUBLISHED',
  visibility: { in: READABLE_VISIBILITIES },
  deletedAt: null,
  hiddenAt: null,
  author: { status: 'ACTIVE', deletedAt: null },
};

export function isReadableRecipe(recipe) {
  return Boolean(recipe)
    && recipe.status === 'PUBLISHED'
    && READABLE_VISIBILITIES.includes(recipe.visibility)
    && !recipe.deletedAt
    && !recipe.hiddenAt
    && recipe.author?.status === 'ACTIVE';
}
