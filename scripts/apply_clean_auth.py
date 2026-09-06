from pathlib import Path

p = Path('index.html')
s = p.read_text(encoding='utf-8')

# Idempotent migration: stop if already applied.
if 'CLEAN_V2_AUTH_SINGLE_SOURCE' in s:
    print('clean auth already applied')
    raise SystemExit(0)

old = '''    function hasAnyMenuAccess(a){return !!(a&&(a.qc||a.claim||a.claim_pending||a.payroll||a.staff_expense||a.user_management||a.invoice||a.billing));}\n    function commitMenuAccess(access,user,authMode){\n      if(!access||typeof access!=="object") return false;\n      menuAccess={...menuAccess,...access};'''
new = '''    function hasAnyMenuAccess(a){return !!(a&&(a.qc||a.claim||a.claim_pending||a.payroll||a.staff_expense||a.user_management||a.invoice||a.billing));}\n    const MENU_ACCESS_KEYS=["qc","claim","claim_pending","staff_payroll","payroll","staff_expense","user_management","invoice","billing"];\n    function normalizeMenuAccess(access){\n      const clean={};\n      for(const k of MENU_ACCESS_KEYS) clean[k]=access?.[k]===true;\n      return clean;\n    }\n    function commitMenuAccess(access,user,authMode){\n      if(!access||typeof access!=="object") return false;\n      // CLEAN REBUILD: permission is a snapshot from the authenticated account, never a merge.\n      menuAccess=normalizeMenuAccess(access);'''
assert old in s, 'commitMenuAccess anchor not found'
s = s.replace(old, new, 1)
s = s.replace('localStorage.setItem("divergent_menu_access_cache",JSON.stringify({access:menuAccess,user:window.currentMenuUser||null,auth_mode:authMode||window.fallbackAuthMode||"",at:Date.now()}))', 'localStorage.setItem("divergent_menu_access_cache_v2",JSON.stringify({access:menuAccess,user:window.currentMenuUser||null,auth_mode:authMode||window.fallbackAuthMode||"",at:Date.now()}))', 1)
s = s.replace('const PAYROLL_UI_BUILD = "V52_MENU_ACCESS_STABLE";', 'const PAYROLL_UI_BUILD = "CLEAN_V2_AUTH_SINGLE_SOURCE";', 1)
s = s.replace('localStorage.removeItem("divergent_menu_access_cache")', 'localStorage.removeItem("divergent_menu_access_cache_v2")', 1)

start = s.index('    async function refreshAllMenuAccess(){')
end = s.index('    function requireMenuAccess(key,label)', start)
refresh = '''    async function refreshAllMenuAccess(){\n      // CLEAN REBUILD: an explicit Username/Password session is authoritative.\n      // LINE is consulted only when there is no valid web session.\n      const sessionToken=getFallbackSessionToken();\n      if(sessionToken){\n        try{\n          const sr=await fetchMenuAccessWithToken(sessionToken);\n          if(sr?.r?.ok && sr?.j?.access){\n            commitMenuAccess(sr.j.access,sr.j.user,"session");\n            if(menuAccess.payroll&&!window.__payrollPrefetchStarted){window.__payrollPrefetchStarted=true;setTimeout(()=>{try{loadPayrollEmployees(false)}catch(_){ }},900);}\n            return true;\n          }\n          if(sr && !sr.r.ok && ["AUTH_INVALID","AUTH_REQUIRED"].includes(sr.j?.error)){\n            try{localStorage.removeItem(FALLBACK_SESSION_KEY)}catch(_){ }\n          }else if(sr && !sr.r.ok){\n            return false;\n          }\n        }catch(e){console.warn("menu session check",e);return false;}\n      }\n\n      try{\n        if(window.liff&&liff.isLoggedIn&&liff.isLoggedIn()){\n          const lineToken=await getLineAccessToken();\n          if(lineToken){\n            const lr=await fetchMenuAccessWithToken(lineToken);\n            if(lr?.r?.ok && lr?.j?.access){\n              commitMenuAccess(lr.j.access,lr.j.user,"line");\n              if(menuAccess.payroll&&!window.__payrollPrefetchStarted){window.__payrollPrefetchStarted=true;setTimeout(()=>{try{loadPayrollEmployees(false)}catch(_){ }},900);}\n              return true;\n            }\n            if(lr?.j?.error==="LINE_NOT_LINKED"){menuLineLinked=false;showAccountLinkRequired("LINE ยังไม่ได้ผูกกับบัญชีพนักงาน กรุณาใช้ Username / Password เพื่อเข้าสู่ระบบ");}\n          }\n        }\n      }catch(e){console.warn("menu LINE check",e);}\n      return false;\n    }\n'''
s = s[:start] + refresh + s[end:]

s = s.replace('''    async function userAdminApi(action, payload = {}) {\n      if(action==="list")return await webListApi("users");\n      const accessToken = await getLineAccessToken();''', '''    async function userAdminApi(action, payload = {}) {\n      if(action==="list")return await webListApi("users");\n      const accessToken = await getBestDataToken();\n      if(!accessToken) throw new Error("AUTH_REQUIRED");''', 1)

old_cache = 'try{const c=JSON.parse(localStorage.getItem("divergent_menu_access_cache")||"null");if(c?.access){menuAccess={...menuAccess,...c.access};window.currentMenuUser=c.user||null;window.fallbackAuthMode=c.auth_mode||"";menuAccessConfirmed=true;applyMenuAccess();}}catch(_){ }'
new_cache = 'try{const c=JSON.parse(localStorage.getItem("divergent_menu_access_cache_v2")||"null");const hasSession=!!getFallbackSessionToken();if(c?.access&&((hasSession&&c.auth_mode==="session")||(!hasSession&&c.auth_mode==="line"))){menuAccess=normalizeMenuAccess(c.access);window.currentMenuUser=c.user||null;window.fallbackAuthMode=c.auth_mode||"";menuAccessConfirmed=true;applyMenuAccess();}}catch(_){ }'
assert old_cache in s, 'init cache anchor not found'
s = s.replace(old_cache, new_cache, 1)

s = s.replace('        await checkQcAccess();\n        await refreshAllMenuAccess();', '        if(!getFallbackSessionToken()) await checkQcAccess();\n        await refreshAllMenuAccess();', 1)

old_login = '''        menuAccess={...menuAccess,...(data.access||{})};\n        // Persist permission state immediately so the sidebar does not collapse during LINE repair.\n        try{localStorage.setItem("divergent_menu_access_cache",JSON.stringify({access:menuAccess,user:data.user||window.currentMenuUser||null,at:Date.now()}))}catch(_){ }\n        applyMenuAccess();'''
assert old_login in s, 'fallback login permission anchor not found'
s = s.replace(old_login, '        commitMenuAccess(data.access||{},data.user||null,"session");', 1)

s = s.replace('Version 1.9.9</div>', 'Version 2.1.0 CLEAN</div>', 1)

p.write_text(s, encoding='utf-8')
print('clean auth migration applied')
