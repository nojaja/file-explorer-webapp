import dotenv from 'dotenv';

// .env を読み込む
dotenv.config();

export function getBaseUrl() {
  const port = process.env.PORT || '3000';
  const base = process.env.BASE_URL || `http://localhost:${port}`;
  const webRoot = (process.env.WEB_ROOT_PATH || '').replace(/^\//, '').replace(/\/$/, '');
  if (!webRoot) return base;
  // Use URL constructor to safely join host and webRoot without mangling the protocol
  return base + '/' + webRoot  + '/';
}
