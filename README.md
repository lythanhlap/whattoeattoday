# Recipe Community Platform

Nền tảng cộng đồng chia sẻ công thức nấu ăn.

## Stack

- Frontend: React + Vite + JavaScript.
- Backend: Node.js + Express.js + JavaScript.
- Database: PostgreSQL + Prisma.
- Media: Cloudinary signed upload, metadata trong `media_assets`.
- Cache/rate limit: Redis (fallback in-memory khi Redis không khả dụng).

## Yêu cầu

- Node.js 20 trở lên.
- npm 10 trở lên.
- Docker Desktop nếu muốn chạy PostgreSQL/Redis local.

## Cài đặt

```bash
npm install
```

Tạo file môi trường local:

```bash
copy client\.env.example client\.env
copy server\.env.example server\.env
```

Trên macOS/Linux:

```bash
cp client/.env.example client/.env
cp server/.env.example server/.env
```

Không commit file `.env` hoặc secret thật.

## Khởi động hạ tầng

```bash
docker compose up -d postgres redis
```

## Database

```bash
npm run prisma:generate
npm run prisma:validate
npm run prisma:migrate
npm run prisma:seed
```

Seed tạo category, tag, recipe mẫu, user `seed@bepnha.local` (role `EDITOR`) và một thử thách đang diễn ra.

`PUBLIC_SITE_URL` (mặc định lấy `CORS_ORIGIN`) được dùng để tạo canonical URL, `sitemap.xml` và `robots.txt`. Đặt biến này bằng domain thật khi deploy.

## Chạy ứng dụng

Backend:

```bash
npm run dev:server
```

- API: `http://localhost:3000/api/v1`
- Health: `GET /api/v1/health`
- Redis health: `GET /api/v1/health/redis`

Frontend:

```bash
npm run dev:client
```

- Web: `http://localhost:5173`

## Kiểm tra

```bash
npm run lint
npm run build
npm test
npm run test:redis
npm run prisma:validate
```

`npm test` dùng `server/.env.example` và `server/test.env`. File test tắt Redis để rate limit chạy trong từng process test, tránh chia sẻ counter giữa các file test chạy song song.

`npm run test:redis` là integration test riêng, cần Docker Redis đang chạy. Test kiểm tra kết nối, phiên bản, bộ nhớ và eviction policy `allkeys-lru`. Có thể đổi đích bằng biến môi trường `REDIS_URL`.

## Chức năng chính

### Người dùng

- Đăng ký, đăng nhập, đăng xuất, refresh token rotation.
- Hồ sơ public, avatar, bio, follower/following.
- Hồ sơ cá nhân, bookmark, collection, notification center.
- Sửa hồ sơ (tên hiển thị, username, bio, avatar upload) và đổi mật khẩu; đổi mật khẩu thu hồi các refresh token khác.
- Trang tài khoản có tab hồ sơ, mật khẩu, công thức của tôi và kho đã lưu.

### Công thức

- Tạo draft, sửa, gửi duyệt, publish theo quyền.
- Nguyên liệu, bước nấu, category, tag, ảnh cover reference.
- Quy trình biên tập: thành viên gửi duyệt → editor/admin duyệt, từ chối hoặc yêu cầu chỉnh sửa; tác giả nhận thông báo và ghi chú; mọi thao tác ghi audit log.
- Editor/admin gắn hoặc bỏ trạng thái nổi bật cho công thức.
- Trang list/detail responsive, loading/empty/error/not-found state.
- Tìm kiếm tiếng Việt có dấu/không dấu bằng full-text + `pg_trgm` + `unaccent`.
- Filter category, tag, thời gian nấu, có cooksnap, nguyên liệu và chế độ ăn (`mon-chay`, `thuan-chay`, `eat-clean`, `khong-gluten`, `khong-sua`); sort mới nhất/phổ biến/nhiều cooksnap; pagination.
- Đổi số khẩu phần trên UI, scale định lượng số; giữ nguyên “vừa đủ”, “tùy khẩu vị”.
- In công thức và chia sẻ đường dẫn.
- Đếm lượt xem hợp lệ: một viewer mỗi ngày cho mỗi recipe, lưu `recipe_views` và tăng `viewCount` atomic.
- SEO: URL slug, title/description/Open Graph, canonical, Recipe structured data (`application/ld+json`), `sitemap.xml`, `robots.txt`.
- Sitemap có cache ngắn hạn và tự chuyển sang `sitemap.xml` dạng index với các trang `/sitemap-:page.xml` khi vượt 40.000 URL.
- Trang chủ có section biên tập nổi bật, mới nhất, món chay, eat clean, nhiều cooksnap, được lưu nhiều và từ khóa thịnh hành.

