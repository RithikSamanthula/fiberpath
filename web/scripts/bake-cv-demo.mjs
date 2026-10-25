import fs from "fs";
import path from "path";

const BASE = process.env.BASE || "http://localhost:3111";
const N = Number(process.argv[2] || 6);
const out = path.join(process.cwd(), "public", "cv-demo");
fs.mkdirSync(out, { recursive: true });
const poles = JSON.parse(fs.readFileSync("public/data/towns-ga/poles.json", "utf8")).filter((p) => p[2] === 0);
const rnd = (() => { let s = 11; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
const seen = new Set();
const cands = [];
for (let tries = 0; tries < 90 && cands.length < N * 3; tries++) {
  const p = poles[Math.floor(rnd() * poles.length)];
  const r = await fetch(`${BASE}/api/streetview?lat=${p[1]}&lon=${p[0]}&n=4`).then((x) => x.json()).catch(() => null);
  for (const im of r?.images ?? []) {
    if (seen.has(im.id) || im.boxes.length < 2) continue;
    seen.add(im.id);
    const d = await fetch(`${BASE}/api/detect?u=${encodeURIComponent(im.url)}&t=0.3&debug=1`).then((x) => x.json()).catch(() => null);
    if (!d?.boxes) continue;
    const util = d.boxes.filter((b) => (b.cls ?? 0) === 0).length;
    const other = d.boxes.length - util;
    cands.push({ im, d, score: util + (other ? 2 : 0) + Math.min(im.boxes.length, 4) * 0.2 });
  }
}
cands.sort((a, b) => b.score - a.score);
const manifest = [];
let k = 0;
for (const { im, d } of cands.slice(0, N)) {
  const buf = Buffer.from(await (await fetch(`${BASE}/api/img?u=${encodeURIComponent(im.url)}`)).arrayBuffer());
  fs.writeFileSync(path.join(out, `${k}.jpg`), buf);
  manifest.push({ img: `/cv-demo/${k}.jpg`, place: `Towns County, Georgia${im.capturedAt ? `, ${new Date(im.capturedAt).getFullYear()}` : ""}`, boxes: d.boxes, candidates: d.candidates ?? [] });
  k++;
}
fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify(manifest));
console.log("baked", manifest.length, "photos;", manifest.map((m) => `${m.boxes.length} boxes`).join(", "));
