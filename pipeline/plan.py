"""Stages 1-5: homes, poles, wireless reach, cheapest network, pricing.

Run:  python plan.py towns-ga
"""
import json
import math
import os
import sys

import numpy as np
from scipy.sparse import coo_matrix, csr_matrix
from scipy.sparse.csgraph import connected_components, dijkstra, minimum_spanning_tree
from scipy.spatial import cKDTree

import fetch
import geo
import los
from common import COUNTIES, OUT, county_config, Proj, point_in_polygon, polygon_area

FT = 3.28084

# Adjustable assumptions. The web app lets the user change every one of these.
ASSUME = {
    "aerialPerFt": 9.0,
    "buriedPerFt": 19.0,
    "dropBase": 1100.0,
    "dropPerFt": 6.0,
    "towerEach": 200000.0,
    "wirelessCpe": 700.0,
}

SEG_M = 60.0  # road densification step
POLE_NEAR_M = 45.0
MIN_HOME_M2 = 60.0
MAX_HOME_M2 = 600.0
TOWER_CAP = 250  # homes one tower site can serve


def main(arg):
    c = county_config(arg)
    slug = c["slug"]
    geom = fetch.boundary(c)
    bb = fetch.bbox_of(geom)
    if not c.get("hub"):
        resolve_places(c, bb)
    proj = Proj((bb[1] + bb[3]) / 2, (bb[0] + bb[2]) / 2)
    ring_ll = geom["coordinates"][0] if geom["type"] == "Polygon" else max((p[0] for p in geom["coordinates"]), key=len)
    ring_xy = np.array(proj.fwd(*np.array(ring_ll).T)).T

    # ---- terrain + canopy grids ------------------------------------------------
    dem, dem_meta = fetch.terrain(c, bb)
    can, can_meta = fetch.canopy(c, bb)
    elev_q, can_q, gmeta = geo.build_grids(bb, dem, dem_meta, can, can_meta)
    grid = geo.Grid(elev_q, can_q, gmeta)

    # ---- stage 1: homes --------------------------------------------------------
    feats = fetch.footprints(c, bb)
    lon_c = np.array([sum(p[0] for p in r) / len(r) for r in feats])
    lat_c = np.array([sum(p[1] for p in r) / len(r) for r in feats])
    area = np.array([polygon_area(*proj.fwd(*np.array(r).T)) for r in feats])
    hx, hy = proj.fwd(lon_c, lat_c)
    keep = point_in_polygon(hx, hy, ring_xy) & (area >= MIN_HOME_M2) & (area <= MAX_HOME_M2)
    hx, hy, lon_c, lat_c = hx[keep], hy[keep], lon_c[keep], lat_c[keep]
    n_homes = len(hx)
    print("homes", n_homes, "of", len(feats), "footprints")

    # ---- road graph ------------------------------------------------------------
    ways = fetch.roads(c, bb)
    key2i, nlon, nlat = {}, [], []
    eu, ev, elen, eway, ename = [], [], [], [], []

    def node(lon, lat):
        k = (round(lon, 6), round(lat, 6))
        if k not in key2i:
            key2i[k] = len(nlon)
            nlon.append(lon)
            nlat.append(lat)
        return key2i[k]

    way_names = []
    for wi, w in enumerate(ways):
        pts = [(g["lon"], g["lat"]) for g in w["geometry"]]
        way_names.append(w.get("tags", {}).get("name", ""))
        for (a_lon, a_lat), (b_lon, b_lat) in zip(pts[:-1], pts[1:]):
            ax, ay = proj.fwd(a_lon, a_lat)
            bx, by = proj.fwd(b_lon, b_lat)
            L = float(math.hypot(bx - ax, by - ay))
            if L < 0.5:
                continue
            k = max(1, int(math.ceil(L / SEG_M)))
            prev = node(a_lon, a_lat)
            for i in range(1, k + 1):
                t = i / k
                cur = node(a_lon + (b_lon - a_lon) * t, a_lat + (b_lat - a_lat) * t) if i < k else node(b_lon, b_lat)
                if cur != prev:
                    eu.append(prev)
                    ev.append(cur)
                    elen.append(L / k)
                    eway.append(wi)
                prev = cur
    nlon, nlat = np.array(nlon), np.array(nlat)
    nx_, ny_ = proj.fwd(nlon, nlat)
    eu, ev, elen, eway = map(np.array, (eu, ev, elen, eway))
    print("graph", len(nlon), "nodes", len(eu), "edges", round(elen.sum() / 1000), "km")

    # ---- stage 2: poles -> aerial vs buried per road segment -------------------
    osm = fetch.osm_power(c, bb)
    poles = []  # (lon, lat, source)
    for e in osm:
        if e["type"] == "node" and e.get("tags", {}).get("power") == "pole":
            poles.append((e["lon"], e["lat"], "osm"))
        if e["type"] == "way" and e.get("tags", {}).get("power") == "minor_line":
            g = e["geometry"]
            for a, b in zip(g[:-1], g[1:]):
                ax, ay = proj.fwd(a["lon"], a["lat"])
                bx, by = proj.fwd(b["lon"], b["lat"])
                L = math.hypot(bx - ax, by - ay)
                for i in range(max(1, int(L // 25)) + 1):
                    t = min(1.0, i * 25 / max(L, 1))
                    poles.append((a["lon"] + (b["lon"] - a["lon"]) * t, a["lat"] + (b["lat"] - a["lat"]) * t, "osm-line"))
    mp = fetch.mapillary_poles(c, bb)
    pole_source = "OpenStreetMap power=pole and power=minor_line"
    if mp:
        poles += [(p["lon"], p["lat"], "mapillary") for p in mp]
        pole_source = "Mapillary utility-pole detections plus OpenStreetMap"
    pole_ll = np.array([(p[0], p[1]) for p in poles]) if poles else np.zeros((0, 2))
    px, py = proj.fwd(pole_ll[:, 0], pole_ll[:, 1]) if len(pole_ll) else (np.array([]), np.array([]))
    mx, my = (nx_[eu] + nx_[ev]) / 2, (ny_[eu] + ny_[ev]) / 2
    if len(px):
        ptree = cKDTree(np.c_[px, py])
        counts = np.array([len(x) for x in ptree.query_ball_point(np.c_[mx, my], POLE_NEAR_M)])
    else:
        counts = np.zeros(len(eu), dtype=int)
    aerial = counts > 0
    print("poles", len(poles), "source:", pole_source, "| aerial edges", round(aerial.mean() * 100, 1), "%")

    # ---- coverage status per home ----------------------------------------------
    status, coverage_source = coverage(c, proj, lon_c, lat_c, hx, hy)
    print("coverage:", coverage_source, {k: int((status == k).sum()) for k in (0, 1, 2)})

    # ---- snap homes to roads ---------------------------------------------------
    ntree = cKDTree(np.c_[nx_, ny_])
    dist_to_road, snap = ntree.query(np.c_[hx, hy])
    hub_node = int(ntree.query(proj.fwd(c["hub"][1], c["hub"][0]))[1])

    # ---- stage 3: wireless line of sight ---------------------------------------
    unserved = np.where(status == 2)[0]
    towers, tower_cover = pick_towers(c, osm, proj, grid, nlon, nlat, nx_, ny_, hx, hy, lon_c, lat_c, unserved)
    print("towers", len(towers), "covering", len({h for t in tower_cover for h in tower_cover[t]}), "unserved homes")

    # ---- stages 4-5: network + pricing, with the wireless decision -------------
    g = Graph(nlon, nlat, nx_, ny_, eu, ev, elen, aerial)
    # Price fiber-for-everyone first, then move a home to wireless when a tower can see it and
    # its fiber share costs more than its share of tower + CPE.
    tree_full = steiner(g, hub_node, snap[unserved], ASSUME)
    share_full = tree_full.node_share(snap, list(unserved), ASSUME, dist_to_road)
    assign = {}
    for t, hs in tower_cover.items():
        for h, m in hs.items():
            if h not in assign or m > assign[h][1]:
                assign[h] = (t, m)
    wireless_set = set()
    for t in tower_cover:
        # a sector tower serves a limited number of subscribers: keep the costliest-to-reach homes
        cand = sorted((h for h in assign if assign[h][0] == t and h not in wireless_set), key=lambda h: -share_full[h])[:TOWER_CAP]
        while cand:
            per = ASSUME["wirelessCpe"] + ASSUME["towerEach"] / len(cand)
            nxt = [h for h in cand if share_full[h] > per]
            if len(nxt) == len(cand):
                break
            cand = nxt
        if len(cand) >= 25:
            wireless_set.update(cand)
    wl_by_tower = {}
    for h in wireless_set:
        wl_by_tower.setdefault(assign[h][0], []).append(h)
    used_towers = sorted(wl_by_tower)
    terminals = [h for h in unserved if h not in wireless_set]
    tree = steiner(g, hub_node, snap[terminals], ASSUME)
    share = tree.node_share(snap, terminals, ASSUME, dist_to_road)

    emit(c, slug, proj, grid, gmeta, elev_q, can_q, ways, way_names, g, tree, terminals, unserved, wireless_set,
         wl_by_tower, used_towers, towers, tower_cover, assign, share, snap, dist_to_road, status, lon_c, lat_c, hx, hy,
         poles, counts, coverage_source, pole_source, hub_node, n_homes, bb, ring_ll)


# ---------------------------------------------------------------------------


def resolve_places(c, bb):
    """Hub = the largest named place in the county; every city/town/village core counts as served (proxy)."""
    rank = {"city": 3, "town": 2, "village": 1}
    radius = {"city": 2200, "town": 1500, "village": 800}
    pl = [e for e in fetch.places(c, bb) if e.get("tags", {}).get("name")]
    if not pl:
        la, lo = c["center"]
        c["hub"], c["cores"] = (la, lo), []
        return
    pl.sort(key=lambda e: (rank[e["tags"]["place"]], int(str(e["tags"].get("population", "0")).replace(",", "") or 0)), reverse=True)
    c["hub"] = (pl[0]["lat"], pl[0]["lon"])
    c["cores"] = [(e["lat"], e["lon"], radius[e["tags"]["place"]]) for e in pl]


def coverage(c, proj, lon, lat, hx, hy):
    """0 served, 1 underserved, 2 unserved.

    Uses an FCC availability file if one is present (see README); otherwise falls back
    to a clearly-labeled proxy: homes outside the town cores count as unserved.
    """
    p = os.path.join(os.path.dirname(__file__), "data", f"{c['slug']}-fcc-h3.csv")
    if os.path.exists(p):
        import csv

        import h3

        speed = {}
        with open(p) as f:
            for r in csv.DictReader(f):
                speed[r["h3_res8_id"]] = max(speed.get(r["h3_res8_id"], 0), float(r["max_advertised_download_speed"]))
        st = np.zeros(len(lon), dtype=int)
        for i, (lo, la) in enumerate(zip(lon, lat)):
            s = speed.get(h3.latlng_to_cell(la, lo, 8), 0)
            st[i] = 0 if s >= 100 else (1 if s >= 25 else 2)
        return st, "fcc"
    served = np.zeros(len(lon), dtype=bool)
    for la, lo, r in c["cores"]:
        cx, cy = proj.fwd(lo, la)
        served |= np.hypot(hx - cx, hy - cy) <= r
    # dense neighborhoods are almost always served by cable or fiber: 25+ homes within 300 m
    pts = np.c_[hx, hy]
    dense = np.array([len(x) for x in cKDTree(pts).query_ball_point(pts, 300)]) >= 25
    return np.where(served | dense, 0, 2), "proxy"


def pick_towers(c, osm, proj, grid, nlon, nlat, nx_, ny_, hx, hy, lon_c, lat_c, unserved):
    """Candidate sites: existing communication towers plus road-accessible high points."""
    cands = []
    for e in osm:
        t = e.get("tags", {})
        if t.get("tower:type") == "communication" or (t.get("man_made") in ("tower", "mast") and t.get("communication:mobile_phone")):
            lo = e.get("lon") or e.get("center", {}).get("lon")
            la = e.get("lat") or e.get("center", {}).get("lat")
            if lo is not None:
                cands.append((lo, la, "existing"))
    el = grid.elev(nlon, nlat)
    tree = cKDTree(np.c_[nx_, ny_])
    # road-accessible high points: highest node first, suppress everything within 1.2 km
    local = np.zeros(len(nlon), dtype=bool)
    dead = np.zeros(len(nlon), dtype=bool)
    for i in np.argsort(-el):
        if dead[i]:
            continue
        local[i] = True
        dead[tree.query_ball_point([nx_[i], ny_[i]], 1200)] = True
    uh = cKDTree(np.c_[hx[unserved], hy[unserved]])
    idx = np.where(local)[0]
    prom = []
    for i in idx:
        near = uh.query_ball_point([nx_[i], ny_[i]], 5000)
        prom.append(el[i] - (np.median(grid.elev(lon_c[unserved][near], lat_c[unserved][near])) if near else el[i]))
    order = idx[np.argsort(prom)[::-1]][:90]
    for i in order:
        cands.append((nlon[i], nlat[i], "site"))
    # evaluate
    kx, ky = proj.kx, proj.ky
    cover = []
    ux, uy = hx[unserved], hy[unserved]
    for lo, la, kind in cands:
        tx_, ty_ = proj.fwd(lo, la)
        near = np.where(np.hypot(ux - tx_, uy - ty_) <= los.MAX_M)[0]
        d = {}
        if len(near):
            m, _ = los.margins(grid, lo, la, lon_c[unserved][near], lat_c[unserved][near], kx, ky)
            for j, mm in zip(near, m):
                if mm >= 0:
                    d[int(unserved[j])] = float(mm)
        cover.append(d)
    # greedy set cover
    chosen, covered = [], set()
    for _ in range(14):
        best, gain = None, 0
        for i, d in enumerate(cover):
            if i in chosen:
                continue
            gsz = len(set(d) - covered)
            if gsz > gain:
                best, gain = i, gsz
        if best is None or gain < 40:
            break
        chosen.append(best)
        covered |= set(cover[best])
    towers = [{"lon": float(cands[i][0]), "lat": float(cands[i][1]), "kind": cands[i][2]} for i in chosen]
    tower_cover = {k: cover[i] for k, i in enumerate(chosen)}
    return towers, tower_cover


class Graph:
    def __init__(self, nlon, nlat, nx_, ny_, eu, ev, elen, aerial):
        self.nlon, self.nlat, self.nx, self.ny = nlon, nlat, nx_, ny_
        self.eu, self.ev, self.elen, self.aerial = eu, ev, elen, aerial
        self.n = len(nlon)
        self.eidx = {}
        for i, (u, v) in enumerate(zip(eu, ev)):
            self.eidx[(min(u, v), max(u, v))] = i

    def weights(self, a):
        rate = np.where(self.aerial, a["aerialPerFt"], a["buriedPerFt"])
        return self.elen * FT * rate


class Tree:
    def __init__(self, g, root, edges, homes_at):
        self.g, self.root = g, root
        self.edges = edges  # set of edge indices
        adj = {}
        for ei in edges:
            u, v = int(g.eu[ei]), int(g.ev[ei])
            adj.setdefault(u, []).append((v, ei))
            adj.setdefault(v, []).append((u, ei))
        self.parent, self.pedge, order = {root: None}, {root: None}, [root]
        for u in order:
            for v, ei in adj.get(u, []):
                if v not in self.parent:
                    self.parent[v], self.pedge[v] = u, ei
                    order.append(v)
        self.order = order
        self.down = {u: homes_at.get(u, 0) for u in order}
        for u in reversed(order[1:]):
            self.down[self.parent[u]] += self.down[u]

    def node_share(self, snap, terminals, a, dist_to_road):
        """Fiber cost per home: shared trunk split among downstream homes, plus its own drop."""
        w = self.g.weights(a)
        share = {self.root: 0.0}
        for u in self.order[1:]:
            ei = self.pedge[u]
            share[u] = share[self.parent[u]] + w[ei] / max(self.down[u], 1)
        out = {}
        for h in terminals:
            n = int(snap[h])
            out[h] = share.get(n, 0.0) + a["dropBase"] + a["dropPerFt"] * dist_to_road[h] * 1.25 * FT
        return out


def steiner(g, root, term_nodes, a):
    """Kou-Markowsky-Berman 2-approximation of the minimum Steiner tree (Mehlhorn's Voronoi form).

    Shortest paths between terminals, a minimum spanning tree over them, then mapped back
    onto real road segments and pruned.
    """
    w = g.weights(a)
    n = g.n
    A = csr_matrix(coo_matrix((np.r_[w, w], (np.r_[g.eu, g.ev], np.r_[g.ev, g.eu])), shape=(n, n)))
    ncomp, lab = connected_components(A, directed=False)
    homes_at = {}
    for t in term_nodes:
        t = int(t)
        if lab[t] == lab[root]:
            homes_at[t] = homes_at.get(t, 0) + 1
    terms = sorted(set(homes_at) | {root})
    dist, pred, src = dijkstra(A, directed=False, indices=terms, return_predecessors=True, min_only=True)
    tid = {t: i for i, t in enumerate(terms)}
    best = {}
    for ei in range(len(g.eu)):
        u, v = int(g.eu[ei]), int(g.ev[ei])
        if src[u] < 0 or src[v] < 0 or src[u] == src[v]:
            continue
        a_, b_ = tid[int(src[u])], tid[int(src[v])]
        k = (min(a_, b_), max(a_, b_))
        cost = dist[u] + w[ei] + dist[v]
        if k not in best or cost < best[k][0]:
            best[k] = (cost, u, v, ei)
    ks = list(best)
    rows = [k[0] for k in ks]
    cols = [k[1] for k in ks]
    vals = [best[k][0] + 1e-6 for k in ks]
    T = csr_matrix(coo_matrix((vals, (rows, cols)), shape=(len(terms), len(terms))))
    mst = minimum_spanning_tree(T).tocoo()
    chosen = set()

    def walk(x):
        while pred[x] >= 0:
            chosen.add(g.eidx[(min(x, int(pred[x])), max(x, int(pred[x])))])
            x = int(pred[x])

    for i, j in zip(mst.row, mst.col):
        k = (min(i, j), max(i, j))
        _, u, v, ei = best[k]
        chosen.add(ei)
        walk(u)
        walk(v)
    # remove cycles, then prune non-terminal leaves
    sub = list(chosen)
    S = csr_matrix(coo_matrix((w[sub] + 1e-9, (g.eu[sub], g.ev[sub])), shape=(n, n)))
    m2 = minimum_spanning_tree(S).tocoo()
    edges = {g.eidx[(min(int(u), int(v)), max(int(u), int(v)))] for u, v in zip(m2.row, m2.col)}
    deg = {}
    for ei in edges:
        for x in (int(g.eu[ei]), int(g.ev[ei])):
            deg[x] = deg.get(x, 0) + 1
    keep_nodes = set(homes_at) | {root}
    stack = [x for x, d in deg.items() if d == 1 and x not in keep_nodes]
    inc = {}
    for ei in edges:
        inc.setdefault(int(g.eu[ei]), set()).add(ei)
        inc.setdefault(int(g.ev[ei]), set()).add(ei)
    while stack:
        x = stack.pop()
        if x in keep_nodes or len(inc.get(x, ())) != 1:
            continue
        ei = next(iter(inc[x]))
        edges.discard(ei)
        for y in (int(g.eu[ei]), int(g.ev[ei])):
            inc[y].discard(ei)
            if y != x and len(inc[y]) == 1 and y not in keep_nodes:
                stack.append(y)
    return Tree(g, root, edges, homes_at)


def emit(c, slug, proj, grid, gmeta, elev_q, can_q, ways, way_names, g, tree, terminals, unserved, wireless_set,
         wl_by_tower, used_towers, towers, tower_cover, assign, share, snap, dist_to_road, status, lon_c, lat_c, hx, hy,
         poles, counts, coverage_source, pole_source, hub_node, n_homes, bb, ring_ll):
    out = os.path.join(OUT, slug)
    os.makedirs(out, exist_ok=True)
    r5 = lambda x: round(float(x), 5)

    # tree edges with animation order (cost distance from hub)
    w = g.weights(ASSUME)
    depth = {tree.root: 0.0}
    for u in tree.order[1:]:
        depth[u] = depth[tree.parent[u]] + w[tree.pedge[u]]
    tedges = []
    aerial_ft = buried_ft = 0.0
    for u in tree.order[1:]:
        ei = tree.pedge[u]
        p = tree.parent[u]
        cls = 1 if g.aerial[ei] else 2
        ft = g.elen[ei] * FT
        aerial_ft += ft if cls == 1 else 0
        buried_ft += ft if cls == 2 else 0
        tedges.append([r5(g.nlon[p]), r5(g.nlat[p]), r5(g.nlon[u]), r5(g.nlat[u]), cls, int(depth[u]), int(tree.down[u])])
    tedges.sort(key=lambda e: e[5])
    max_depth = tedges[-1][5] if tedges else 0

    # homes
    fiber_homes = [h for h in terminals if int(snap[h]) in tree.parent]
    unreached = [h for h in terminals if int(snap[h]) not in tree.parent]
    fcoords = np.array([hx[fiber_homes], hy[fiber_homes]]).T if fiber_homes else np.zeros((0, 2))
    ftree = cKDTree(fcoords) if len(fcoords) else None
    fiber_set = set(fiber_homes)
    tower_xy = [proj.fwd(towers[t]["lon"], towers[t]["lat"]) for t in range(len(towers))]
    all_t = np.array([[x, y] for x, y in tower_xy]) if tower_xy else np.zeros((0, 2))
    drop_ft_total = 0.0
    # why a fiber home is not wireless: 1 ridge, 2 trees, 3 no tower in range, 4 visible but fiber is cheaper
    why = {}
    fib = np.array(sorted(fiber_set))
    if len(fib) and len(all_t):
        near_t = np.array([np.hypot(all_t[:, 0] - hx[h], all_t[:, 1] - hy[h]).argmin() for h in fib])
        for t in np.unique(near_t):
            hs = fib[near_t == t]
            d = np.hypot(hx[hs] - all_t[t][0], hy[hs] - all_t[t][1])
            ok = d <= los.MAX_M
            m_all, _ = los.margins(grid, towers[t]["lon"], towers[t]["lat"], lon_c[hs], lat_c[hs], proj.kx, proj.ky)
            m_ter, _ = los.margins(grid, towers[t]["lon"], towers[t]["lat"], lon_c[hs], lat_c[hs], proj.kx, proj.ky, use_canopy=False)
            for h, o, ma, mt in zip(hs, ok, m_all, m_ter):
                why[int(h)] = 3 if not o else (4 if ma >= 0 else (1 if mt < 0 else 2))
    homes = []
    for h in range(len(hx)):
        st = int(status[h])
        tech, cost, nb, tw, btw, npole, hdepth = 0, 0, 0, -1, -1, 0, 0
        if st == 2:
            if h in wireless_set:
                tech = 3
                t = assign[h][0]
                tw = t
                hdepth = max_depth
                cost = ASSUME["wirelessCpe"] + ASSUME["towerEach"] / len(wl_by_tower[t])
            elif h in fiber_set:
                n = int(snap[h])
                hdepth = int(depth.get(n, 0))
                pe = tree.pedge.get(n)
                if pe is None:  # sits on the hub node; borrow a neighboring tree edge
                    pe = next(iter(tree.edges), None)
                tech = 1 if (pe is not None and g.aerial[pe]) else 2
                npole = int(counts[pe]) if pe is not None else 0
                cost = share[h]
                drop_ft_total += dist_to_road[h] * 1.25 * FT
                nb = max(0, len(ftree.query_ball_point([hx[h], hy[h]], 300)) - 1)
            else:
                tech = 0
                cost = 0
            # nearest candidate tower that cannot see this home (for the line-of-sight screen)
            if tech in (1, 2) and len(all_t):
                dd = np.hypot(all_t[:, 0] - hx[h], all_t[:, 1] - hy[h])
                j = int(dd.argmin())
                if dd[j] <= los.MAX_M:
                    btw = j
        homes.append([r5(lon_c[h]), r5(lat_c[h]), st, tech, int(round(cost)), nb, tw, btw, npole, int(round(dist_to_road[h] * FT)), why.get(h, 0), hdepth])

    towers_out = [{
        "id": t, "lon": r5(towers[t]["lon"]), "lat": r5(towers[t]["lat"]), "kind": towers[t]["kind"],
        "used": t in wl_by_tower, "homes": len(wl_by_tower.get(t, [])), "reach": len(tower_cover[t]),
    } for t in range(len(towers))]

    n_fiber = len(fiber_homes)
    n_wl = len(wireless_set)
    totals = {
        "homesAll": n_homes,
        "unserved": int(len(unserved)),
        "fiberHomes": n_fiber,
        "wirelessHomes": n_wl,
        "unreached": len(unreached),
        "towers": len(used_towers),
        "aerialFt": round(aerial_ft),
        "buriedFt": round(buried_ft),
        "dropFt": round(drop_ft_total),
    }
    tot_cost = (aerial_ft * ASSUME["aerialPerFt"] + buried_ft * ASSUME["buriedPerFt"] + n_fiber * ASSUME["dropBase"]
                + drop_ft_total * ASSUME["dropPerFt"] + len(used_towers) * ASSUME["towerEach"] + n_wl * ASSUME["wirelessCpe"])
    print("TOTALS", totals, "cost", round(tot_cost), "per home", round(tot_cost / max(n_fiber + n_wl, 1)))

    # all roads for the basemap
    roads = []
    for w_ in ways:
        roads.append([[r5(p["lon"]), r5(p["lat"])] for p in w_["geometry"]])

    pole_pts = [[r5(p[0]), r5(p[1]), 0 if p[2] == "mapillary" else 1] for p in poles if p[2] != "osm-line"]

    meta = {
        "slug": slug, "name": c["name"], "state": c["state"], "geoid": c["geoid"],
        "bbox": [r5(x) for x in bb], "hub": [c["hub"][1], c["hub"][0]],
        "boundary": [[r5(a), r5(b)] for a, b in ring_ll],
        "assumptions": ASSUME, "totals": totals,
        "benchmark": c["benchmark"],
        "coverageSource": coverage_source,
        "poleSource": pole_source,
        "poleCount": len(pole_pts),
        "grid": gmeta,
        "los": {"towerH": los.TOWER_H, "homeH": los.HOME_H, "freqHz": los.FREQ, "fresnel": los.FRESNEL,
                "k": los.K_EARTH, "maxM": los.MAX_M, "n": los.N, "endSkip": los.END_SKIP},
        "homeFields": ["lon", "lat", "status", "tech", "cost", "neighbors", "tower", "blockedTower", "poles", "dropFt", "why", "depth"],
        "generated": __import__("datetime").date.today().isoformat(),
        "generatedAt": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    dump = lambda name, obj: open(os.path.join(out, name), "w").write(json.dumps(obj, separators=(",", ":")))
    dump("county.json", meta)
    dump("homes.json", homes)
    dump("roads.json", roads)
    dump("plan.json", tedges)
    dump("towers.json", towers_out)
    dump("poles.json", pole_pts)
    elev_q.astype("<i2").tofile(os.path.join(out, "elev.bin"))
    can_q.astype("u1").tofile(os.path.join(out, "canopy.bin"))
    print("wrote", out)
    write_index()
    if os.environ.get("FIBERPATH_CLEAN"):
        import shutil
        shutil.rmtree(os.path.join(os.path.dirname(os.path.abspath(__file__)), "cache", slug), ignore_errors=True)


def write_index():
    items = []
    for d in sorted(os.listdir(OUT)):
        f = os.path.join(OUT, d, "county.json")
        if os.path.exists(f):
            m = json.load(open(f))
            t = m["totals"]
            homes = t["fiberHomes"] + t["wirelessHomes"]
            items.append({"slug": m["slug"], "name": m["name"], "state": m["state"], "geoid": m["geoid"], "bbox": m["bbox"],
                          "homes": t["homesAll"], "unserved": t["unserved"], "reached": homes,
                          "fiberHomes": t["fiberHomes"], "wirelessHomes": t["wirelessHomes"], "towers": t["towers"],
                          "aerialFt": t["aerialFt"], "buriedFt": t["buriedFt"], "dropFt": t["dropFt"],
                          "assumptions": m["assumptions"], "coverageSource": m["coverageSource"], "plannedAt": m.get("generatedAt")})
    tmp = os.path.join(OUT, f"index.{os.getpid()}.tmp")
    json.dump(items, open(tmp, "w"), separators=(",", ":"))
    os.replace(tmp, os.path.join(OUT, "index.json"))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "towns-ga")