### Cộng đồng

- Bookmark và bộ sưu tập public/private.
- Cooksnap với upload Cloudinary signed.
- Bình luận có soft delete và rate limit.
- Follow/unfollow và feed trộn recipe/cooksnap.
- Thử thách: editor/admin tạo, user gửi recipe public của mình, chống trùng, chặn khi hết hạn, moderator gỡ entry có audit log.

### Moderation và Admin

- Report recipe/comment/cooksnap.
- Moderation queue, dismiss/hide/restore, audit log.
- Hàng đợi duyệt công thức và quản lý danh mục/tag cho editor/admin tại `/bien-tap`.
- Admin quản lý user, role/status, warning, content dashboard.
- Admin có bảng quản lý công thức/bình luận/cooksnap, lọc theo trạng thái, tìm kiếm, ẩn/khôi phục/xóa mềm và thao tác hàng loạt.
- Moderator/Admin gửi cảnh báo và khóa tạm thời tài khoản thành viên (1-30 ngày); tài khoản tự kích hoạt lại khi hết hạn, mọi thao tác có notification và audit log.
- Soft delete cho User, Recipe, Cooksnap, Comment.

## API chính

Tất cả API dùng prefix `/api/v1` và response dạng `{ data, meta, error }`.

```text
POST   /auth/register
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout
GET    /auth/me
POST   /auth/change-password

GET    /recipes
POST   /recipes
GET    /recipes/:slug
PATCH  /recipes/:id
DELETE /recipes/:id
POST   /recipes/:id/publish
POST   /recipes/:id/view

GET    /categories
GET    /tags
POST   /categories
PATCH  /categories/:id
DELETE /categories/:id
POST   /tags
PATCH  /tags/:id
DELETE /tags/:id
GET    /trending-keywords
GET    /sitemap.xml
GET    /sitemap-:page.xml
GET    /robots.txt

PATCH  /me/profile

POST   /recipes/:id/bookmark
DELETE /recipes/:id/bookmark
GET    /me/bookmarks
GET    /me/collections
GET    /collections/:id
POST   /collections
PATCH  /collections/:id
DELETE /collections/:id

GET    /recipes/:id/cooksnaps
POST   /recipes/:id/cooksnaps
DELETE /cooksnaps/:id
GET    /recipes/:id/comments
POST   /recipes/:id/comments
DELETE /comments/:id

POST   /users/:id/follow
DELETE /users/:id/follow
GET    /users/:username
GET    /me/feed

GET    /challenges
GET    /challenges/:id
POST   /challenges
PATCH  /challenges/:id
DELETE /challenges/:id
POST   /challenges/:id/entries
DELETE /challenges/:id/entries/:entryId

POST   /recipes/:id/report
POST   /moderation/:targetType/:id/report
GET    /moderation/reports
POST   /moderation/reports/:id/resolve
GET    /moderation/audit-logs
GET    /moderation/review-queue
POST   /moderation/recipes/:id/review
PATCH  /moderation/recipes/:id/featured
POST   /moderation/users/:id/warn
POST   /moderation/users/:id/suspend

GET    /admin/users
PATCH  /admin/users/:id
POST   /admin/users/:id/warn
POST   /admin/users/:id/suspend
GET    /admin/audit-logs
GET    /admin/content-stats
GET    /admin/content
POST   /admin/content/bulk
POST   /admin/content/:type/:id/action
GET    /admin/content-dashboard

POST   /media/signature
GET    /me/notifications
PATCH  /me/notifications/:id/read
POST   /me/notifications/read-all
```

## Cấu trúc

```text
client/
  src/
    app/ components/ features/ hooks/ layouts/ lib/ pages/ routes/ services/ styles/ utils/
server/
  src/
    config/ controllers/ middlewares/ routes/ services/ validators/ workers/
  prisma/
    schema.prisma
    migrations/
    seed.js
  test/
```

## Quy ước

- Mọi thay đổi schema đi qua Prisma migration; không dùng `db push` cho production.
- Không lưu binary ảnh trong PostgreSQL.
- Kiểm tra authentication, permission và ownership ở backend.
- API lỗi trả `error.code` ổn định.
- Frontend không dùng mock data sau khi API đã có.
