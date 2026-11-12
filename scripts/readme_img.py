#!/usr/bin/env python3
"""Imágenes animadas del README (SVG con CSS): banner, separador de escaneo y calendario real.
Uso: python3 -I scripts/readme_img.py   (desde la raíz del repo)
"""
import base64, io, json, math, sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ / 'logo'))
import generar as G  # noqa: E402

SALIDA = RAIZ / 'docs' / 'img'
SALIDA.mkdir(parents=True, exist_ok=True)
FUENTES = {'ExtraBold': '/usr/share/fonts/TTF/JetBrainsMonoNerdFontMono-ExtraBold.ttf',
           'Medium': '/usr/share/fonts/TTF/JetBrainsMonoNerdFontMono-Medium.ttf'}
G.MONO = "'NM'," + G.MONO


def fuente(texto):
    """@font-face con JetBrains Mono (OFL) recortada a los caracteres usados."""
    from fontTools import subset
    from fontTools.ttLib import TTFont
    css = ''
    for peso, ruta in FUENTES.items():
        f = TTFont(ruta)
        op = subset.Options(); op.flavor = 'woff'; op.layout_features = []; op.name_IDs = []; op.hinting = False
        s = subset.Subsetter(op); s.populate(text=texto); s.subset(f)
        b = io.BytesIO(); f.flavor = 'woff'; f.save(b)
        w = 800 if peso == 'ExtraBold' else 500
        css += f"@font-face{{font-family:'NM';font-weight:{w};src:url(data:font/woff;base64,{base64.b64encode(b.getvalue()).decode()}) format('woff')}}"
    return css


# ---------- datos reales ----------
D = json.load(open(RAIZ / 'web' / 'datos' / 'focos.json'))
A0, A1 = D['anios']; NA = A1 - A0 + 1; NS = D['semanas']; S0 = D['solape'][0] - A0
DEP = D['departamentos'].index('Santa Cruz')
H = [0.0] * (NA * NS)
for c in D['celdas']:
    if c['d'] != DEP: continue
    for j, n in c['m']:
        if j < S0 * NS: H[j] += n * c['k']
    for j, n in c['v']:
        if j >= S0 * NS: H[j] += n
