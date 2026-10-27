import { listNotifications, markAllNotificationsRead, markNotificationRead } from '../services/notificationService.js';

export async function listNotificationsController(request, response, next) { try { const result = await listNotifications(request.auth.userId, request.query); response.json({ data: result.items, meta: result.meta, error: null }); } catch (error) { next(error); } }
export async function markNotificationReadController(request, response, next) { try { await markNotificationRead(request.auth.userId, request.params.id); response.status(204).send(); } catch (error) { next(error); } }
export async function markAllNotificationsReadController(request, response, next) { try { await markAllNotificationsRead(request.auth.userId); response.status(204).send(); } catch (error) { next(error); } }
