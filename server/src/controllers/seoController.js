import { buildRobots, buildSitemap, buildSitemapPage } from '../services/seoService.js';

export async function sitemapController(_request, response, next) {
  try {
    response.type('application/xml').send(await buildSitemap());
  } catch (error) { next(error); }
}

export async function sitemapPageController(request, response, next) {
  try {
    const xml = await buildSitemapPage(Number(request.params.page));
    if (!xml) {
      const error = new Error('Sitemap page not found');
      error.statusCode = 404;
      error.code = 'SITEMAP_PAGE_NOT_FOUND';
      throw error;
    }
    response.type('application/xml').send(xml);
  } catch (error) { next(error); }
}

export function robotsController(_request, response) {
  response.type('text/plain').send(buildRobots());
}
