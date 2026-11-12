# 🔥 BRASA · Calendario de quemas de Bolivia

**NASA Space Apps Challenge 2026 · Harmonization of MODIS and VIIRS Hot Spots · Santa Cruz de la Sierra**

BRASA junta 25 años de focos de calor de los satélites **MODIS** (2001–2025) y **VIIRS** (2012–hoy) en una sola escala y los convierte en un **calendario de quemas** para cualquier zona de Bolivia: cuándo empieza la temporada, cuándo es el pico, qué años fueron raros y si lo que pasa esta semana es normal.

> *English:* BRASA harmonizes 25 years of MODIS and VIIRS active-fire hotspots for Bolivia into one consistent, VIIRS-equivalent record and turns it into a burning-activity calendar for any area of interest, with critical periods, anomalies and a daily early-warning check. Switch language with the **EN** button.

## Qué hace

| | |
|---|---|
| 🗺️ **Mapa** | Cuadrícula de 0,25° por año, departamentos, zona propia dibujada con dos clics y focos de los últimos 7 días. |
| 📅 **Calendario** | Años × semanas, con las semanas fuera de lo normal marcadas. Se puede ver armonizado, solo MODIS o solo VIIRS. |
| 📈 **¿Cuándo se quema?** | Rango normal (percentiles 10–90), mediana, año elegido y temporada crítica (80 % de los focos). |
| 🚨 **Alerta temprana** | Focos de los últimos 7 días comparados con lo normal para esas fechas, más lo que viene en las próximas semanas. |
| 🧪 **Validación** | Prueba dejando un año fuera, 2012–2025: r = 0,979 semanal por departamento y error anual mediano de 3,7 %. |
| ⬇️ **Exportar** | CSV de la zona y enlace para compartir la vista. |

## Cómo se armoniza

1. Focos de **NASA FIRMS** (archivos anuales por país): MODIS C6.1 1 km y VIIRS S-NPP 375 m. Solo `type 0` (vegetación); sin confianza baja.
2. Cuadrícula común de 0,25° y semanas.
3. En 2012–2025, factor por cuadro `k = VIIRS / MODIS`, encogido hacia el factor nacional (≈ 3,8) donde hay pocos datos.
4. Serie armonizada en **focos equivalentes VIIRS**: antes de 2012 `MODIS × k` y desde 2012 VIIRS real. Así la serie sigue cuando MODIS se apague.

## Usarlo

```bash
cd web && python3 -m http.server 8000   # abrir http://127.0.0.1:8000
```

Para regenerar los datos:

```bash
# 1. bajar los CSV anuales de FIRMS a crudos/ (ver scripts/preparar.py)
python3 -I scripts/preparar.py crudos limites/bol-adm1.geojson web/datos
# 2. focos de los últimos 7 días (también lo hace la Action cada día)
python3 -I scripts/actualizar.py web/datos
```

## Datos y créditos

- NASA FIRMS — MODIS C6.1, VIIRS S-NPP y NOAA-20 375 m (archivos públicos).
- Límites de departamentos: geoBoundaries (CC BY 4.0).
- Mapa base: Esri. Librería de mapas: Leaflet (BSD-2).
- Los focos son detecciones térmicas, no área quemada.
