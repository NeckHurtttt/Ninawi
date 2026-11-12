#!/usr/bin/env python3
"""Logo NINAWI, versión técnica: llama de isotermas, mira de detección,
anillo de instrumento y barrido de satélite.
Uso: python3 -I logo/generar.py logo/   (PNG: node png.mjs con Chromium)
"""
import math, sys

OUT = sys.argv[1] if len(sys.argv) > 1 else '.'
MONO = "'JetBrainsMono NF','JetBrains Mono','DejaVu Sans Mono',monospace"

# contorno de llama en coordenadas unitarias: base en (0,0), punta en y = -1
LLAMA = ("M0,0 C-0.36,0 -0.52,-0.22 -0.46,-0.47 C-0.41,-0.66 -0.24,-0.74 -0.22,-0.93 "
         "C-0.08,-0.83 -0.02,-0.72 0.0,-0.6 C0.08,-0.74 0.14,-0.88 0.06,-1.06 "
         "C0.32,-0.94 0.5,-0.66 0.47,-0.4 C0.45,-0.15 0.3,0 0,0 Z")
# isotermas: (escala, desplazamiento vertical, color, grosor)
ISO = [(1.00, 0.00, '#d7261e', 2.2), (0.80, -0.05, '#f2481d', 2.4), (0.61, -0.09, '#ff7a1a', 2.6),
       (0.43, -0.12, '#ffab2e', 2.8), (0.27, -0.14, '#ffd25a', 3.0)]


def llama(cx, by, h, fondo):
    """Llama de isotermas con base en (cx, by) y alto h."""
    s = (f'<path d="{LLAMA}" transform="translate({cx} {by}) scale({h})" fill="url(#calor)" opacity=".28"/>')
    for k, dy, col, w in ISO:
        s += (f'<path d="{LLAMA}" transform="translate({cx} {by + dy * h}) scale({h * k})" fill="none" '
              f'stroke="{col}" stroke-width="{w / (h * k):.4f}" stroke-linejoin="round"/>')
    # núcleo: el píxel detectado
    nx, ny = cx, by - 0.3 * h
    t = h * 0.075
    s += f'<rect x="{nx - t / 2}" y="{ny - t / 2}" width="{t}" height="{t}" rx="{t * 0.18}" fill="#fff4cc" filter="url(#brillo)"/>'
    s += f'<rect x="{nx - t / 2}" y="{ny - t / 2}" width="{t}" height="{t}" rx="{t * 0.18}" fill="#fff8e0"/>'
    return s, nx, ny


def mira(x, y, r, col):
    """Esquinas de detección alrededor del foco."""
    l = r * 0.42
    s = ''
    for sx in (-1, 1):
        for sy in (-1, 1):
            s += (f'<path d="M{x + sx * r},{y + sy * (r - l)} L{x + sx * r},{y + sy * r} L{x + sx * (r - l)},{y + sy * r}" '
                  f'fill="none" stroke="{col}" stroke-width="{r * 0.05:.2f}" stroke-linecap="square"/>')
    return s


def anillo(cx, cy, r, col, tenue):
    s = f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="{tenue}" stroke-width="{r * 0.006:.2f}"/>'
    s += f'<circle cx="{cx}" cy="{cy}" r="{r * 0.93}" fill="none" stroke="{tenue}" stroke-width="{r * 0.004:.2f}" stroke-dasharray="{r * 0.006:.2f} {r * 0.03:.2f}"/>'
    for g in range(0, 360, 5):
        a = math.radians(g - 90)
        largo = 0.07 if g % 30 == 0 else 0.035
        c = col if g % 90 == 0 else tenue
        x1, y1 = cx + r * math.cos(a), cy + r * math.sin(a)
        x2, y2 = cx + r * (1 - largo) * math.cos(a), cy + r * (1 - largo) * math.sin(a)
        s += f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{c}" stroke-width="{r * (0.012 if g % 30 == 0 else 0.006):.2f}"/>'
    return s


