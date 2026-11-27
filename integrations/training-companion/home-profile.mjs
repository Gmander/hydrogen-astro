import {z} from 'zod';
import {identityKey} from './service.mjs';
const equipment=z.object({name:z.string().trim().min(1).max(160),quantity:z.number().int().min(1).max(100).nullable().default(null),load:z.number().min(0).max(10000).nullable().default(null),unit:z.enum(['lb','kg']).nullable().default(null)}).strict().refine(e=>e.load===null||e.unit!==null);
const configSchema=z.object({members:z.array(z.object({subject:z.string().min(1).max(200),name:z.string().trim().min(1).max(80)}).strict()).min(1).max(10),equipment:z.array(equipment).max(100)}).strict();
// Admin-managed shared inventory. Membership is still checked by the normal authenticator.
// No other household member identifiers or names are returned to callers.
export function homeProfile(value,identity){
 if(!value)return null;
 const config=configSchema.parse(JSON.parse(value));
 const member=config.members.find(m=>'athlete-'+identityKey(m.subject).slice('members/'.length)===identity.athleteId);
 return member?{name:member.name,equipment:config.equipment,equipmentSource:'shared_home'}:null;
}
