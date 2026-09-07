// Integration test: disposable Postgres + two independent Chromium profiles.
// npm install --prefix /tmp/stonksu-sync-tools pg playwright
// SIMULATOR_TEST_TOOLS=/tmp/stonksu-sync-tools TEST_DATABASE_URL=postgresql://.../stonksu_simulator_test node scripts/test-simulator-sync.mjs
// Vite must run on port 5174 with VITE_SUPABASE_URL=http://127.0.0.1:59999 and VITE_SUPABASE_ANON_KEY=test.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(`${process.env.SIMULATOR_TEST_TOOLS}/package.json`);
const { Pool } = require('pg');
const { chromium } = require('playwright');
const url = process.env.TEST_DATABASE_URL;
assert.equal(new URL(url).pathname, '/stonksu_simulator_test', 'Use the dedicated disposable test database');
const pool = new Pool({ connectionString: url });
const uid = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
await pool.query(`
  create schema if not exists auth;
  create or replace function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
  drop table if exists public.profiles cascade;
  create table public.profiles (id uuid primary key, coins integer not null default 1000);
  insert into public.profiles (id) values ('${uid}'), ('${other}');
`);
const migration = await readFile('supabase/migrations/0016_simulator_sync.sql', 'utf8');
await pool.query(migration);
await pool.query(migration); // Rerunnable from SQL Editor.
async function rpc(name, args = {}, user = uid) {
  const c = await pool.connect();
  try {
    await c.query('begin');
    await c.query("select set_config('request.jwt.claim.sub',$1,true)", [user]);
    await c.query('set local role authenticated');
    const result = name === 'simulator_read'
      ? await c.query('select public.simulator_read() as data')
      : await c.query('select public.simulator_commit($1,$2,$3) as data', [args.expected_revision, args.next_state, args.coin_delta ?? 0]);
    await c.query('commit');
    return result.rows[0].data;
  } catch (e) { await c.query('rollback'); throw e; }
  finally { c.release(); }
}
const empty = { openTrade: null, pendingOrder: null, tradeHistory: [], tradeDay: null, tradesToday: 0 };
const trade = { direction: 'long', leverage: 10, margin: 100, entry: 50000, openedAt: Date.now(), mode: 'isolated', wallet: 1000, orderType: 'market' };
const next = { ...empty, openTrade: trade, tradeDay: '2026-09-07', tradesToday: 1 };
const race = await Promise.all([rpc('simulator_commit', { expected_revision: 0, next_state: next }), rpc('simulator_commit', { expected_revision: 0, next_state: next })]);
assert.equal(race.filter(r => r.accepted).length, 1, 'Only one device may open');
assert.equal((await rpc('simulator_read', {}, other)).state, null, 'Accounts are isolated');
await assert.rejects(rpc('simulator_commit', { expected_revision: 0, next_state: next }, ''), /Authentication required/);
const closed = { ...next, openTrade: null, tradeHistory: [{ id: 'one-close' }] };
const closeRace = await Promise.all([rpc('simulator_commit', { expected_revision: 1, next_state: closed, coin_delta: 25 }), rpc('simulator_commit', { expected_revision: 1, next_state: closed, coin_delta: 25 })]);
assert.equal(closeRace.filter(r => r.accepted).length, 1, 'Only one close is settled');
assert.equal((await rpc('simulator_read')).coins, 1025);
await pool.query('update public.profiles set coins=1000,simulator_revision=0,simulator_state=$1 where id=$2', [empty, uid]);
assert.equal((await rpc('simulator_read')).coins, 1025, 'A delayed profile save cannot undo settlement');
assert.equal((await rpc('simulator_read')).state.tradeHistory.length, 1);
await assert.rejects(rpc('simulator_commit', { expected_revision: 2, next_state: { ...next, pendingOrder: {} } }), /Invalid simulator state/);
console.log('Postgres: concurrent open/close, single payout, stale profile, account isolation and validation passed');

