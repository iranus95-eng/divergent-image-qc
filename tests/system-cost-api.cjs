const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { stripTypeScriptTypes } = require('node:module');
let handler;
let role = 'admin';
let expired = false;
let conflict = false;
const db = {
  from(table) {
    return {
      select() { return this; }, eq() { return this; }, order() { return this; },
      async limit() { return { data: [{ key: 'scenario:fixture', value: {}, revision: 1 }] }; },
      async maybeSingle() {
        return { data: table === 'app_sessions' ? { user_id: 1, is_active: true, expires_at: expired ? '2000-01-01' : '2099-01-01' } : { id: 1, role, is_active: true } };
      },
    };
  },
  async rpc(_name, args) { return { data: conflict ? [] : [{ key: args.p_key, value: args.p_value, revision: 2 }] }; },
};
const source = fs.readFileSync('supabase/functions/system-cost-api/index.ts', 'utf8').replace(/^import .*\r?\n/, '');
vm.runInNewContext(stripTypeScriptTypes(source), {
  createClient: () => db,
  Deno: { env: { get: () => '' }, serve: fn => { handler = fn; } },
  Request, Response, Date, console,
});
const request = (body, auth = true) => new Request('https://example.test', { method: 'POST', headers: auth ? { Authorization: 'Bearer synthetic' } : {}, body: JSON.stringify(body) });
(async () => {
  assert.equal((await handler(request({ action: 'list' }, false))).status, 401);
  role = 'staff';
  assert.equal((await handler(request({ action: 'list' }))).status, 403);
  role = 'admin'; expired = true;
  assert.equal((await handler(request({ action: 'list' }))).status, 401);
  expired = false;
  assert.equal((await handler(request({ action: 'list' }))).status, 200);
  assert.equal((await handler(request({ action: 'save', key: 'login-token', value: 'secret', revision: 0 }))).status, 400);
  assert.equal((await handler(request({ action: 'save', key: 'scenario:fixture', value: {}, revision: -1 }))).status, 400);
  assert.equal((await handler(request({ action: 'save', key: 'scenario:fixture', value: {}, revision: 1 }))).status, 200);
  conflict = true;
  assert.equal((await handler(request({ action: 'save', key: 'scenario:fixture', value: {}, revision: 1 }))).status, 409);
  console.log('PASS: cost API anonymous/staff/expired-session denial, authorized list/save, invalid keys and revision conflict');
})().catch(error => { console.error(error); process.exitCode = 1; });
