import { listAuditLogs } from '../services/moderationService.js';
import { applyContentAction, bulkContentAction, contentDashboard, contentStats, listContent, listUsers, setRecipeFeatured, suspendUser, updateUser, validateUserUpdate, warnUser } from '../services/adminService.js';
import { validateBulkContentAction, validateContentAction, validateContentQuery, validateSuspendInput } from '../validators/adminValidator.js';

export async function listUsersController(request, response, next) { try { const result = await listUsers(request.query); response.json({ data: result.items, meta: result.meta, error: null }); } catch (error) { next(error); } }
export async function updateUserController(request, response, next) { try { const user = await updateUser(request.auth.userId, request.params.id, validateUserUpdate(request.body)); response.json({ data: { user }, meta: {}, error: null }); } catch (error) { next(error); } }
export async function adminAuditLogsController(request, response, next) { try { const result = await listAuditLogs(request.query); response.json({ data: result.items, meta: result.meta, error: null }); } catch (error) { next(error); } }
export async function warnUserController(request, response, next) { try { const notification = await warnUser(request.auth.userId, request.params.id, request.body.message); response.status(201).json({ data: { notification }, meta: {}, error: null }); } catch (error) { next(error); } }
export async function suspendUserController(request, response, next) { try { const user = await suspendUser(request.auth.userId, request.auth.role, request.params.id, validateSuspendInput(request.body)); response.json({ data: { user }, meta: {}, error: null }); } catch (error) { next(error); } }
export async function contentStatsController(_request, response, next) { try { response.json({ data: await contentStats(), meta: {}, error: null }); } catch (error) { next(error); } }
export async function featureRecipeController(request, response, next) { try { const recipe = await setRecipeFeatured(request.auth.userId, request.params.id, request.body.featured === true); response.json({ data: { recipe }, meta: {}, error: null }); } catch (error) { next(error); } }
export async function contentDashboardController(_request, response, next) { try { response.json({ data: await contentDashboard(), meta: {}, error: null }); } catch (error) { next(error); } }

export async function listContentController(request, response, next) {
  try {
    const result = await listContent(validateContentQuery(request.query));
    response.json({ data: result.items, meta: result.meta, error: null });
  } catch (error) { next(error); }
}

export async function contentActionController(request, response, next) {
  try {
    const result = await applyContentAction(request.auth.userId, request.params.type, request.params.id, validateContentAction(request.body));
    response.json({ data: result, meta: {}, error: null });
  } catch (error) { next(error); }
}

export async function bulkContentActionController(request, response, next) {
  try {
    const result = await bulkContentAction(request.auth.userId, validateBulkContentAction(request.body));
    response.json({ data: result, meta: { changed: result.changed }, error: null });
  } catch (error) { next(error); }
}
