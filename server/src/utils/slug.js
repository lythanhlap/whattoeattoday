export function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 150) || 'recipe';
}

export function createRecipeSlug(title) {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${slugify(title)}-${suffix}`;
}
