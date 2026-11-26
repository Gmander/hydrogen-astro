import {z} from 'zod';
const label = z.string().trim().min(1).max(160);
const set = z.object({
  reps: z.number().int().min(0).max(10000).nullable().default(null),
  seconds: z.number().min(0).max(86400).nullable().default(null),
  load: z.number().min(0).max(10000).nullable().default(null),
  unit: z.enum(['lb', 'kg']).nullable().default(null),
  loadMeaning: z.enum(['per_hand', 'total', 'bodyweight', 'assistance', 'unspecified']).default('unspecified'),
  side: z.enum(['both', 'left', 'right', 'per_side', 'unspecified']).default('unspecified'),
}).strict().refine(s => s.load === null || s.unit !== null, 'A recorded load requires a unit');
export const workoutSchema = z.object({
  title: label,
  status: z.enum(['planned', 'completed']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => { const d = new Date(v); return !isNaN(d) && d.toISOString().slice(0,10) === v; }, 'Invalid date'),
  notes: z.string().max(3000).default(''),
  exercises: z.array(z.object({ name: label, sets: z.array(set).max(100) }).strict()).min(1).max(50),
}).strict();
export const schemas = {
  get_profile: z.object({}).strict(),
  list_workouts: z.object({}).strict(),
  get_workout: z.object({ id: z.string().uuid() }).strict(),
  create_workout: z.object({ operationId: z.string().uuid(), workout: workoutSchema }).strict(),
  update_workout: z.object({ operationId: z.string().uuid(), id: z.string().uuid(), expectedRevision: z.number().int().positive(), workout: workoutSchema }).strict(),
  delete_workout: z.object({ operationId: z.string().uuid(), id: z.string().uuid(), expectedRevision: z.number().int().positive() }).strict(),
};
export const descriptions = {
  get_profile: 'Read the authenticated athlete profile and equipment. Never choose another athlete.',
  list_workouts: 'Read up to 100 most recent workouts for the authenticated athlete, including revision numbers.',
  get_workout: 'Read one owned workout and its current revision before editing.',
  create_workout: 'Create a planned workout OR completed log as explicitly described by the user. Match date and status to intent. Ask about consequential ambiguities; leave unknown reps/load/duration null. Do not infer completion. Generate one operationId per intent and reuse it on retries.',
  update_workout: 'Correct an owned record using its latest expectedRevision. Supply the complete replacement workout, preserving unchanged fields. On conflict fetch and reconcile; never blindly overwrite. Reuse operationId on retries.',
  delete_workout: 'Delete an explicitly identified owned workout at expectedRevision. Confirm ambiguous targets. Returns a receipt. Reuse operationId on retries.',
};
