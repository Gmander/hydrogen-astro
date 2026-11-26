// Fictional sample accounts. No production subjects, data or credential values.
import { identityKey } from './service.mjs';
export const accounts = {
  'sample-a': { athleteId: 'sample-alex', name: 'Alex' },
  'sample-b': { athleteId: 'sample-sam', name: 'Sam' },
};
export const sampleWorkout = {
  title: 'A little movement', date: '2026-11-26', status: 'planned', notes: 'Sample plan for trying the preview.',
  exercises: [
    { name: 'Wall sit', sets: [{ reps: null, seconds: 20, load: null, unit: null, loadMeaning: 'bodyweight', side: 'both' }] },
    { name: 'Lunges', sets: [{ reps: null, seconds: 30, load: null, unit: null, loadMeaning: 'bodyweight', side: 'per_side' }] },
  ],
};
export async function seedSamples(store) {
  for (const [sub, account] of Object.entries(accounts)) {
    // Insert-only seeding never overwrites preview edits or revocation tests.
    await store.put(identityKey(sub), { athleteId: account.athleteId, active: true }, null);
    const id = sub === 'sample-a' ? '11111111-1111-4111-8111-111111111111' : '22222222-2222-4222-8222-222222222222';
    const record = { ...sampleWorkout, id, title: sub === 'sample-a' ? 'A little movement' : 'Sam’s stretch break', revision: 1, updatedAt: '2026-11-26T12:00:00.000Z' };
    await store.put('accounts/' + account.athleteId, { profile: { name: account.name, equipment: [], synthetic: true }, workouts: { [id]: record }, operations: {} }, null);
  }
}