def reticula(cx, cy, r, tenue):
    s = f'<clipPath id="disco"><circle cx="{cx}" cy="{cy}" r="{r * 0.9}"/></clipPath><g clip-path="url(#disco)" stroke="{tenue}" stroke-width="{r * 0.003:.2f}" opacity=".55">'
    paso = r * 0.18
    i = -5
    while i <= 5:
        s += f'<line x1="{cx + i * paso:.1f}" y1="{cy - r}" x2="{cx + i * paso:.1f}" y2="{cy + r}"/>'
        s += f'<line x1="{cx - r}" y1="{cy + i * paso:.1f}" x2="{cx + r}" y2="{cy + i * paso:.1f}"/>'
        i += 1
    return s + '</g>'


def satelite(x, y, k, col):
    return (f'<g transform="translate({x} {y}) rotate(-28) scale({k})">'
            f'<rect x="-34" y="-8" width="22" height="16" rx="1.5" fill="none" stroke="#7aa7ff" stroke-width="2.4"/>'
            f'<line x1="-34" y1="0" x2="-12" y2="0" stroke="#7aa7ff" stroke-width="1.4"/><line x1="-23" y1="-8" x2="-23" y2="8" stroke="#7aa7ff" stroke-width="1.4"/>'
            f'<rect x="12" y="-8" width="22" height="16" rx="1.5" fill="none" stroke="#7aa7ff" stroke-width="2.4"/>'
            f'<line x1="12" y1="0" x2="34" y2="0" stroke="#7aa7ff" stroke-width="1.4"/><line x1="23" y1="-8" x2="23" y2="8" stroke="#7aa7ff" stroke-width="1.4"/>'
            f'<line x1="-12" y1="0" x2="12" y2="0" stroke="{col}" stroke-width="2.4"/>'
            f'<rect x="-8" y="-9" width="16" height="18" rx="3" fill="{col}"/></g>')


def icono(cx, cy, R, tema):
    col, tenue, mira_c = tema['linea'], tema['tenue'], tema['mira']
    s = reticula(cx, cy, R, tenue) + anillo(cx, cy, R, col, tenue)
    # barrido del satélite (franja VIIRS) hacia el foco
    h = R * 1.02
    by = cy + R * 0.52
    sx, sy = cx + R * 0.66, cy - R * 0.66
    fx, fy = cx, by - 0.3 * h
    ang = math.atan2(fy - sy, fx - sx)
    perp = ang + math.pi / 2
    ancho = R * 0.2
    p1 = (fx + math.cos(perp) * ancho, fy + math.sin(perp) * ancho)
    p2 = (fx - math.cos(perp) * ancho, fy - math.sin(perp) * ancho)
    s += f'<path d="M{sx},{sy} L{p1[0]:.1f},{p1[1]:.1f} L{p2[0]:.1f},{p2[1]:.1f} Z" fill="url(#barrido)"/>'
    s += f'<line x1="{sx}" y1="{sy}" x2="{p1[0]:.1f}" y2="{p1[1]:.1f}" stroke="#ffd25a" stroke-width="{R * 0.005:.2f}" stroke-dasharray="{R * 0.02:.1f} {R * 0.02:.1f}" opacity=".7"/>'
    s += f'<line x1="{sx}" y1="{sy}" x2="{p2[0]:.1f}" y2="{p2[1]:.1f}" stroke="#ffd25a" stroke-width="{R * 0.005:.2f}" stroke-dasharray="{R * 0.02:.1f} {R * 0.02:.1f}" opacity=".7"/>'
    l, nx, ny = llama(cx, by, h, tema['fondo'])
    s += l + mira(nx, ny, R * 0.13, mira_c)
    s += satelite(sx, sy, R / 230, col)
    # coordenadas de Santa Cruz en el anillo
    s += (f'<text x="{cx - R * 0.56:.1f}" y="{cy + R * 0.7:.1f}" style="font:500 {R * 0.065:.1f}px {MONO};fill:{tenue}">17.8°S</text>'
          f'<text x="{cx + R * 0.56:.1f}" y="{cy + R * 0.7:.1f}" text-anchor="end" style="font:500 {R * 0.065:.1f}px {MONO};fill:{tenue}">63.2°W</text>')
    return s


