#!/usr/bin/env python3
"""Baja los focos VIIRS de los últimos 7 días (archivos públicos de NASA FIRMS, sin clave)
y guarda los de Bolivia en web/datos/ultimos7.json para la alerta temprana.

Uso: python3 -I scripts/actualizar.py web/datos/
"""
import csv, io, json, sys, urllib.request
from datetime import datetime, timezone
from pathlib import Path

FUENTES = {
    "VIIRS NOAA-20": "https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_South_America_7d.csv",
    "VIIRS NOAA-21": "https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-21-viirs-c2/csv/J2_VIIRS_C2_South_America_7d.csv",
    "VIIRS S-NPP": "https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_South_America_7d.csv",
}

def main(salida):
    salida = Path(salida)
    base = json.load(open(salida / "focos.json"))
    C, X0, Y0 = base["celda"], base["lon0"], base["lat0"]
    idx = {(c["x"], c["y"]): i for i, c in enumerate(base["celdas"])}
    # se usa UN satélite (el primero con datos) para que la escala sea la de un solo VIIRS, como la serie histórica
    for nombre, url in FUENTES.items():
        try:
            txt = urllib.request.urlopen(url, timeout=120).read().decode()
        except Exception as e:
            print(nombre, "falló:", e); continue
        puntos, fechas = [], set()
        for r in csv.DictReader(io.StringIO(txt)):
            if r.get("confidence") == "l": continue
            lat, lon = float(r["latitude"]), float(r["longitude"])
            i = idx.get((int((lon - X0) // C), int((lat - Y0) // C)))
            if i is None: continue
            puntos.append([round(lat, 3), round(lon, 3), i, r["acq_date"], round(float(r["frp"] or 0), 1)])
            fechas.add(r["acq_date"])
        if not fechas: print(nombre, "sin datos"); continue
        datos = {"fuente": nombre, "generado": datetime.now(timezone.utc).isoformat(timespec="minutes"),
                 "desde": min(fechas), "hasta": max(fechas), "puntos": puntos}
        with open(salida / "ultimos7.json", "w") as fh:
            json.dump(datos, fh, separators=(",", ":"))
        print(nombre, len(puntos), "focos en Bolivia,", datos["desde"], "a", datos["hasta"])
        return
    sys.exit("ninguna fuente respondió")

if __name__ == "__main__":
    main(sys.argv[1])
