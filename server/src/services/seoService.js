import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';

const SITEMAP_PAGE_SIZE = 40000;
const SITEMAP_CACHE_TTL_MS = env.nodeEnv === 'test' ? 0 : 5 * 60 * 1000;
let sitemapCache = { expiresAt: 0, entries: [] };

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function urlset(entries) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.map((entry) => `  <url><loc>${escapeXml(entry.loc)}</loc><lastmod>${entry.lastmod}</lastmod><changefreq>${entry.changefreq}</changefreq><priority>${entry.priority}</priority></url>`).join('\n')}\n</urlset>\n`;
}

async function loadEntries() {
  if (sitemapCache.expiresAt > Date.now()) return sitemapCache.entries;
  const base = env.publicSiteUrl.replace(/\/$/, '');
  const [recipes, challenges] = await prisma.$transaction([
    prisma.recipe.findMany({
      where: {
        status: 'PUBLISHED', visibility: 'PUBLIC', deletedAt: null, hiddenAt: null,
        author: { status: 'ACTIVE', deletedAt: null },
      },
      select: { slug: true, updatedAt: true },
      orderBy: { publishedAt: 'desc' },
    }),
    prisma.challenge.findMany({
      where: { status: { notIn: ['DRAFT', 'ARCHIVED'] } },
      select: { id: true, updatedAt: true },
      orderBy: { startsAt: 'desc' },
    }),
  ]);

  const staticUrls = ['/', '/cong-thuc', '/thu-thach'];
  const entries = [
    ...staticUrls.map((path) => ({ loc: `${base}${path}`, lastmod: new Date().toISOString().slice(0, 10), changefreq: 'daily', priority: path === '/' ? '1.0' : '0.8' })),
    ...recipes.map((recipe) => ({ loc: `${base}/cong-thuc/${encodeURIComponent(recipe.slug)}`, lastmod: recipe.updatedAt.toISOString().slice(0, 10), changefreq: 'weekly', priority: '0.7' })),
    ...challenges.map((challenge) => ({ loc: `${base}/thu-thach/${challenge.id}`, lastmod: challenge.updatedAt.toISOString().slice(0, 10), changefreq: 'weekly', priority: '0.6' })),
  ];
  sitemapCache = { expiresAt: Date.now() + SITEMAP_CACHE_TTL_MS, entries };
  return entries;
}

export async function buildSitemap() {
  const entries = await loadEntries();
  if (entries.length <= SITEMAP_PAGE_SIZE) return urlset(entries);
  const base = env.publicSiteUrl.replace(/\/$/, '');
  const today = new Date().toISOString().slice(0, 10);
  const pages = Math.ceil(entries.length / SITEMAP_PAGE_SIZE);
  const children = Array.from({ length: pages }, (_, index) => `  <sitemap><loc>${escapeXml(`${base}/sitemap-${index + 1}.xml`)}</loc><lastmod>${today}</lastmod></sitemap>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${children}\n</sitemapindex>\n`;
}

export async function buildSitemapPage(page) {
  const entries = await loadEntries();
  const totalPages = Math.max(1, Math.ceil(entries.length / SITEMAP_PAGE_SIZE));
  if (!Number.isInteger(page) || page < 1 || page > totalPages) return null;
  return urlset(entries.slice((page - 1) * SITEMAP_PAGE_SIZE, page * SITEMAP_PAGE_SIZE));
}

export function clearSitemapCache() {
  sitemapCache = { expiresAt: 0, entries: [] };
}

export function buildRobots() {
  const base = env.publicSiteUrl.replace(/\/$/, '');
  return `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /moderation\nDisallow: /tai-khoan\nSitemap: ${base}/sitemap.xml\n`;
}
