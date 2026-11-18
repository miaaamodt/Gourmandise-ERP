import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create schema auth;
  create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
  $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  grant usage on schema auth to authenticated,anon;
  grant execute on function auth.uid() to authenticated,anon;
  insert into auth.users values
  ('00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000003');`);
await db.exec(readFileSync(new URL('supabase/migrations/202611180001_bakery_cloud.sql',import.meta.url),'utf8'));
await db.exec(`insert into public.erp_members values
 ('00000000-0000-0000-0000-000000000001','management'),
 ('00000000-0000-0000-0000-000000000002','employee');`);
async function as(role,id='') {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
  await db.exec('set role '+role);
}
const manager='00000000-0000-0000-0000-000000000001', employee='00000000-0000-0000-0000-000000000002';
const state={items:[{id:0,name:'Bread'}],tx:[],sales:[],orders:[]};
const save=(data,v)=>db.query('select public.erp_save($1::jsonb,$2::bigint) result',[JSON.stringify(data),v]);
await as('anon');
await assert.rejects(db.query('select * from public.erp_state'),/permission denied/);
await assert.rejects(save(state,0),/permission denied/);
await as('authenticated','00000000-0000-0000-0000-000000000003');
assert.equal((await db.query('select * from public.erp_state')).rows.length,0);
await assert.rejects(save(state,0),/Staff access required/);
await assert.rejects(db.query("insert into public.erp_members values(auth.uid(),'management')"),/permission denied/);
await as('authenticated',employee);
await assert.rejects(save(state,0),/Management must initialize/);
await as('authenticated',manager);
assert.equal((await save(state,0)).rows[0].result.version,1);
await assert.rejects(save(state,0),/ERP_CONFLICT/);
await assert.rejects(save(null,1),/Invalid bakery data/);
await as('authenticated',employee);
await assert.rejects(db.query("update public.erp_state set version=99"),/permission denied/);
await assert.rejects(save({...state,items:[{id:0,name:'Changed'}]},1),/Employees may only/);
let next={...state,tx:[{item:0,qty:10,type:'prod',loc:'Main Fridge',t:'fake',actor_id:manager,u:'Name'}]};
let row=(await save(next,1)).rows[0].result;
assert.equal(row.data.tx[0].actor_id,employee);
assert.notEqual(row.data.tx[0].t,'fake');
assert.equal(row.version,2);
await assert.rejects(save(state,2),/Invalid transaction append/);
await assert.rejects(save({...row.data,tx:[{...row.data.tx[0],qty:20}]},2),/Existing transactions/);
await assert.rejects(save({...row.data,tx:[...row.data.tx,{item:0,qty:null,type:'prod',loc:'Main Fridge'}]},2),/Invalid inventory/);
await assert.rejects(save({...row.data,tx:[...row.data.tx,{item:4,qty:1,type:'prod',loc:'Main Fridge'}]},2),/Invalid transaction quantity/);
await assert.rejects(save({...row.data,tx:[...row.data.tx,{item:0,qty:1,type:'take',loc:'Main Fridge'}]},2),/Invalid transaction quantity/);
row=(await save({...row.data,tx:[...row.data.tx,{item:0,qty:-2,type:'take',loc:'Main Fridge'}]},2)).rows[0].result;
assert.equal(row.version,3);
await as('authenticated',manager);
await db.exec(`reset role; delete from public.erp_members where user_id='${employee}';`);
await as('authenticated',employee);
assert.equal((await db.query('select * from public.erp_state')).rows.length,0);
await assert.rejects(save(row.data,3),/Staff access required/);
await db.close();
console.log('Database tests passed: staff access, role restrictions, validation, audit fields, concurrency, and revocation.');
