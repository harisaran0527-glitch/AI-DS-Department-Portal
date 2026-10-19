import app from '../server/index.js';

export default function handler(req: any, res: any) {
  if (req.url && !req.url.startsWith('/api')) {
    const forwardedUri = req.headers['x-forwarded-uri'] || req.headers['x-matched-path'];
    if (typeof forwardedUri === 'string' && forwardedUri.startsWith('/api')) {
      req.url = forwardedUri;
    } else {
      req.url = `/api${req.url.startsWith('/') ? '' : '/'}${req.url}`;
    }
  }
  return app(req, res);
}
