const UPLOAD_MARKER = '/image/upload/';

export function optimizedImageUrl(url, { width, height, crop = 'fill' } = {}) {
  if (typeof url !== 'string' || !url) return url;
  const markerIndex = url.indexOf(UPLOAD_MARKER);
  if (markerIndex === -1) return url;
  const prefix = url.slice(0, markerIndex + UPLOAD_MARKER.length);
  const path = url.slice(markerIndex + UPLOAD_MARKER.length);
  if (/(^|,)(f_auto|q_auto)/.test(path.split('/')[0])) return url;

  const transforms = ['f_auto', 'q_auto'];
  if (width) transforms.push(`w_${Math.round(width)}`);
  if (height) transforms.push(`h_${Math.round(height)}`);
  if (crop && width && height) transforms.push(`c_${crop}`);
  return `${prefix}${transforms.join(',')}/${path}`;
}
