import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const db=new PGlite(),manager='00000000-0000-0000-0000-000000000001',outsider='00000000-0000-0000-0000-000000000002';
await db.exec(`create role anon;create role authenticated;create schema auth;
create table auth.users(id uuid primary key,email text);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to anon,authenticated;
grant execute on function auth.uid() to anon,authenticated;
insert into auth.users values('${manager}','manager@example.test'),('${outsider}','outsider@example.test');`);
for(const name of ['202611180001_bakery_cloud.sql','202611180002_shared_testing.sql'])await db.exec(readFileSync(new URL('supabase/migrations/'+name,import.meta.url),'utf8'));
const records={items:[{id:0,name:'Bread'}],tx:[{item:0,qty:5,type:'count'}],sales:[],orders:[],weeklyPlans:{'2026-11-23':{assignments:{'r-1':'Wed'},added:[{id:'t-test',name:'Task'}]}},auditLog:[{id:'previous',action:'plan.move'}]};
await db.query('update public.erp_preview_state set data=$1::jsonb,version=7',[JSON.stringify(records)]);
const template=readFileSync(new URL('supabase/manual/enable-staff-access.sql',import.meta.url),'utf8');
await assert.rejects(db.exec(template),/management email was not found/);await db.exec('rollback');
assert.equal((await db.query('select data from public.erp_state')).rows[0].data,null);
assert.equal((await db.query('select * from public.erp_members')).rows.length,0);
const migration=template.replace('MANAGER_EMAIL_HERE\'','manager@example.test\'');
await db.exec(migration);
const protectedRow=(await db.query('select * from public.erp_state')).rows[0];
assert.deepEqual(protectedRow.data,records);assert.equal(protectedRow.updated_by,manager);
assert.deepEqual((await db.query('select data from public.erp_preview_state')).rows[0].data,records);
async function as(role,id=''){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role '+role);}
for(const role of ['anon','authenticated']){
 await as(role,outsider);
 await assert.rejects(db.query('select * from public.erp_preview_state'),/permission denied/);
 await assert.rejects(db.query('select public.erp_preview_save($1::jsonb,7)',[JSON.stringify(records)]),/permission denied/);
}
await as('anon');await assert.rejects(db.query('select * from public.erp_state'),/permission denied/);
await as('authenticated',outsider);assert.equal((await db.query('select * from public.erp_state')).rows.length,0);
await as('authenticated',manager);assert.deepEqual((await db.query('select data from public.erp_state')).rows[0].data,records);
await as('authenticated',manager);const changed={...records,weeklyPlans:{'2026-11-23':{assignments:{'r-1':'Fri'}}}};
await db.query('select public.erp_save($1::jsonb,$2::bigint)',[JSON.stringify(changed),protectedRow.version]);
await db.exec('reset role');
await assert.rejects(db.exec(migration),/already contains different data/);await db.exec('rollback');
assert.deepEqual((await db.query('select data from public.erp_state')).rows[0].data,changed);
await db.close();console.log('Staff cutover passed: exact data/history preservation, missing-account rollback, public read/write closure, approved-user access, and conflicting-data protection.');
