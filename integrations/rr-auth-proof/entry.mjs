import { getStore } from '@netlify/blobs';
import { createAuthenticator, createHandler, createService } from './service.mjs';

export const config = { path: ['/api/rr-auth-proof', '/.well-known/oauth-protected-resource/api/rr-auth-proof'] };
const authenticate = createAuthenticator({ members: () => (process.env.RR_PROOF_ALLOWED_SUBJECTS ?? '').split(',').map(s => s.trim()).filter(Boolean) });
const store = {
  get: key => getStore({ name: 'rr-auth-proof-v1', consistency: 'strong' }).getWithMetadata(key, { type: 'json' }),
  async put(key, data, etag) {
    const result = await getStore({ name: 'rr-auth-proof-v1', consistency: 'strong' }).setJSON(key, data, etag === null ? { onlyIfNew: true } : { onlyIfMatch: etag });
    return result.modified;
  },
};
export default createHandler({ authenticate, run: createService(store) });