DEFS = ('<defs>'
        '<radialGradient id="calor" cx="50%" cy="70%" r="60%"><stop offset="0" stop-color="#ffd25a"/><stop offset=".55" stop-color="#ff5a1f"/><stop offset="1" stop-color="#d7261e" stop-opacity="0"/></radialGradient>'
        '<linearGradient id="barrido" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd25a" stop-opacity=".02"/><stop offset="1" stop-color="#ffd25a" stop-opacity=".22"/></linearGradient>'
        '<filter id="brillo" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="9"/></filter>'
        '</defs>')

OSCURO = {'fondo': '#0e0c0b', 'linea': '#f3ebe4', 'tenue': '#6b5d53', 'mira': '#f3ebe4', 'texto': '#f3ebe4', 'acento': '#ffc23d'}
CLARO = {'fondo': '#fbf7f3', 'linea': '#1f1a17', 'tenue': '#b3a69b', 'mira': '#1f1a17', 'texto': '#1f1a17', 'acento': '#c2410c'}


def svg(w, h, cuerpo, tema, con_fondo=True):
    bg = f'<rect width="{w}" height="{h}" rx="{min(w, h) * 0.1}" fill="{tema["fondo"]}"/>' if con_fondo else ''
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">{DEFS}{bg}{cuerpo}</svg>\n'


def marca(x, y, tam, tema, anchor='start'):
    return (f'<text x="{x}" y="{y}" text-anchor="{anchor}" style="font:800 {tam}px {MONO};letter-spacing:{tam * 0.14:.1f}px;fill:{tema["texto"]}">NINAWI</text>')


def lema(x, y, tam, tema, txt, anchor='start'):
    return (f'<text x="{x}" y="{y}" text-anchor="{anchor}" style="font:500 {tam}px {MONO};letter-spacing:{tam * 0.3:.1f}px;fill:{tema["acento"]}">{txt}</text>')


def guardar(nombre, contenido):
    open(f'{OUT}/{nombre}.svg', 'w').write(contenido)


guardar('ninawi-icono', svg(512, 512, icono(256, 256, 220, OSCURO), OSCURO))
guardar('ninawi-icono-transparente', svg(512, 512, icono(256, 256, 220, OSCURO), OSCURO, False))
guardar('ninawi-logo', svg(600, 640, icono(300, 262, 220, OSCURO) + marca(300, 556, 78, OSCURO, 'middle')
                           + lema(300, 600, 19, OSCURO, 'AVISO DEL FUEGO', 'middle'), OSCURO))
guardar('ninawi-logo-claro', svg(600, 640, icono(300, 262, 220, CLARO) + marca(300, 556, 78, CLARO, 'middle')
                                 + lema(300, 600, 19, CLARO, 'AVISO DEL FUEGO', 'middle'), CLARO))
guardar('ninawi-horizontal', svg(980, 280, icono(140, 140, 116, OSCURO) + marca(296, 158, 92, OSCURO)
                                 + lema(300, 206, 21, OSCURO, 'AVISO DEL FUEGO · BOLIVIA')
                                 + f'<text x="300" y="240" style="font:500 15px {MONO};letter-spacing:3px;fill:#6b5d53">MODIS + VIIRS · NASA FIRMS · 2001–2026</text>', OSCURO))
def favicon(tema):
    l, nx, ny = llama(256, 470, 430, tema['fondo'])
    return svg(512, 512, l + mira(nx, ny, 62, tema['mira']), tema)


guardar('ninawi-favicon', favicon(OSCURO))
print('ok')
