"""Wireless line of sight: terrain + canopy vs. the 60% Fresnel zone."""
import numpy as np

TOWER_H = 25.0  # m above ground
HOME_H = 6.0
FREQ = 5.8e9
LAMBDA = 299_792_458.0 / FREQ
K_EARTH = 4 / 3
R_EARTH = 6_371_000.0
FRESNEL = 0.6
MAX_M = 7000.0
N = 300
END_SKIP = 30.0  # ignore the first/last 30 m (the antenna sits above its own trees)


def margins(grid, t_lon, t_lat, lons, lats, kx, ky, use_canopy=True):
    """Clearance margin (m) for one tower against many homes. Negative = blocked.

    Returns (margin, worst_fraction) arrays.
    """
    lons = np.asarray(lons)
    lats = np.asarray(lats)
    f = np.linspace(0, 1, N)[None, :]
    plon = t_lon + (lons[:, None] - t_lon) * f
    plat = t_lat + (lats[:, None] - t_lat) * f
    d = np.hypot((lons - t_lon) * kx, (lats - t_lat) * ky)[:, None]
    ground = grid.elev(plon.ravel(), plat.ravel()).reshape(plon.shape)
    tree = grid.canopy(plon.ravel(), plat.ravel()).reshape(plon.shape)
    surf = ground + (tree if use_canopy else 0)
    h0 = ground[:, :1] + TOWER_H
    h1 = ground[:, -1:] + HOME_H
    line = h0 + (h1 - h0) * f
    d1 = d * f
    d2 = d * (1 - f)
    bulge = d1 * d2 / (2 * K_EARTH * R_EARTH)
    r1 = np.sqrt(LAMBDA * d1 * d2 / np.maximum(d, 1.0))
    clear = line - FRESNEL * r1 - (surf + bulge)
    skip = (d1 < END_SKIP) | (d2 < END_SKIP)
    clear = np.where(skip, 1e3, clear)
    worst = clear.argmin(axis=1)
    return clear.min(axis=1), f[0][worst]
