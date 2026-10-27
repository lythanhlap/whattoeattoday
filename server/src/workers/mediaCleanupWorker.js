import { cleanupOrphanMediaAssets } from '../services/mediaService.js';

cleanupOrphanMediaAssets()
  .then((result) => { console.log(JSON.stringify({ worker: 'media-cleanup', ...result })); process.exitCode = 0; })
  .catch((error) => { console.error(error); process.exitCode = 1; });
