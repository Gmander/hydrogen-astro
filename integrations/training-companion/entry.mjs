import {homeProfile} from './home-profile.mjs';
import { getStore } from '@netlify/blobs';
import { createAuthenticator, createOperations, createActivation } from './service.mjs';
import { createHandler } from './http.mjs';
export const config = { path: ['/api/training/*', '/.well-known/oauth-protected-resource/api/training/mcp'] };
// Fixed isolated preview namespace; never read the proof namespace or Sites D1.
const blobs = () => getStore({ name: 'training-companion-preview-v1', consistency: 'strong' });
const store = {
  get: key => blobs().getWithMetadata(key, { type: 'json' }),
  async put(key, value, etag) {
    return (await blobs().setJSON(key, value, etag === null ? { onlyIfNew: true } : { onlyIfMatch: etag })).modified;
  },
};
export default createHandler({ authenticate: createAuthenticator(store), run: createOperations(store, {profileFor:identity=>homeProfile(process.env.TRAINING_HOME_PROFILE,identity)}),
  activate: createActivation(store, { invited: () => (process.env.TRAINING_INVITED_SUBJECTS ?? '').split(',').map(value => value.trim()).filter(Boolean) }),
  origin: 'https://runtimeready.com', clientId: process.env.TRAINING_AUTH0_CLIENT_ID ?? '' });
