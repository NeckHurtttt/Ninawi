import sys
out = sys.argv[1]
# filas de la llama (arriba → abajo): columnas ocupadas en una cuadrícula de 11
filas = [(6,6),(6,7),(5,7),(5,8),(4,8),(3,8),(2,9),(1,9),(1,9),(1,9),(1,9),(2,8),(3,7)]
extra = {(2,3),(2,4),(3,4)}  # lenguas de fuego sueltas (col, fila)
celdas = set()
for y,(a,b) in enumerate(filas):
    for x in range(a,b+1): celdas.add((x,y))
celdas |= extra
def prof(x,y):
    d=0
    while all((x+dx,y+dy) in celdas for dx in range(-d-1,d+2) for dy in range(-d-1,d+2) if abs(dx)+abs(dy)<=d+1): d+=1
    return d
COL = ['#c42a22','#ff5a1f','#ff8f1f','#ffc23d','#fff1c1']
def llama(ox, oy, t, gap):
    s=''
    for (x,y) in sorted(celdas, key=lambda c:(c[1],c[0])):
        p=min(prof(x,y),4)
        if y>=12: p=0
        elif y>=11: p=min(p,1)
        if (x,y) in extra: p=0
        s+=f'<rect x="{ox+x*t+gap/2:.1f}" y="{oy+y*t+gap/2:.1f}" width="{t-gap:.1f}" height="{t-gap:.1f}" rx="{t*0.14:.1f}" fill="{COL[p]}"/>'
    return s
def orbita(cx, cy, rx, ry, ang, parte):
    # parte: 'atras' (mitad superior) o 'delante' (mitad inferior)
    sweep = 1 if parte=='delante' else 0
    return (f'<g transform="rotate({ang} {cx} {cy})"><path d="M{cx-rx},{cy} A{rx},{ry} 0 0 {1-sweep} {cx+rx},{cy}" '
            f'fill="none" stroke="var(--orb)" stroke-width="{rx*0.016:.1f}" stroke-linecap="round" {"opacity=\".45\"" if parte=="atras" else ""}/></g>')
def satelite(x, y, k, ang):
    return (f'<g transform="translate({x} {y}) rotate({ang}) scale({k})">'
            f'<rect x="-30" y="-7" width="20" height="14" rx="2" fill="#7aa7ff"/><rect x="10" y="-7" width="20" height="14" rx="2" fill="#7aa7ff"/>'
            f'<line x1="-10" y1="0" x2="10" y2="0" stroke="var(--orb)" stroke-width="3"/><rect x="-7" y="-8" width="14" height="16" rx="3" fill="var(--orb)"/>'
            f'<path d="M0 8 L-6 22 M0 8 L6 22" stroke="#fff36b" stroke-width="2.5" stroke-linecap="round" opacity=".9"/></g>')
def icono(cx, cy, tam):
    t = tam/13.5; ox = cx - 5.5*t; oy = cy - 6.6*t
    rx, ry = tam*0.64, tam*0.17
    import math
    a=-16; th=math.radians(-18)
    sx = cx + rx*math.cos(th)*math.cos(math.radians(a)) - ry*math.sin(th)*math.sin(math.radians(a))
    sy = cy + rx*math.cos(th)*math.sin(math.radians(a)) + ry*math.sin(th)*math.cos(math.radians(a))
    return orbita(cx,cy+tam*0.08,rx,ry,a,'atras') + llama(ox,oy,t,t*0.16) + orbita(cx,cy+tam*0.08,rx,ry,a,'delante') + satelite(sx, sy+tam*0.08, tam/300, a+8)
def svg(w,h,cuerpo,fondo,orb='#f3ebe4',texto='#f3ebe4'):
    defs = f'<style>:root{{--orb:{orb}}} .w{{font:800 1px "Inter","Segoe UI",system-ui,sans-serif;letter-spacing:.12em}} .t{{font:500 1px "Inter","Segoe UI",system-ui,sans-serif;letter-spacing:.32em}}</style>'
    bg = f'<rect width="{w}" height="{h}" rx="{min(w,h)*0.12}" fill="{fondo}"/>' if fondo else ''
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">{defs}{bg}{cuerpo}</svg>'
# 1. ícono cuadrado
open(f'{out}/ninawi-icono.svg','w').write(svg(512,512,icono(256,262,330),'#14110f'))
open(f'{out}/ninawi-icono-transparente.svg','w').write(svg(512,512,icono(256,262,330),None))
# 2. logo vertical con nombre
cuerpo = icono(300,250,300) + '<text x="300" y="505" text-anchor="middle" class="w" style="font-size:92px;fill:#f3ebe4">NINAWI</text>' \
       + '<text x="300" y="552" text-anchor="middle" class="t" style="font-size:22px;fill:#ffc23d">AVISO DEL FUEGO</text>'
open(f'{out}/ninawi-logo.svg','w').write(svg(600,600,cuerpo,'#14110f'))
# 3. horizontal
cuerpo = icono(158,132,180) + '<text x="300" y="142" class="w" style="font-size:96px;fill:#f3ebe4">NINAWI</text>' \
       + '<text x="304" y="190" class="t" style="font-size:21px;fill:#ffc23d">AVISO DEL FUEGO · BOLIVIA</text>'
open(f'{out}/ninawi-horizontal.svg','w').write(svg(940,256,cuerpo,'#14110f'))
# 4. versión clara (fondo blanco)
cuerpo = icono(300,250,300) + '<text x="300" y="505" text-anchor="middle" class="w" style="font-size:92px;fill:#1f1a17">NINAWI</text>' \
       + '<text x="300" y="552" text-anchor="middle" class="t" style="font-size:22px;fill:#c2410c">AVISO DEL FUEGO</text>'
open(f'{out}/ninawi-logo-claro.svg','w').write(svg(600,600,cuerpo,'#fbf7f3',orb='#1f1a17'))
print('ok')