anual = [sum(H[a * NS:(a + 1) * NS]) for a in range(NA)]
mediana = sorted(anual)[NA // 2]
total_focos = sum(len(c['m']) for c in D['celdas'])  # no se usa: el total real va abajo
VAL = D['validacion']

RAMPA = [(20, 17, 15), (90, 20, 18), (190, 40, 30), (255, 106, 31), (255, 194, 61), (255, 246, 200)]


def color(t):
    t = max(0.0, min(1.0, t)); p = t * (len(RAMPA) - 1); i = min(int(p), len(RAMPA) - 2); r = p - i
    return '#%02x%02x%02x' % tuple(round(RAMPA[i][k] + (RAMPA[i + 1][k] - RAMPA[i][k]) * r) for k in range(3))


def p98(vals):
    nz = sorted(v for v in vals if v > 0); return nz[int(0.98 * (len(nz) - 1))]


def dec(x, k=1):
    return f'{x:.{k}f}'.replace('.', ',')


# ---------- banner ----------
def banner():
    W, Hh = 1280, 400
    linea = f'> 25 años · 5,3 M focos · MODIS ≈ VIIRS · r = {dec(VAL["r_semanal"], 3)} · error {dec(VAL["errores_abs_pct_mediana"])} %'
    textos = 'NINAWI' + 'AVISO DEL FUEGO · BOLIVIA' + linea + 'NASA SPACE APPS CHALLENGE 2026 · SANTA CRUZ' + '17.8°S63.2°W_'
    ic = G.icono(230, 200, 160, G.OSCURO)
    css = (fuente(textos) +
           '@keyframes pulso{0%,100%{opacity:.35}50%{opacity:1}}'
           '@keyframes giro{to{transform:rotate(360deg)}}'
           '@keyframes barre{0%{transform:translateY(-60px)}100%{transform:translateY(420px)}}'
           '@keyframes parpadeo{0%,49%{opacity:1}50%,100%{opacity:0}}'
           '@keyframes escribe{from{width:0}to{width:760px}}'
           '@keyframes haz{0%,100%{opacity:.35}50%{opacity:1}}'
           'path[stroke="#d7261e"]{animation:pulso 2.6s ease-in-out infinite}'
           'path[stroke="#f2481d"]{animation:pulso 2.6s ease-in-out .25s infinite}'
           'path[stroke="#ff7a1a"]{animation:pulso 2.6s ease-in-out .5s infinite}'
           'path[stroke="#ffab2e"]{animation:pulso 2.6s ease-in-out .75s infinite}'
           'path[stroke="#ffd25a"]{animation:pulso 2.6s ease-in-out 1s infinite}'
           'path[fill="url(#barrido)"]{animation:haz 1.6s ease-in-out infinite}'
           '.anillo{transform-origin:230px 200px;animation:giro 60s linear infinite}'
           '.scan{animation:barre 5s linear infinite}'
           '.cursor{animation:parpadeo 1s step-end infinite}'
           '.tipeo{animation:escribe 4.5s steps(60) 0.6s both}')
    # el anillo del ícono gira: se separa la parte del anillo (primeros elementos) del resto
    corte = ic.index('<path d="M')  # primer elemento después de retícula + anillo
    anillo, resto = ic[:corte], ic[corte:]
    s = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {Hh}" width="{W}" height="{Hh}">{G.DEFS}'
         f'<style>{css}</style>'
         '<defs><pattern id="rej" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="#2a221d" stroke-width="1"/></pattern>'
         '<linearGradient id="lscan" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff6a1f" stop-opacity="0"/><stop offset="1" stop-color="#ff6a1f" stop-opacity=".09"/></linearGradient>'
         '<linearGradient id="vinieta" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2a1209"/><stop offset=".55" stop-color="#0e0c0b"/></linearGradient>'
         '<clipPath id="tipeo"><rect class="tipeo" x="470" y="268" width="760" height="40"/></clipPath></defs>'
         f'<rect width="{W}" height="{Hh}" rx="18" fill="url(#vinieta)"/>'
         f'<rect width="{W}" height="{Hh}" rx="18" fill="url(#rej)" opacity=".7"/>'
         f'<rect class="scan" x="0" y="0" width="{W}" height="60" fill="url(#lscan)"/>'
         f'<g class="anillo">{anillo}</g>{resto}'
         "<text x=\"470\" y=\"170\" style=\"font:800 124px 'NM',monospace;letter-spacing:17px;fill:#f3ebe4\">NINAWI</text>"
         "<text x=\"474\" y=\"222\" style=\"font:500 24px 'NM',monospace;letter-spacing:7px;fill:#ffc23d\">AVISO DEL FUEGO · BOLIVIA</text>"
         f"<g clip-path=\"url(#tipeo)\"><text x=\"474\" y=\"294\" style=\"font:500 19px 'NM',monospace;fill:#b5a69a\">{linea}</text></g>"
         "<rect class=\"cursor\" x=\"474\" y=\"304\" width=\"12\" height=\"3\" fill=\"#ffc23d\"/>"
         "<text x=\"474\" y=\"362\" style=\"font:500 14px 'NM',monospace;letter-spacing:4px;fill:#6b5d53\">NASA SPACE APPS CHALLENGE 2026 · SANTA CRUZ</text>"
         '</svg>\n')
    (SALIDA / 'banner.svg').write_text(s)


# ---------- separador ----------
def escaneo():
    W, Hh = 1280, 34
    blips = [90, 260, 410, 640, 780, 1010, 1170]
    css = ('@keyframes pasa{0%{transform:translateX(-220px)}100%{transform:translateX(1300px)}}'
           '@keyframes blip{0%,70%,100%{r:2;opacity:.25}80%{r:7;opacity:1}}'
           '.haz{animation:pasa 4s linear infinite}')
    s = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {Hh}" width="{W}" height="{Hh}"><style>{css}'
         + ''.join(f'.b{i}{{animation:blip 4s linear {x / 1520 * 4:.2f}s infinite}}' for i, x in enumerate(blips)) +
         '</style><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#ffc23d" stop-opacity="0"/><stop offset=".85" stop-color="#ffc23d" stop-opacity=".9"/><stop offset="1" stop-color="#fff4cc"/></linearGradient></defs>'
         f'<line x1="0" y1="17" x2="{W}" y2="17" stroke="#3a302a" stroke-width="1.5"/>'
         + ''.join(f'<line x1="{x}" y1="12" x2="{x}" y2="22" stroke="#3a302a"/>' for x in range(0, W, 40)) +
         '<rect class="haz" x="0" y="15.5" width="220" height="3" rx="1.5" fill="url(#g)"/>'
         + ''.join(f'<circle class="b{i}" cx="{x}" cy="17" r="2" fill="#ff6a1f"/>' for i, x in enumerate(blips)) +
         '</svg>\n')
    (SALIDA / 'escaneo.svg').write_text(s)


