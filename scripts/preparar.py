#!/usr/bin/env python3
"""Junta los focos de calor MODIS (2001-2025) y VIIRS S-NPP (2012-2025) de Bolivia
en una cuadrícula común de 0,25° por semana y arma la serie armonizada.

Uso: python3 -I scripts/preparar.py crudos/ limites/bol-adm1.geojson web/datos/
"""
import csv, json, sys, math
from datetime import date
from pathlib import Path
import numpy as np

CELDA = 0.25
LON0, LAT0 = -70.0, -23.25
NX, NY = 52, 56          # cubre -70..-57 / -23.25..-9.25
A0, A1 = 2001, 2025
NA = A1 - A0 + 1
NS = 52                  # semanas por año (la 53 se suma a la 52)
SOLAPE = (2012, 2025)
PRIOR = 40               # peso del factor nacional al calibrar cada celda

def semana(d):
    return min((d.timetuple().tm_yday - 1) // 7, NS - 1)

def leer(carpeta, sensor):
    """Devuelve cubo [celda_y, celda_x, año, semana] con cantidad de focos."""
    cubo = np.zeros((NY, NX, NA, NS), dtype=np.int32)
    total = descartados = 0
    for f in sorted(Path(carpeta).glob(f"{sensor}_*_Bolivia.csv")):
        with open(f, newline="") as fh:
            for r in csv.DictReader(fh):
                total += 1
                # solo fuegos de vegetación presuntos (type 0) y confianza útil
                if r.get("type", "0") != "0":
                    descartados += 1; continue
                c = r["confidence"]
                if sensor == "modis":
                    if int(c) < 30: descartados += 1; continue
                elif c == "l":
                    descartados += 1; continue
                lat, lon = float(r["latitude"]), float(r["longitude"])
                x = int((lon - LON0) // CELDA); y = int((lat - LAT0) // CELDA)
                if not (0 <= x < NX and 0 <= y < NY):
                    descartados += 1; continue
                d = date.fromisoformat(r["acq_date"])
                if not (A0 <= d.year <= A1): continue
                cubo[y, x, d.year - A0, semana(d)] += 1
    print(f"{sensor}: {total} filas, {descartados} descartadas, {cubo.sum()} usadas")
    return cubo

def dentro(px, py, anillo):
    ok = False; n = len(anillo); j = n - 1
    for i in range(n):
        xi, yi = anillo[i]; xj, yj = anillo[j]
        if (yi > py) != (yj > py) and px < (xj - xi) * (py - yi) / (yj - yi) + xi:
            ok = not ok
        j = i
    return ok

def poligonos(g):
    if g["type"] == "Polygon": return [g["coordinates"]]
    return g["coordinates"]

def departamentos(geo):
    deps = [(f["properties"]["shapeName"], poligonos(f["geometry"])) for f in geo["features"]]
    asig = np.full((NY, NX), -1, dtype=np.int8)
    for y in range(NY):
        for x in range(NX):
            # muestreo 3x3 dentro de la celda: gana el departamento con más puntos
            votos = {}
            for sy in (0.17, 0.5, 0.83):
                for sx in (0.17, 0.5, 0.83):
                    px = LON0 + (x + sx) * CELDA; py = LAT0 + (y + sy) * CELDA
                    for k, (_, polys) in enumerate(deps):
                        if any(dentro(px, py, p[0]) and not any(dentro(px, py, h) for h in p[1:]) for p in polys):
                            votos[k] = votos.get(k, 0) + 1; break
            if votos: asig[y, x] = max(votos, key=votos.get)
    return [d[0] for d in deps], asig

def main(crudos, limites, salida):
    salida = Path(salida); salida.mkdir(parents=True, exist_ok=True)
    M = leer(crudos, "modis")
    V = leer(crudos, "viirs-snpp")
    geo = json.load(open(limites))
    nombres, asig = departamentos(geo)
    bol = asig >= 0

    s0, s1 = SOLAPE[0] - A0, SOLAPE[1] - A0 + 1
    Ms = M[:, :, s0:s1].sum(axis=(2, 3)).astype(float)
    Vs = V[:, :, s0:s1].sum(axis=(2, 3)).astype(float)
    kg = Vs[bol].sum() / Ms[bol].sum()
    # factor por celda, encogido hacia el nacional donde hay pocos datos
    k = (Vs + PRIOR * kg) / (Ms + PRIOR)

    # validación: dejar un año fuera (k calculado sin ese año), por departamento y semana
    val = {"factor_nacional": round(kg, 3), "por_anio": []}
    pred_all, obs_all = [], []
    for a in range(s0, s1):
        otros = [i for i in range(s0, s1) if i != a]
        Mo = M[:, :, otros].sum(axis=(2, 3)); Vo = V[:, :, otros].sum(axis=(2, 3))
        kgo = Vo[bol].sum() / Mo[bol].sum()
        ko = (Vo + PRIOR * kgo) / (Mo + PRIOR)
        pred = (M[:, :, a] * ko[:, :, None]); obs = V[:, :, a]
        pa, oa = pred[bol].sum(), obs[bol].sum()
        val["por_anio"].append({"anio": A0 + a, "modis": int(M[:, :, a][bol].sum()),
                                "viirs": int(oa), "estimado": round(float(pa)),
                                "error_pct": round(100 * (pa - oa) / oa, 1)})
        for d in range(len(nombres)):
            m = asig == d
            pred_all.append(pred[m].sum(axis=0)); obs_all.append(obs[m].sum(axis=0))
    p = np.concatenate(pred_all); o = np.concatenate(obs_all)
    lp, lo = np.log1p(p), np.log1p(o)
    val["r2_semanal_log"] = round(float(1 - ((lo - lp) ** 2).sum() / ((lo - lo.mean()) ** 2).sum()), 3)
    val["r_semanal"] = round(float(np.corrcoef(p, o)[0, 1]), 3)
    val["errores_abs_pct_mediana"] = round(float(np.median([abs(x["error_pct"]) for x in val["por_anio"]])), 1)
    print("validación:", json.dumps({k2: v for k2, v in val.items() if k2 != "por_anio"}))

    # serie armonizada en "equivalente VIIRS": antes de 2012 = MODIS × k; desde 2012 = VIIRS real
    H = M.astype(float) * k[:, :, None, None]
    H[:, :, s0:] = V[:, :, s0:]

    celdas = []
    for y in range(NY):
        for x in range(NX):
            if not bol[y, x]: continue
            def disperso(c):
                f = c.reshape(-1); i = np.nonzero(f)[0]
                return [[int(j), int(f[j])] for j in i]
            celdas.append({"x": x, "y": y, "d": int(asig[y, x]), "k": round(float(k[y, x]), 3),
                           "m": disperso(M[y, x]), "v": disperso(V[y, x])})
    datos = {"celda": CELDA, "lon0": LON0, "lat0": LAT0, "anios": [A0, A1], "semanas": NS,
             "solape": list(SOLAPE), "departamentos": nombres, "validacion": val, "celdas": celdas,
             "fuente": "NASA FIRMS, archivos anuales por país (MODIS C6.1 y VIIRS S-NPP 375 m), type 0"}
    with open(salida / "focos.json", "w") as fh:
        json.dump(datos, fh, separators=(",", ":"))
    print("celdas:", len(celdas), "tamaño:", (salida / "focos.json").stat().st_size // 1024, "KB")

if __name__ == "__main__":
    main(*sys.argv[1:4])
