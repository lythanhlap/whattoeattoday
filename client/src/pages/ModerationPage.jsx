import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { communityApi } from '../services/apiClient.js';
import { ErrorState, EmptyState, LoadingState } from '../features/recipes/RecipeStates.jsx';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { useDocumentMeta } from '../lib/useDocumentMeta.js';

function targetText(report) { return report.recipe?.title || report.comment?.content || 'Cooksnap image'; }
function targetAuthor(report) { return report.recipe?.author || report.comment?.author || report.cooksnap?.author || null; }

export function ModerationPage() {
  const { accessToken, user } = useAuth();
  const [state, setState] = useState({ status: 'loading', reports: [], error: null });
  const [auditLogs, setAuditLogs] = useState([]);
  const [workingId, setWorkingId] = useState(null);
  const [workingUser, setWorkingUser] = useState(null);
  const [message, setMessage] = useState(null);

  useDocumentMeta({ title: 'Kiểm duyệt nội dung | Bếp Nhà', description: 'Hàng đợi báo cáo và xử lý nội dung vi phạm.', noindex: true });

  const load = useCallback(async () => {
    try {
      setState({ status: 'loading', reports: [], error: null });
      const reports = await communityApi.reports(accessToken);
      setState({ status: 'success', reports, error: null });
      if (user?.role === 'ADMIN') setAuditLogs(await communityApi.auditLogs(accessToken));
    } catch (error) {
      setState({ status: 'error', reports: [], error });
    }
  }, [accessToken, user?.role]);

  useEffect(() => { load(); }, [load]);

  const resolve = async (id, action) => {
    setWorkingId(id); setMessage(null);
    try {
      await communityApi.resolveReport(id, { action }, accessToken);
      setMessage({ type: 'success', text: 'Đã xử lý báo cáo.' });
      await load();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally { setWorkingId(null); }
  };

  const warn = async (author) => {
    const text = window.prompt(`Nội dung cảnh báo gửi tới @${author.username}`);
    if (!text) return;
    setWorkingUser(author.id); setMessage(null);
    try {
      await communityApi.warnUser(author.id, text, accessToken);
      setMessage({ type: 'success', text: `Đã gửi cảnh báo tới @${author.username}.` });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally { setWorkingUser(null); }
  };

  const suspend = async (author) => {
    const daysInput = window.prompt(`Số ngày khóa tạm thời tài khoản @${author.username} (1-30)`, '7');
    if (!daysInput) return;
    const durationDays = Number(daysInput);
    if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 30) {
      setMessage({ type: 'error', text: 'Số ngày khóa phải là số nguyên từ 1 đến 30.' });
      return;
    }
    const reason = window.prompt('Lý do khóa tạm thời (ít nhất 5 ký tự)');
    if (!reason) return;
    setWorkingUser(author.id); setMessage(null);
    try {
      await communityApi.suspendUser(author.id, { durationDays, reason }, accessToken);
      setMessage({ type: 'success', text: `Đã khóa tạm thời @${author.username} trong ${durationDays} ngày.` });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally { setWorkingUser(null); }
  };

  if (state.status === 'loading') return <LoadingState label="Đang tải hàng đợi kiểm duyệt..." />;
  if (state.status === 'error') return <ErrorState error={state.error} onRetry={load} />;

  return (
    <section className="moderation-page">
      <p className="eyebrow">Kiểm duyệt</p>
      <h1>Hàng đợi báo cáo</h1>
      {message && <p className={message.type === 'error' ? 'form-error' : 'form-success'} role="status">{message.text}</p>}
      {state.reports.length ? (
        <div className="moderation-list">
          {state.reports.map((report) => {
            const author = targetAuthor(report);
            return (
              <article className="moderation-item" key={report.id}>
                <div>
                  <p className="recipe-category">{report.reason} · {report.recipe ? 'RECIPE' : report.comment ? 'COMMENT' : 'COOKSNAP'}</p>
                  <h2>{report.recipe ? <Link to={`/cong-thuc/${report.recipe.slug}`}>{targetText(report)}</Link> : targetText(report)}</h2>
                  <p>{report.description || 'Không có mô tả thêm.'}</p>
                  <small>Báo cáo bởi @{report.reporter.username}{author ? ` · tác giả @${author.username}` : ''}</small>
                  {author && (
                    <div className="moderation-user-actions">
                      <button className="text-button" type="button" disabled={workingUser === author.id || author.id === user?.id} onClick={() => warn(author)}>Cảnh báo tác giả</button>
                      <button className="text-button danger-text" type="button" disabled={workingUser === author.id || author.id === user?.id} onClick={() => suspend(author)}>Khóa tạm thời</button>
                    </div>
                  )}
                </div>
                <div className="moderation-actions">
                  <button className="secondary-button" type="button" disabled={workingId === report.id} onClick={() => resolve(report.id, 'DISMISS')}>Bỏ qua</button>
                  <button className="primary-button" type="button" disabled={workingId === report.id} onClick={() => resolve(report.id, 'HIDE')}>Ẩn nội dung</button>
                  <button className="secondary-button" type="button" disabled={workingId === report.id} onClick={() => resolve(report.id, 'RESTORE')}>Khôi phục</button>
                </div>
              </article>
            );
          })}
        </div>
      ) : <EmptyState title="Không có báo cáo đang mở"><p>Hàng đợi đã được xử lý.</p></EmptyState>}
      {user?.role === 'ADMIN' && (
        <section className="audit-section">
          <h2>Nhật ký hoạt động gần đây</h2>
          {auditLogs.length ? <ul className="audit-list">{auditLogs.map((log) => <li key={log.id}><strong>{log.action}</strong><span>{log.actor.username} · {log.targetType}</span></li>)}</ul> : <p>Chưa có hoạt động nào được ghi lại.</p>}
        </section>
      )}
    </section>
  );
}
