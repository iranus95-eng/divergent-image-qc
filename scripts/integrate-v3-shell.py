from pathlib import Path
import re

path = Path('index.html')
text = path.read_text(encoding='utf-8')
original = text

# Remove any prior V3 shell block, including an accidentally inserted copy
# inside a JavaScript template literal from the first integration pass.
text = re.sub(
    r'\n?<!-- DIVERGENT_V3_SHELL -->.*?<!-- /DIVERGENT_V3_SHELL -->\s*',
    '\n',
    text,
    flags=re.S,
)

# Remove the legacy CSS authority layer. V3 sidebar renderer becomes the only
# presentation authority for menu visibility on this branch.
text = re.sub(
    r'\n?<style id="sidebar-session-lock-v4">.*?</style>\s*',
    '\n<!-- sidebar-session-lock-v4 removed by V3 integration -->\n',
    text,
    flags=re.S,
)

# QC V3 bridge: QC data APIs must accept the authoritative employee session
# token, not require LINE when the user logged in with Username/Password.
old_qc = '''    async function qcApi(action, payload = {}) {\n      const accessToken = await getLineAccessToken();\n'''
new_qc = '''    async function qcApi(action, payload = {}) {\n      const accessToken = await getBestDataToken();\n      if (!accessToken) throw new Error("AUTH_REQUIRED");\n'''
if old_qc in text:
    text = text.replace(old_qc, new_qc, 1)

# Do not let a transient LINE initialization failure disable QC controls when
# an authoritative employee session is already present.
old_line_catch = '''        setQcEnabled(false);\n        // V52: transient LINE errors must not collapse an already-authorized sidebar.\n        applyMenuAccess();\n'''
new_line_catch = '''        if(!getFallbackSessionToken()) setQcEnabled(false);\n        else if(window.DivergentQcAccessV3) window.DivergentQcAccessV3.sync();\n        // V52: transient LINE errors must not collapse an already-authorized sidebar.\n        applyMenuAccess();\n'''
if old_line_catch in text:
    text = text.replace(old_line_catch, new_line_catch, 1)

block = '''\n<!-- DIVERGENT_V3_SHELL -->\n<script src="./js/core/permissions.js?v=3"></script>\n<script src="./js/core/events.js?v=3"></script>\n<script src="./js/core/api-client.js?v=3"></script>\n<script src="./js/core/auth-session.js?v=3"></script>\n<script src="./js/ui/sidebar-config.js?v=3"></script>\n<script src="./js/ui/sidebar.js?v=3"></script>\n<script src="./js/core/legacy-menu-bridge.js?v=3"></script>\n<script src="./js/core/bootstrap.js?v=3"></script>\n<script src="./js/modules/qc/access-bridge.js?v=3"></script>\n<script>\n(function(){\n  async function bootV3(){\n    try{\n      if(!window.DivergentBootstrapV3) throw new Error('V3_BOOTSTRAP_NOT_LOADED');\n      const state=await window.DivergentBootstrapV3.start({sidebarRoot:document});\n      document.documentElement.dataset.divergentAuth='v3';\n      document.documentElement.dataset.divergentAuthMode=state&&state.authMode||'';\n      document.body.classList.remove('session-sidebar-lock','perm-claim','perm-claim-pending','perm-payroll','perm-expense','perm-qc','perm-users','perm-invoice','perm-billing');\n      if(window.DivergentSidebarV3) window.DivergentSidebarV3.renderFromAuth(document);\n      if(window.DivergentQcAccessV3) window.DivergentQcAccessV3.apply(state);\n    }catch(e){\n      console.error('DIVERGENT_V3_BOOT_FAILED',e);\n    }\n  }\n  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bootV3,{once:true});\n  else bootV3();\n})();\n</script>\n<!-- /DIVERGENT_V3_SHELL -->\n'''

lower = text.lower()
pos = lower.rfind('</body>')
if pos < 0:
    raise SystemExit('index.html has no final </body>')
text = text[:pos] + block + '\n' + text[pos:]

if text == original:
    print('V3 shell already integrated; no changes')
else:
    path.write_text(text, encoding='utf-8')
    print('Integrated V3 shell and QC session bridge into final document body')
