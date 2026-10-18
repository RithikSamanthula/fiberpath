"""Terrain + canopy grids on a regular lon/lat lattice, plus bilinear sampling.

The same quantized grids are shipped to the web app, so the pipeline and the
line-of-sight screen always agree.
"""
import math

import numpy as np
from scipy.ndimage import map_coordinates

DLON = 0.0003
DLAT = 0.00027
ELEV_SCALE = 10.0  # int16 decimeters
CANOPY_SCALE = 4.0  # uint8 quarter meters


def build_grids(bb, dem, dem_meta, can, can_meta):
    w, s, e, n = bb
    nx = int(math.ceil((e - w) / DLON)) + 1
    ny = int(math.ceil((n - s) / DLAT)) + 1
    lons = w + np.arange(nx) * DLON
    lats = n - np.arange(ny) * DLAT  # row 0 is the north edge
    LON, LAT = np.meshgrid(lons, lats)

    x0, y0, z = dem_meta
    k = 2**z
    tx = (LON + 180) / 360 * k
    ty = (1 - np.arcsinh(np.tan(np.radians(LAT))) / np.pi) / 2 * k
    el = map_coordinates(dem, [(ty - y0) * 256 - 0.5, (tx - x0) * 256 - 0.5], order=1, mode="nearest")

    mx0, my0, mx1, my1, res = can_meta
    mx = LON * 20037508.342789244 / 180
    my = np.log(np.tan((90 + LAT) * np.pi / 360)) * 20037508.342789244 / np.pi
    ca = map_coordinates(can, [(my1 - my) / res - 0.5, (mx - mx0) / res - 0.5], order=1, mode="nearest")

    elev_q = np.round(el * ELEV_SCALE).astype(np.int16)
    can_q = np.clip(np.round(ca * CANOPY_SCALE), 0, 255).astype(np.uint8)
    meta = {"w": float(w), "n": float(n), "dlon": DLON, "dlat": DLAT, "nx": nx, "ny": ny,
            "elevScale": ELEV_SCALE, "canopyScale": CANOPY_SCALE}
    return elev_q, can_q, meta


class Grid:
    def __init__(self, elev_q, can_q, meta):
        self.el = elev_q.astype(np.float32) / meta["elevScale"]
        self.ca = can_q.astype(np.float32) / meta["canopyScale"]
        self.m = meta

    def _rc(self, lon, lat):
        return (self.m["n"] - lat) / self.m["dlat"], (lon - self.m["w"]) / self.m["dlon"]

    def elev(self, lon, lat):
        r, c = self._rc(lon, lat)
        return map_coordinates(self.el, [r, c], order=1, mode="nearest")

    def canopy(self, lon, lat):
        r, c = self._rc(lon, lat)
        return map_coordinates(self.ca, [r, c], order=1, mode="nearest")
