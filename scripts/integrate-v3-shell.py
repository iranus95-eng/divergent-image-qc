from pathlib import Path
import re

path = Path('index.html')
text = path.read_text(encoding='utf-8')
original = text

# Remove the legacy CSS authority layer. V3 sidebar renderer becomes the only
# presentation authority for menu visibility on this branch.
text = re.sub(
    r'\n?<style id="sidebar-session-lock-v4">.*?</style>\s*',
    '\n<!-- sidebar-session-lock-v4 removed by V3 integration -->\n',
    text,
    flags=re.S,
)

marker = '<!-- DIVERGENT_V3_SHELL -->'
block = '''\n<!-- DIVERGENT_V3_SHELL -->\n<script src="./js/core/permissions.js?v=3"></script>\n<script src="./js/core/events.js?v=3"></script>\n<script src="./js/core/api-client.js?v=3"></script>\n<script src="./js/core/auth-session.js?v=3"></script>\n<script src="./js/ui/sidebar-config.js?v=3"></script>\n<script src="./js/ui/sidebar.js?v=3"></script>\n<script src="./js/core/legacy-menu-bridge.js?v=3"></script>\n<script src="./js/core/bootstrap.js?v=3"></script>\n<script>\n(function(){\n  async function bootV3(){\n    try{\n      if(!window.DivergentBootstrapV3) throw new Error('V3_BOOTSTRAP_NOT_LOADED');\n      const state=await window.DivergentBootstrapV3.start({sidebarRoot:document});\n      document.documentElement.dataset.divergentAuth='v3';\n      document.documentElement.dataset.divergentAuthMode=state&&state.authMode||'';\n    }catch(e){\n      console.error('DIVERGENT_V3_BOOT_FAILED',e);\n    }\n  }\n  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bootV3,{once:true});\n  else bootV3();\n})();\n</script>\n<!-- /DIVERGENT_V3_SHELL -->\n'''

if marker not in text:
    if '</body>' not in text:
        raise SystemExit('index.html has no </body>')
    text = text.replace('</body>', block + '\n</body>', 1)

# Remove old lock classes once V3 auth state is confirmed. This is only visual
# cleanup; authorization remains server-side.
cleanup = "document.body.classList.remove('session-sidebar-lock','perm-claim','perm-claim-pending','perm-payroll','perm-expense','perm-qc','perm-users','perm-invoice','perm-billing');"
if cleanup not in text:
    text = text.replace(
        "document.documentElement.dataset.divergentAuth='v3';",
        "document.documentElement.dataset.divergentAuth='v3';\n      " + cleanup,
        1,
    )

if text == original:
    print('V3 shell already integrated; no changes')
else:
    path.write_text(text, encoding='utf-8')
    print('Integrated V3 shell into index.html')