// Reset this dedicated test account for browser interaction.
await pool.query("begin; select set_config('stonksu.simulator_write','yes',true); update profiles set coins=1000,simulator_revision=0,simulator_state=null; commit;");
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--disable-gpu'] });
const profile = {
  name:'Trader', onboarded:true, onboarding_answers:{experience:'none',goal:'fun'}, xp:0, hearts:5,
  last_heart_lost_at:null, streak:0,last_active_date:null,streak_protectors:0,
  completed_lesson_ids:[],unlocked_badge_ids:[],seen_intro_node_ids:[],opened_chest_ids:[],claimed_mission_ids:[],unlocked_accessories:['ninguno'],pending_mistakes:[],
  node_stage_progress:{},term_mastery:{},plan:'ultra',plan_started_at:null,
  avatar:{body:'#C6FF34',mask:'#171717',horns:'curvos',eyes:'arco',accessory:'ninguno',accessoryColor:'#FFC93C'},
  virtual_balance:10000,frozen_dates:[],review_dates:[],active_dates:[],league_rewarded_rank:0,weekly_xp:0,league_rank:0,league_table_id:null,league_week_start:null,
};
let profilePushes = 0;
let failReads = false;
let loseNextResponse = false;
let rejectNextWrite = false;
const errors = [];
async function device(width, legacy = null, expectOpen = false, extra = null) {
  const context = await browser.newContext({ viewport: {width,height:width===390?844:1000} });
  if (legacy || extra) await context.addInitScript(([t,e]) => localStorage.setItem('stonksu-storage', JSON.stringify({state:{onboarded:true,coins:1000,openTrade:t,plan:'ultra',...e},version:0})), [legacy, extra]);
  await context.routeWebSocket('wss://stream.binance.com:9443/ws/**', ws => ws.send(JSON.stringify({p:'50000'})));
  await context.route('**/api/v3/klines?*', route => {
    const now = Math.floor(Date.now()/60000)*60000;
    return route.fulfill({json:Array.from({length:120},(_,i)=>[now-(119-i)*60000,'50000','50001','49999','50000','1',now-(118-i)*60000])});
  });
  await context.route('http://127.0.0.1:59999/**', async route => {
    const u = new URL(route.request().url());
    const body = route.request().postDataJSON();
    if (u.pathname.startsWith('/auth/')) return route.fulfill({json:{access_token:'test-token',refresh_token:'test-refresh',token_type:'bearer',expires_in:3600,user:{id:uid,aud:'authenticated',role:'authenticated',email:'test@example.invalid',is_anonymous:false,user_metadata:{},app_metadata:{}}}});
    if (u.pathname.includes('/rpc/simulator_')) {
      if ((failReads && u.pathname.endsWith('simulator_read')) || (rejectNextWrite && u.pathname.endsWith('simulator_commit'))) {
        rejectNextWrite=false; return route.abort();
      }
      const data = await rpc(u.pathname.split('/').pop(),body??{});
      if (loseNextResponse && u.pathname.endsWith('simulator_commit')) { loseNextResponse=false; return route.abort(); }
      return route.fulfill({json:data});
    }
    if (u.pathname.endsWith('/profiles')) {
      if (route.request().method()==='POST') {
        profilePushes++;
        Object.assign(profile,body);
        await pool.query('update profiles set coins=$1,simulator_revision=$2 where id=$3',[body.coins,body.simulator_revision??0,uid]);
        return route.fulfill({json:null});
      }
      const remote=await rpc('simulator_read');
      return route.fulfill({json:{...profile,coins:remote.coins,simulator_revision:remote.revision}});
    }
    return route.fulfill({json:[]});
  });
  const page = await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5174/simulador');
  await page.waitForSelector('#simulator-order',{state:'attached'});
  if(width===390) await page.locator('button[aria-controls="simulator-order"]').click();
  await page.getByRole('button',{name:legacy||expectOpen?'Cerrar posición':'Long',exact:true}).waitFor();
  return {page,context};
}
try {
  const desktop=await device(1440);
  const mobile=await device(390);
  const d=desktop.page,m=mobile.page;
  await d.getByRole('button',{name:'Long',exact:true}).click();
  await d.getByRole('button',{name:'Cerrar posición',exact:true}).waitFor();
  await m.getByRole('button',{name:'Cerrar posición',exact:true}).waitFor();
  assert.equal(await m.getByRole('button',{name:'Long',exact:true}).count(),0);
  await m.screenshot({path:'/tmp/simulator-synced-mobile.png'});
  await d.screenshot({path:'/tmp/simulator-synced-desktop.png'});
  await m.reload();
  await m.locator('button[aria-controls="simulator-order"]').click();
  await m.getByRole('button',{name:'Cerrar posición',exact:true}).waitFor();
  await m.getByRole('button',{name:'Cerrar posición',exact:true}).click();
  await d.getByRole('button',{name:'Long',exact:true}).waitFor();
  assert.equal((await rpc('simulator_read')).state.tradeHistory.length,1);
  console.log('Browsers: desktop open → existing mobile, reload mobile, mobile close → desktop passed');
  await d.getByRole('button',{name:/Límite.*Esperas/}).click();
  await d.getByRole('textbox',{name:'Precio límite',exact:true}).fill('49000');
  await d.getByRole('button',{name:'Long',exact:true}).click();
  await m.getByRole('button',{name:'Cancelar orden',exact:true}).waitFor();
  await m.getByRole('button',{name:'Cancelar orden',exact:true}).click();
  await d.getByRole('button',{name:'Long',exact:true}).waitFor();
  assert.equal((await rpc('simulator_read')).state.tradesToday,1,'Cancel refunds daily allowance');
  await d.getByRole('button',{name:/Market.*Entras/i}).click();
  rejectNextWrite=true;
  await d.getByRole('button',{name:'Long',exact:true}).click();
  await d.getByRole('button',{name:'Reintentar',exact:true}).waitFor();
  assert.equal((await rpc('simulator_read')).state.openTrade,null,'Failed write does not open locally');
  await d.getByRole('button',{name:'Reintentar',exact:true}).click();
  loseNextResponse=true;
  await d.getByRole('button',{name:'Long',exact:true}).click();
  await d.getByRole('button',{name:'Reintentar',exact:true}).waitFor();
  await d.getByRole('button',{name:'Reintentar',exact:true}).click();
  await d.getByRole('button',{name:'Cerrar posición',exact:true}).waitFor();
  assert.equal((await rpc('simulator_read')).state.tradesToday,2,'Lost acknowledgement does not duplicate open');
  failReads=true;
  await m.reload();
  await m.locator('button[aria-controls="simulator-order"]').click();
  await m.getByRole('button',{name:'Reintentar',exact:true}).waitFor();
  assert.equal(await m.locator('#simulator-order fieldset').evaluate(f=>f.disabled),true);
  failReads=false;
  await m.getByRole('button',{name:'Reintentar',exact:true}).click();
  await m.getByRole('button',{name:'Cerrar posición',exact:true}).waitFor({state:'visible'});
  assert.deepEqual(errors,[]);
  console.log('Browsers: limit sync/cancel, network failure, lost response, blocked offline recovery passed');
  await desktop.context.close();
  await mobile.context.close();
  await pool.query("begin; select set_config('stonksu.simulator_write','yes',true); update profiles set coins=1000,simulator_revision=0,simulator_state=null; commit;");
  const freshPhone = await device(390);
  assert.equal((await rpc('simulator_read')).state,null,'Empty phone does not block legacy import');
  const legacy = {...trade, openedAt:Date.now()};
  await device(1440, legacy);
  await freshPhone.page.getByRole('button',{name:'Cerrar posición',exact:true}).waitFor();
  assert.equal((await rpc('simulator_read')).state.openTrade.openedAt,legacy.openedAt);
  assert.deepEqual(errors,[]);
  console.log('Browsers: original device-only position imported even after new phone visits first');

  // The reported bug: a phone whose localStorage is empty opening for the first
  // time while the server already holds the position. Every case above had the
  // phone loaded *before* the position existed, so it arrived by polling.
  const latePhone = await device(390, null, true);
  assert.deepEqual(errors,[]);
  console.log('Browsers: a phone opening for the first time sees the position already on the server');

  // A device that is fully in step must go quiet. The three-second poll adopts
  // the document it just read; if adopting counts as a change, every device
  // rewrites the store and saves its profile forever, on mobile data.
  profilePushes = 0;
  await latePhone.page.waitForTimeout(7000);
  assert.ok(profilePushes <= 1, `An idle synced phone kept saving its profile (${profilePushes} times in 7s)`);
  console.log('Browsers: an idle synced phone stops saving its profile');

  // A phone whose cache belongs to a different account — a re-login, or a
  // browser profile that was signed in as somebody else. The stale position
  // must not survive, and the account's real one must arrive.
  const stale = {...trade, openedAt: 1};
  await device(390, stale, true, {simulatorOwnerId: other, simulatorRevision: 9});
  assert.deepEqual(errors,[]);
  console.log('Browsers: a phone cached under another account adopts this account position');
} catch (error) {
  for (const context of browser.contexts()) for (const page of context.pages()) console.log((await page.locator('body').innerText()).slice(-5000));
  console.log('Server:',await rpc('simulator_read'));
  throw error;
} finally { await browser.close(); await pool.end(); }
