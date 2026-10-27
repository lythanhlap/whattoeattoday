import { createCategory, createTag, deleteCategory, deleteTag, listCategories, listTags, updateCategory, updateTag } from '../services/taxonomyService.js';
import { validateTaxonomyInput } from '../validators/editorialValidator.js';

export async function listCategoriesController(_request, response, next) {
  try { response.json({ data: await listCategories(), meta: {}, error: null }); } catch (error) { next(error); }
}

export async function listTagsController(_request, response, next) {
  try { response.json({ data: await listTags(), meta: {}, error: null }); } catch (error) { next(error); }
}

export async function createCategoryController(request, response, next) {
  try { response.status(201).json({ data: { category: await createCategory(validateTaxonomyInput(request.body)) }, meta: {}, error: null }); } catch (error) { next(error); }
}

export async function updateCategoryController(request, response, next) {
  try { response.json({ data: { category: await updateCategory(request.params.id, validateTaxonomyInput(request.body, { partial: true })) }, meta: {}, error: null }); } catch (error) { next(error); }
}

export async function deleteCategoryController(request, response, next) {
  try { await deleteCategory(request.params.id); response.status(204).send(); } catch (error) { next(error); }
}

export async function createTagController(request, response, next) {
  try { response.status(201).json({ data: { tag: await createTag(validateTaxonomyInput(request.body)) }, meta: {}, error: null }); } catch (error) { next(error); }
}

export async function updateTagController(request, response, next) {
  try { response.json({ data: { tag: await updateTag(request.params.id, validateTaxonomyInput(request.body, { partial: true })) }, meta: {}, error: null }); } catch (error) { next(error); }
}

export async function deleteTagController(request, response, next) {
  try { await deleteTag(request.params.id); response.status(204).send(); } catch (error) { next(error); }
}
