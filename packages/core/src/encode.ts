import { gzipSync, gunzipSync } from 'node:zlib';
export const gzipBase64 = (s: string) => gzipSync(Buffer.from(s, 'utf8')).toString('base64');
export const gunzipBase64 = (s: string) => gunzipSync(Buffer.from(s, 'base64')).toString('utf8');
