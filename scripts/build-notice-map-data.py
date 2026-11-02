import json, sys, math
src, out = sys.argv[1], sys.argv[2]
d = json.load(open(src, encoding='utf-8'))
P = ['ขอนแก่น', 'ชัยภูมิ', 'นครราชสีมา', 'บุรีรัมย์', 'สุรินทร์']
TOL = float(sys.argv[3]) if len(sys.argv) > 3 else 0.004
def dp(pts, tol):
    if len(pts) < 3: return pts
    a, b = pts[0], pts[-1]; dmax, idx = 0, 0
    for i in range(1, len(pts) - 1):
        p = pts[i]
        if a == b: dd = math.hypot(p[0]-a[0], p[1]-a[1])
        else:
            dx, dy = b[0]-a[0], b[1]-a[1]
            dd = abs(dy*p[0] - dx*p[1] + b[0]*a[1] - b[1]*a[0]) / math.hypot(dx, dy)
        if dd > dmax: dmax, idx = dd, i
    if dmax > tol: return dp(pts[:idx+1], tol)[:-1] + dp(pts[idx:], tol)
    return [a, b]
def ring(r):
    # split closed ring into two halves so DP keeps shape
    h = len(r)//2
    s = dp(r[:h+1], TOL)[:-1] + dp(r[h:], TOL)
    return [[round(x, 3), round(y, 3)] for x, y in s]
feats = []
for f in d['features']:
    p = f['properties']
    if p['pro_th'] not in P: continue
    g = f['geometry']; polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
    rings = []
    for poly in polys:
        r = ring(poly[0])
        if len(r) >= 4: rings.append(r)
    feats.append({'n': p['amp_th'], 'p': p['pro_th'], 'c': [round(p['lon'], 3), round(p['lat'], 3)], 'g': rings})
js = ('/* อำเภอของ 5 จังหวัด (ขอนแก่น ชัยภูมิ นครราชสีมา บุรีรัมย์ สุรินทร์) สำหรับแผนที่ตารางประมูลแจ้งเตือน (js/notice-map.js)\n'
      ' * ขอบเขตอำเภอจาก OpenGISData-Thailand districts.geojson (chingchai, CC BY 4.0), ลดจุดด้วย Douglas-Peucker ' + str(TOL) + '° แล้วปัดทศนิยม 3 ตำแหน่ง\n'
      ' * สร้างใหม่: scripts/build-notice-map-data.py <districts.geojson> js/notice-map-data.js */\n'
      'window.NOTICE_MAP_DATA = ' + json.dumps({'provinces': P, 'districts': feats}, ensure_ascii=False, separators=(',', ':')) + ';\n')
open(out, 'w', encoding='utf-8').write(js)
print(len(feats), len(js.encode()))