# ---------- calendario animado con datos reales ----------
def calendario():
    cw, ch, izq, arriba = 15, 13, 62, 62
    W = izq + NS * cw + 230; Hh = arriba + NA * ch + 52
    tope = p98(H)
    meses = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']
    peor = max(range(NA), key=lambda a: anual[a])
    nota = [(peor, f'← {A0 + peor} · {dec(anual[peor] / mediana)}× lo normal')]
    seg = sorted(range(NA), key=lambda a: -anual[a])[1]
    nota.append((seg, f'← {A0 + seg} · {dec(anual[seg] / mediana)}×'))
    titulo = 'SANTA CRUZ · FOCOS POR SEMANA (EQUIV. VIIRS) · 2001–2025'
    textos = titulo + ''.join(meses) + ''.join(str(A0 + a) for a in range(NA)) + ''.join(t for _, t in nota) + '≈ estimado con MODIS × kpocomucho0123456789'
    css = (fuente(textos) +
           '@keyframes aparece{from{opacity:0}to{opacity:1}}'
           '@keyframes barre{0%{transform:translateX(0)}100%{transform:translateX(' + str(NS * cw) + 'px)}}'
           '.f{animation:aparece .5s ease-out both}'
           '.cab{animation:barre 6s linear 2.6s infinite}'
           "text{font-family:'NM',monospace}")
    s = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {Hh}" width="{W}" height="{Hh}"><style>{css}</style>',
         f'<rect width="{W}" height="{Hh}" rx="14" fill="#14110f" stroke="#3a302a"/>',
         f'<text x="{izq}" y="28" style="font-weight:800;font-size:15px;letter-spacing:2px;fill:#f3ebe4">{titulo}</text>']
    for m in range(12):
        dias = sum([31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][:m])
        s.append(f'<text x="{izq + dias // 7 * cw}" y="{arriba - 8}" style="font-size:10px;fill:#b5a69a">{meses[m]}</text>')
    for a in range(NA):
        y = arriba + a * ch
        s.append(f'<g class="f" style="animation-delay:{a * 0.09:.2f}s">')
        s.append(f'<text x="8" y="{y + 10}" style="font-size:10px;fill:{"#ffc23d" if a == peor else "#b5a69a"}">{A0 + a}{" ≈" if a < S0 else ""}</text>')
        for w in range(NS):
            v = H[a * NS + w]
            col = color(0.08 + 0.92 * min(1, math.sqrt(v / tope))) if v > 0 else '#241e1a'
            s.append(f'<rect x="{izq + w * cw}" y="{y}" width="{cw - 2}" height="{ch - 2}" rx="2" fill="{col}"/>')
        s.append('</g>')
    for a, t in nota:
        s.append(f'<text class="f" style="animation-delay:{NA * 0.09:.2f}s;font-size:11px;font-weight:800;fill:#ffc23d" x="{izq + NS * cw + 8}" y="{arriba + a * ch + 10}">{t}</text>')
    # cabezal que barre las semanas
    s.append(f'<g class="cab"><rect x="{izq - 1}" y="{arriba - 3}" width="{cw}" height="{NA * ch + 4}" fill="none" stroke="#fff4cc" stroke-opacity=".75" rx="3"/></g>')
    yl = arriba + NA * ch + 24
    s.append(f'<text x="{izq}" y="{yl}" style="font-size:10px;fill:#b5a69a">poco</text>')
    for i in range(10):
        s.append(f'<rect x="{izq + 36 + i * 16}" y="{yl - 10}" width="14" height="11" rx="2" fill="{color(0.08 + 0.92 * i / 9)}"/>')
    s.append(f'<text x="{izq + 36 + 10 * 16 + 6}" y="{yl}" style="font-size:10px;fill:#b5a69a">mucho</text>')
    s.append(f'<text x="{izq + 300}" y="{yl}" style="font-size:10px;fill:#6b5d53">≈ estimado con MODIS × k</text>')
    s.append('</svg>\n')
    (SALIDA / 'calendario.svg').write_text(''.join(s))


banner(); escaneo(); calendario()
for f in sorted(SALIDA.glob('*.svg')):
    print(f.name, f.stat().st_size // 1024, 'KB')
