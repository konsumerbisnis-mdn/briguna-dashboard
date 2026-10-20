/* Logika utama: boot & login, ambil data dari Apps Script, olah data, router SPA, Dashboard, Detail Debitur, Admin.
   Aturan perhitungan mengikuti Ketentuan Olah Data LW321 (Project BRIguna):
   - Keragaan & RKA Rp juta (RKA dari Rupiah penuh), Briguna Ritel = Karya + Purna + Pra-Purna.
   - %Penc OS/DEB = realisasi ÷ RKA; SML/NPL = RKA ÷ realisasi (maks. 120%).
   - Net disburse = Delta Suplesi; kuadran RM: K1 ≥105%, K2 100–105%, K3 50–100%, K4 <50% dari target.
   - Kriteria kredit LW321: SML 1/2/3, NPL Baru, NPL < 2 th, NPL, One Obligor (tunggakan 0 / umur tidak sejalan KOL_ADK). */
(function () {
  "use strict";
  const A = window.Auth, esc = A.esc, CFG = window.APP_CONFIG;
  const $ = (s, el = document) => el.querySelector(s), $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const nf0 = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }), nf1 = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 }), nf2 = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sum = (a, k) => a.reduce((s, x) => s + (+(typeof k === "function" ? k(x) : x[k]) || 0), 0);
  const uniq = a => [...new Set(a)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pct = (v, d = 1) => v == null || !isFinite(v) ? "–" : [nf0, nf1, nf2][d].format(v * 100) + "%";
  const rpJ = j => { const a = Math.abs(j || 0); return a >= 1e6 ? "Rp " + nf2.format(j / 1e6) + " T" : a >= 1000 ? "Rp " + nf2.format(j / 1000) + " M" : "Rp " + nf1.format(j || 0) + " Jt"; };
  const rpR = v => rpJ((v || 0) / 1e6), rpFull = v => "Rp " + nf0.format(Math.round(v || 0));
  const tglS = d => d ? `${+d.slice(8, 10)} ${BULAN[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}` : "–";
  const ymS = ym => BULAN[+ym.slice(5, 7) - 1] + "'" + ym.slice(2, 4);
  const nmKey = s => String(s || "").toLowerCase().replace(/y/g, "i").replace(/[^a-z]/g, "");
  const pnKey = v => String(v ?? "").replace(/\D/g, "").replace(/^0+/, "");
  const chip = (t, c) => `<span class="chip ${c}">${t}</span>`;
  const capaiCls = v => v == null ? "neutral" : v >= 1 ? "good" : v >= .8 ? "warn" : "crit";
  const kuadOf = p => p == null ? null : p >= 1.05 ? 1 : p >= 1 ? 2 : p >= .5 ? 3 : 4;
  const kq = k => `<span class="kq k${k || 0}">${k ? "K" + k : "–"}</span>`;
  const dCls = (v, goodUp = true) => Math.abs(v) < 1e-9 ? "flat" : (v > 0) === goodUp ? "up" : "down";
  const dJ = v => `<span class="delta ${dCls(v)}">${v >= 0 ? "+" : "−"}${nf1.format(Math.abs(v))}</span>`;
  const titleCase = s => String(s || "").toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase()).replace(/\s+/g, " ").trim();
  function toast(msg) { const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 3200); }
  function download(name, data, type) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800); toast("Mengunduh " + name); }
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const csvCell = v => { const s = String(v ?? ""); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const toCSV = (head, rows) => "﻿" + [head.map(csvCell).join(";"), ...rows.map(r => r.map(csvCell).join(";"))].join("\n");

  /* ================= master kanca & area (Lampiran A & B) ================= */
  const AREA_L = { 1: "AREA 1 · Medan", 2: "AREA 2 · Pematang Siantar", 3: "AREA 3 · Lubuk Pakam", 4: "AREA 4 · Padang Sidempuan", 0: "Regional Office" };
  const KC = { 53: ["KC Medan Putri Hijau", 1], 336: ["KC Medan Iskandar Muda", 1], 367: ["KC Medan Sisingamangaraja", 1], 404: ["KC Medan Gatot Subroto", 1], 633: ["KC Medan Thamrin", 1],
    113: ["KC Pematang Siantar", 2], 144: ["KC Kabanjahe", 2], 194: ["KC Sidikalang", 2], 228: ["KC Rantau Prapat", 2], 314: ["KC Balige", 2], 636: ["KC Perdagangan", 2], 2062: ["KC Kota Pinang", 2],
    154: ["KC Tanjung Balai", 3], 238: ["KC Binjai", 3], 266: ["KC Lubuk Pakam", 3], 283: ["KC Tebing Tinggi", 3], 323: ["KC Kisaran", 3], 638: ["KC Stabat", 3],
    85: ["KC Sibolga", 4], 99: ["KC Tarutung", 4], 135: ["KC Padang Sidempuan", 4], 176: ["KC Gunung Sitoli", 4], 637: ["KC Panyabungan", 4], 1097: ["KC Sibuhuan", 4], 201: ["RO Medan", 0] };
  const UD = { 3275: ["Unit Sei Sikambing", 404], 3382: ["Unit Gatot Subroto", 404], 3383: ["Unit Kapten Muslim", 404], 3530: ["Unit Setiabudi", 404], 5325: ["Unit Pasar Glugur", 404], 3342: ["Unit Belawan", 336], 3532: ["Unit Pasar Pringgan", 336], 5328: ["Unit Simpang Pos", 336],
    5329: ["Unit Titi Kuning", 367], 5326: ["Unit Sidorame", 633], 3352: ["Unit Pasar Horas", 113], 5342: ["Unit Parluasan", 113], 3375: ["Unit Jatinegara Binjai", 238], 3376: ["Unit Bangkatan Binjai", 238], 3276: ["Unit Stabat", 638],
    3538: ["Unit Sei Rampah", 283], 3834: ["Unit Ahmad Yani Tebing Tinggi", 283], 3535: ["Unit Sisingamangaraja Sibolga", 85], 3536: ["Unit Sisingamangaraja Sidikalang", 194], 5376: ["Unit Salak", 194], 3832: ["Unit Teluk Dalam", 176],
    5266: ["Unit Diponegoro Gunung Sitoli", 176], 3833: ["Unit Lau Cimba", 144], 5288: ["Unit Ahmad Dahlan Lubuk Pakam", 266], 5338: ["Unit Padang Matinggi", 135], 5339: ["Unit Sisingamangaraja Padang Sidempuan", 135], 5384: ["Unit Teluk Nibung", 154], 5393: ["Unit Silindung Tarutung", 99], 7039: ["Unit Samosir", 314] };
  const kcName = c => (KC[+c] || [c ? "Uker " + c : ""])[0];
  const kcArea = c => KC[+c] ? AREA_L[KC[+c][1]] : "Lainnya";
  const kcByName = n => { const k = Object.keys(KC).find(c => KC[c][0].toLowerCase() === String(n || "").trim().toLowerCase()); return k ? +k : null; };
  const areaOfName = n => { const c = kcByName(n); return c != null ? kcArea(c) : "Lainnya"; };

  /* ================= data ================= */
  const DATA = { meta: null, ker: null, rmk: null, disb: null, lw: null };
  const LOADING = {};
  async function loadPart(part, force) {
    if (DATA[part] && !force) return DATA[part];
    if (LOADING[part] && !force) return LOADING[part];
    LOADING[part] = A.call("data", { part }).then(async j => { const v = await A.Crypt.gunzip(j.gz); DATA[part] = v; prep(part); return v; }).finally(() => { delete LOADING[part]; });
    return LOADING[part];
  }
  function prep(part) { if (part === "ker") prepKer(); if (part === "rmk") prepRM(); if (part === "lw") prepLW(); if (part === "disb") prepDisb(); }

  /* ---------- keragaan ---------- */
  const KM = ["os", "sml", "npl", "deb", "dsml", "dnpl"];
  const PRODS = [["ritel", "Briguna Ritel", "Ritel"], ["karya", "Briguna Karya", "Karya"], ["purna", "Briguna Purna", "Purna"], ["prapurna", "Briguna Pra-Purna", "Pra-Purna"], ["mikro", "Briguna Mikro", "Mikro"], ["mikrod", "Mikro Unit Dedicated", "Mikro D"], ["all", "Briguna Ritel + Mikro", "Briguna"]];
  const addMat = (a, b) => a.map((row, i) => row.map((v, j) => Math.round(((v || 0) + ((b[i] || [])[j] || 0)) * 10) / 10));
  function prepKer() {
    const K = DATA.ker; if (!K || !K.dates || !K.dates.length) { DATA.ker = null; return; }
    K.P.ritel = {}; K.P.all = {};
    KM.forEach(k => { K.P.ritel[k] = addMat(addMat(K.P.karya[k], K.P.purna[k]), K.P.prapurna[k]); K.P.all[k] = addMat(K.P.ritel[k], K.P.mikro[k]); });
    const R = K.rka; if (R) { const pr = R.P.ritel || {}, pm = R.P.mikro || {}, tr = R.T.ritel || {}, tm = R.T.mikro || {}; R.P.all = {}; R.T.all = {};
      ["os", "sml", "npl", "deb"].forEach(k => { if (pr[k] && pm[k]) R.P.all[k] = pr[k].map((row, i) => K.kcU.map((_, j) => row[j] == null && (pm[k][i] || [])[j] == null ? null : (row[j] || 0) + ((pm[k][i] || [])[j] || 0)));
        if (tr[k] && tm[k]) R.T.all[k] = tr[k].map((v, i) => v == null || tm[k][i] == null ? null : v + tm[k][i]); }); }
  }
  function kerView(p) {
    const K = DATA.ker; if (!K) return null; if (!PRODS.some(x => x[0] === p)) p = "ritel";
    const ud = p === "mikrod";
    const units = ud ? K.udU.map(c => { const m = UD[+c]; return { code: +c, nama: m ? m[0] : "Unit " + c, kc: m ? m[1] : null, area: m ? kcArea(m[1]) : "Lainnya" }; })
      : K.kcU.map(c => ({ code: +c, nama: kcName(c), kc: +c, area: kcArea(c) }));
    units.forEach((u, i) => u.i = i);
    const R = K.rka, ra = R && R.P[p] ? R.P[p] : {}, rt = R && R.T[p] ? R.T[p] : {};
    return { p, ud, dates: K.dates, units, m: K.P[p], rka: R ? { months: R.months, P: ra, T: rt } : null };
  }
  function kSnap(V, di, us) { if (di < 0) return null; const o = { os: 0, sml: 0, npl: 0, deb: 0 }; us.forEach(u => { for (const k in o) o[k] += ((V.m[k][di] || [])[u.i]) || 0; }); o.psml = o.os ? o.sml / o.os : 0; o.pnpl = o.os ? o.npl / o.os : 0; return o; }
  function kRka(V, ym, us) {
    const r = V.rka, mi = r ? r.months.indexOf(ym) : -1; if (mi < 0) return null;
    const full = us.length === V.units.length, o = {};
    ["os", "sml", "npl", "deb"].forEach(k => { const t = r.T[k] ? r.T[k][mi] : null; if (full && t != null) { o[k] = t; return; } if (!r.P[k]) { o[k] = null; return; }
      let v = 0, any = false; us.forEach(u => { const x = (r.P[k][mi] || [])[u.i]; if (x != null) { v += x; any = true; } }); o[k] = any ? v : null; });
    if (o.os == null && o.sml == null && o.npl == null) return null;
    o.psml = o.os && o.sml != null ? o.sml / o.os : null; o.pnpl = o.os && o.npl != null ? o.npl / o.os : null; return o;
  }
  const idxBefore = (ds, d) => { let r = -1; for (let i = 0; i < ds.length && ds[i] < d; i++) r = i; return r; };
  const idxOnOrBefore = (ds, d) => { let r = -1; for (let i = 0; i < ds.length && ds[i] <= d; i++) r = i; return r; };
  const capP = (akt, rka, up) => { if (rka == null) return null; const v = up ? (!rka ? 1.2 : akt / rka) : (!akt ? 1.2 : !rka ? 0 : rka / akt); return clamp(v, 0, 1.2); };
  const pencCls = v => v == null ? "neutral" : v >= 1 ? "good" : v >= .95 ? "warn" : "crit";

  /* ---------- produktivitas ---------- */
  let RM = null; // { months: [{ym,seg,kc,rm,jg,pn,t,os,deb,baru,sup,dB,dS}], tx, asof }
  function prepRM() {
    const D = DATA.rmk; if (!D) { RM = null; return; }
    const map = new Map(), key = (ym, seg, rm) => ym + "|" + seg + "|" + nmKey(rm);
    (D.targets || []).forEach(t => { const k = key(t.ym, t.seg, t.rm), o = map.get(k) || { ym: t.ym, seg: t.seg, kc: t.kc, rm: t.rm, jg: t.jg, pn: t.pn, t: 0, os: 0, deb: 0, baru: 0, sup: 0, dB: 0, dS: 0 }; o.t += t.t; map.set(k, o); });
    (D.tx || []).forEach(([d, seg, kc, rm, j, pl, deb]) => { const ym = d.slice(0, 7), k = key(ym, seg, rm); let o = map.get(k);
      if (!o) { o = { ym, seg, kc, rm, jg: "", pn: "", t: 0, os: 0, deb: 0, baru: 0, sup: 0, dB: 0, dS: 0 }; map.set(k, o); }
      o.os += pl; o.deb += deb; if (j) { o.sup += pl; o.dS += deb; } else { o.baru += pl; o.dB += deb; } });
    const months = [...map.values()]; months.forEach(o => { o.area = areaOfName(o.kc); o.pen = o.t ? o.os / o.t : null; });
    RM = { months, tx: D.tx || [], asof: D.asof || {} };
  }

  /* ---------- LW321 & kriteria kredit (ketentuan 02) ---------- */
  const PRN = ["Karya", "Purna", "Pra-Purna", "Mikro", "Lainnya"];
  let LWR = [], LWK = new Map(), LWCIF = new Map(), LWP = new Map();
  const nIso = n => n == null ? null : new Date(n * 864e5).toISOString().slice(0, 10), nS = n => tglS(nIso(n));
  const todayN = () => { const d = new Date(); return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5); };
  function prepLW() {
    LWR = []; LWK = new Map(); LWCIF = new Map(); LWP = new Map();
    const L = DATA.lw; if (!L || !L.n) return;
    const per = L.asof;
    for (let i = 0; i < L.n; i++) {
      const pr = L.pr[i], mik = pr === 3, ku = L.ku[i];
      const r = { rek: L.rek[i], key: pnKey(L.rek[i]), nama: L.nama[i], cif: L.cif[i], kk: L.kk[i], kc: kcName(L.kk[i]), area: kcArea(L.kk[i]), ku, uker: mik ? titleCase((L.uk[ku] || {}).n || "Unit " + ku) : kcName(L.kk[i]),
        pl: L.pl[i], os: L.os[i], rate: L.rate[i], nx: L.nx[i], rl: L.rl[i], jt: L.jt[i], jw: L.jw[i], restr: !!L.rs[i], tp: L.tp[i], tb: L.tb[i], tpn: L.tpn[i], kol: L.kol[i], prod: PRN[pr] || "Lainnya", seg: mik ? "M" : "R", rm: L.rmN[L.rm[i]] || "(Tanpa RM)" };
      r.tgk = r.tp + r.tb + r.tpn; r.umur = r.nx != null && per ? per - r.nx : null; r.umurPinj = r.rl != null && per ? per - r.rl : null;
      r.kq = r.kol === 1 ? "Lancar" : r.kol === 2 ? "SML" : "NPL";
      const aligned = r.umur != null && (r.kol === 2 ? r.umur >= 0 && r.umur <= 89 : r.umur >= 90);
      r.oo = r.kol >= 2 && (r.tgk === 0 || !aligned);
      r.krit = r.kol === 1 ? "Lancar" : r.oo ? (r.kol === 2 ? "One Obligor SML" : "One Obligor NPL") : r.kol === 2 ? (r.umur < 30 ? "SML 1" : r.umur <= 60 ? "SML 2" : "SML 3") : r.umur <= 119 ? "NPL Baru" : (r.umurPinj != null && r.umurPinj < 730 ? "NPL Dibawah 2 Tahun" : "NPL");
      r.npl90 = r.kol === 2 && !r.oo && r.nx != null ? r.nx + 90 : null;
      LWR.push(r); LWK.set(r.key, r); if (!LWCIF.has(r.cif)) LWCIF.set(r.cif, []); LWCIF.get(r.cif).push(r);
    }
    if (L.prev && L.prev.key) L.prev.key.forEach((k, j) => LWP.set(pnKey(k), { kol: L.prev.kol[j], os: L.prev.os[j], cif: L.prev.cif[j] }));
    LWR.forEach(r => { const p = LWP.get(r.key); r.prevKol = p ? p.kol : null; if (!r.oo) return;
      const oth = (LWCIF.get(r.cif) || []).some(x => x !== r && x.kol >= 2 && x.tgk > 0); r.ooCause = oth ? "Pinjaman lain" : "Kartu kredit / lainnya"; });
  }
  const kritCls = k => k === "Lancar" ? "good" : k.startsWith("One") ? "neutral" : k.startsWith("SML") ? "warn" : "crit";
  const kolB = k => `<span class="kol k${k}">${k}</span>`;
  let DISB = [];
  function prepDisb() { const D = DATA.disb; DISB = []; if (!D || !D.rows) return; const c = D.cols; DISB = D.rows.map(r => { const o = {}; c.forEach((k, i) => o[k] = r[i]); return o; }); }

  /* ================= chart helper ================= */
  const charts = {};
  const cssv = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  function mkChart(id, cfg) { const el = document.getElementById(id); if (!el) return; if (charts[id]) charts[id].destroy(); if (typeof Chart === "undefined") { el.parentElement.innerHTML = '<div class="empty">Grafik butuh koneksi internet untuk memuat Chart.js.</div>'; return; } charts[id] = new Chart(el, cfg); }
  function baseOpts(extra = {}) {
    const ink2 = cssv("--ink-2"), muted = cssv("--muted"), line = cssv("--line");
    return Object.assign({ responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
      plugins: { legend: { position: "top", align: "start", labels: { color: ink2, usePointStyle: true, pointStyle: "rectRounded", boxWidth: 10, boxHeight: 10, font: { family: cssv("--f-ui"), size: 12 } } },
        tooltip: { padding: 10, cornerRadius: 8, bodyFont: { family: cssv("--f-num") } } },
      scales: { x: { grid: { display: false }, border: { color: line }, ticks: { color: muted, font: { size: 11 } } }, y: { grid: { color: line }, border: { display: false }, ticks: { color: muted, font: { size: 11, family: cssv("--f-num") } }, beginAtZero: true } } }, extra);
  }
  if (typeof Chart !== "undefined") { Chart.defaults.animation.duration = 350; }
  const destroyCharts = () => Object.keys(charts).forEach(k => { charts[k].destroy(); delete charts[k]; });
  function tile(label, value, sub = "", meter = null, cls = "") {
    return `<div class="tile ${cls}"><span class="lbl">${label}</span><span class="val">${value}</span>${sub ? `<span class="sub">${sub}</span>` : ""}${meter != null ? `<div class="meter"><i style="width:${clamp(meter, 0, 1) * 100}%;background:var(--${capaiCls(meter)})"></i></div>` : ""}</div>`;
  }
  function simpleTable(head, rows, foot) {
    return `<div class="tbl-wrap"><table class="tbl"><thead><tr>${head.map(h => `<th class="${h.r ? "r" : ""}">${h.l}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map(r => `<tr>${r.map((c, i) => `<td class="${head[i].r ? "r" : ""}">${c}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${head.length}" class="empty">Tidak ada data.</td></tr>`}</tbody>${foot ? `<tfoot><tr>${foot.map((c, i) => `<td class="${head[i].r ? "r" : ""}">${c}</td>`).join("")}</tr></tfoot>` : ""}</table></div>`;
  }

  /* ================= router ================= */
  const VIEWS = { dashboard: ["Dashboard", "Kinerja & Produktivitas", viewDashboard], debitur: ["Detail Debitur", "LW321 & disburse", viewDebitur], tools: ["Tools RM", "Simulasi kredit", el => window.Tools.render(el)], admin: ["Admin", "Data, user & log", viewAdmin] };
  const curView = () => { const h = location.hash.slice(1); return VIEWS[h] ? h : "dashboard"; };
  function render() {
    if (!A.session) return;
    const k = curView(), [title, eb, fn] = VIEWS[k], v = $("#view");
    $("#pageTitle").textContent = title; $("#eyebrow").textContent = eb;
    $$(".nav a").forEach(a => a.dataset.v === k ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"));
    destroyCharts();
    if (!A.can(k)) { v.innerHTML = `<section class="card lock"><svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg><b>Menu ini tidak tersedia untuk peran ${esc(A.ROLE_LABEL[A.user.role])}.</b><span>Hubungi admin bila Anda memerlukan akses.</span></section>`; return; }
    Promise.resolve(fn(v)).catch(e => { v.innerHTML = `<section class="card"><div class="empty"><b>Data gagal dimuat.</b><br>${esc(e.message || e)}</div><div class="flex justify-center"><button class="btn primary" type="button" id="retry">Coba lagi</button></div></section>`; const b = $("#retry"); if (b) b.onclick = render; });
  }
  window.addEventListener("hashchange", () => { render(); window.scrollTo(0, 0); });

  /* ================= DASHBOARD ================= */
  const DS = Object.assign({ yr: null, seg: "ALL", kc: "ALL", rm: "ALL", ym: null, prod: "ritel", kd: null }, lsGet("brg.ds", {}));
  const saveDS = () => lsSet("brg.ds", DS);
  async function viewDashboard(v) {
    v.innerHTML = `<section class="card"><div class="empty">Memuat data kinerja…</div></section>`;
    await Promise.all([loadPart("meta"), loadPart("ker").catch(() => null), loadPart("rmk").catch(() => null), A.can("debitur") ? loadPart("lw").catch(() => null) : null]);
    if (curView() !== "dashboard") return;
    const role = A.user.role, me = role === "rm" ? myRM() : null;
    const months = RM ? RM.months : [];
    const yrs = uniq(months.map(x => x.ym.slice(0, 4))).sort(); if (!yrs.includes(DS.yr)) DS.yr = yrs[yrs.length - 1] || String(new Date().getFullYear());
    const segOk = x => DS.seg === "ALL" || x.seg === DS.seg;
    const kcs = uniq(months.filter(segOk).map(x => x.kc)).filter(Boolean).sort(); if (DS.kc !== "ALL" && !kcs.includes(DS.kc)) DS.kc = "ALL";
    const rms = uniq(months.filter(x => segOk(x) && (DS.kc === "ALL" || x.kc === DS.kc) && x.ym.startsWith(DS.yr)).map(x => x.rm)).sort((a, b) => a.localeCompare(b)); if (DS.rm !== "ALL" && !rms.includes(DS.rm)) DS.rm = "ALL";
    const scope = x => segOk(x) && (DS.kc === "ALL" || x.kc === DS.kc) && (DS.rm === "ALL" || x.rm === DS.rm);
    const scopeNoSeg = x => (DS.kc === "ALL" || x.kc === DS.kc) && (DS.rm === "ALL" || x.rm === DS.rm);
    const M = DATA.meta || {};
    v.innerHTML = `
      ${role === "guest" ? `<div class="banner info"><span>Anda masuk sebagai <b>Guest</b>: hanya angka agregat yang ditampilkan, tanpa detail debitur.</span></div>` : ""}
      <section class="card"><div class="filters">
        <label class="fld"><span>Tahun</span><select class="inp" id="fYr">${[...yrs].reverse().map(y => `<option ${y === DS.yr ? "selected" : ""}>${y}</option>`).join("")}</select></label>
        <label class="fld"><span>Jenis kredit</span><select class="inp" id="fSeg">${[["ALL", "Ritel + Mikro"], ["R", "Ritel"], ["M", "Mikro"]].map(([k, l]) => `<option value="${k}" ${DS.seg === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <label class="fld"><span>Cabang</span><select class="inp" id="fKc"><option value="ALL">Semua cabang</option>${kcs.map(k => `<option ${k === DS.kc ? "selected" : ""}>${esc(k)}</option>`).join("")}</select></label>
        <label class="fld"><span>RM / Mantri</span><select class="inp" id="fRm"><option value="ALL">Semua (${rms.length})</option>${rms.map(k => `<option ${k === DS.rm ? "selected" : ""}>${esc(k)}</option>`).join("")}</select></label>
      </div><p class="muted" style="margin:0;font-size:12px">Disburse = net disburse (Delta Suplesi), Rp juta · data s.d. Ritel ${tglS(RM && RM.asof.R)} · Mikro ${tglS(RM && RM.asof.M)} · keragaan ${tglS(M.ker)}${M.lw ? " · LW321 " + nS(M.lw) : ""}</p></section>
      ${me ? `<section id="meBox"></section>` : ""}
      <div class="tiles" id="dTiles"></div>
      <div class="grid2"><section class="card"><div class="card-h"><h2>Tren pencairan bulanan ${DS.yr}</h2><span class="sub">net disburse vs target</span></div><div class="chart"><canvas id="cTrend"></canvas></div></section>
        <section class="card"><div class="card-h"><h2>Pencapaian target per cabang</h2><span class="sub">YtD ${DS.yr} · RM/mantri bertarget</span></div><div class="chart"><canvas id="cKc"></canvas></div></section></div>
      <section class="card" id="rankSec"></section>
      <section class="card" id="kerSec"></section>
      ${M.lwAgg ? `<section class="card" id="lwAggSec"></section>` : ""}`;
    $("#fYr").onchange = e => { DS.yr = e.target.value; saveDS(); render(); };
    $("#fSeg").onchange = e => { DS.seg = e.target.value; saveDS(); render(); };
    $("#fKc").onchange = e => { DS.kc = e.target.value; DS.rm = "ALL"; saveDS(); render(); };
    $("#fRm").onchange = e => { DS.rm = e.target.value; saveDS(); render(); };
    if (!RM) { $("#dTiles").innerHTML = `<div class="card"><div class="empty">Data disburse belum tersedia.</div></div>`; }
    else {
      // ---- kartu ringkasan
      const yrSum = (y, seg) => sum(months.filter(x => x.ym.startsWith(y) && x.seg === seg && scopeNoSeg(x)), "os");
      const curYm = uniq(months.filter(x => x.ym.startsWith(DS.yr) && x.os).map(x => x.ym)).sort().pop() || DS.yr + "-01";
      const inYr = months.filter(x => x.ym.startsWith(DS.yr) && x.ym <= curYm && scope(x)), tg = inYr.filter(x => x.t > 0), tY = sum(tg, "t"), oY = sum(tg, "os");
      const thisM = months.filter(x => x.ym === curYm && scope(x) && x.t > 0), cap = thisM.filter(x => x.os >= x.t).length;
      const k4 = [1, 2, 3, 4].map(q => thisM.filter(x => kuadOf(x.pen) === q).length);
      const y0 = String(+DS.yr - 1);
      $("#dTiles").innerHTML = [
        tile(`Disburse Ritel ${y0}`, rpJ(yrSum(y0, "R")), `setahun penuh${DS.kc !== "ALL" || DS.rm !== "ALL" ? " · sesuai filter" : ""}`),
        tile(`Disburse Ritel ${DS.yr}`, rpJ(yrSum(DS.yr, "R")), `s.d. ${tglS(RM.asof.R)} · ${yrSum(y0, "R") ? pct(yrSum(DS.yr, "R") / yrSum(y0, "R"), 0) + " dari " + y0 : ""}`),
        tile(`Disburse Mikro ${DS.yr}`, rpJ(yrSum(DS.yr, "M")), `s.d. ${tglS(RM.asof.M)}`),
        tile("Pencapaian target YtD", tY ? pct(oY / tY, 1) : "–", tY ? `${rpJ(oY)} dari target ${rpJ(tY)} · RM/mantri bertarget` : "target belum diisi di sheet list RM / mantri", tY ? oY / tY : null, "hl"),
        tile(`RM capai target ${ymS(curYm)}`, `${cap} <small style="font-size:14px;opacity:.6">/ ${thisM.length}</small>`, [1, 2, 3, 4].map(q => `${kq(q)} ${k4[q - 1]}`).join(" &nbsp;")),
        kerTile()].join("");
      // ---- tren bulanan
      const ms = Array.from({ length: 12 }, (_, i) => DS.yr + "-" + String(i + 1).padStart(2, "0"));
      const agg = (m, f) => sum(months.filter(x => x.ym === m && f(x)), "os");
      const s1 = cssv("--s1"), s2 = cssv("--s2"), s3 = cssv("--s3"), ink2 = cssv("--ink-2");
      const dsets = DS.seg === "ALL" ? [["Ritel", x => x.seg === "R" && scopeNoSeg(x), s1], ["Mikro", x => x.seg === "M" && scopeNoSeg(x), s3]] : [["Baru", null, s1], ["Suplesi", null, s2]];
      const data = dsets.map(([l, f, c]) => ({ type: "bar", label: l, data: ms.map(m => f ? agg(m, f) || null : sum(months.filter(x => x.ym === m && scope(x)), l === "Baru" ? "baru" : "sup") || null), backgroundColor: c, stack: "a", borderRadius: 3, maxBarThickness: 26, order: 2 }));
      data.push({ type: "line", label: "Target", data: ms.map(m => sum(months.filter(x => x.ym === m && scope(x) && x.t > 0), "t") || null), borderColor: ink2, borderDash: [5, 4], borderWidth: 2, pointRadius: 0, order: 1 });
      const prevY = ms.map(m => sum(months.filter(x => x.ym === y0 + m.slice(4) && scope(x)), "os") || null);
      if (prevY.some(Boolean)) data.push({ type: "line", label: "Tahun " + y0, data: prevY, borderColor: s2, borderWidth: 1.5, pointRadius: 2, order: 1, tension: .2 });
      mkChart("cTrend", { type: "bar", data: { labels: ms.map(ymS), datasets: data }, options: baseOpts({ plugins: { ...baseOpts().plugins, tooltip: { ...baseOpts().plugins.tooltip, callbacks: { label: c => c.parsed.y == null ? "" : ` ${c.dataset.label}: ${rpJ(c.parsed.y)}` } } },
        scales: { x: { ...baseOpts().scales.x, stacked: true }, y: { ...baseOpts().scales.y, stacked: true, ticks: { ...baseOpts().scales.y.ticks, callback: x => nf0.format(x / 1000) + " M" } } } }) });
      // ---- per cabang
      const kr = uniq(tg.map(x => x.kc)).filter(Boolean).map(kc => { const a = tg.filter(x => x.kc === kc), t = sum(a, "t"), o = sum(a, "os"); return { kc, t, o, p: t ? o / t : null }; }).sort((a, b) => (b.p ?? -1) - (a.p ?? -1));
      mkChart("cKc", { type: "bar", data: { labels: kr.map(x => x.kc.replace(/^KC /, "")), datasets: [{ label: "Realisasi", data: kr.map(x => x.o), backgroundColor: kr.map(x => cssv(x.p == null ? "--muted" : "--" + capaiCls(x.p))), borderRadius: 3, maxBarThickness: 18 }, { label: "Target", data: kr.map(x => x.t), backgroundColor: cssv("--line"), borderRadius: 3, maxBarThickness: 18 }] },
        options: baseOpts({ indexAxis: "y", plugins: { ...baseOpts().plugins, tooltip: { ...baseOpts().plugins.tooltip, callbacks: { label: c => ` ${c.dataset.label}: ${rpJ(c.parsed.x)}` + (c.datasetIndex === 0 && kr[c.dataIndex].p != null ? ` · ${pct(kr[c.dataIndex].p, 0)}` : "") } } },
          scales: { x: { ...baseOpts().scales.y, ticks: { ...baseOpts().scales.y.ticks, callback: x => nf0.format(x / 1000) + " M" } }, y: { ...baseOpts().scales.x, ticks: { ...baseOpts().scales.x.ticks, autoSkip: false, font: { size: 10.5 } } } } }) });
      $("#cKc").parentElement.style.height = Math.max(260, kr.length * 26 + 60) + "px";
      renderRank(scope, curYm);
      if (me) renderMe(me);
    }
    renderKer();
    if (M.lwAgg) renderLwAgg(M.lwAgg);
  }
  function kerTile() {
    const V = kerView(DS.seg === "M" ? "mikro" : DS.seg === "R" ? "ritel" : "all"); if (!V) return tile("OS Briguna", "–", "keragaan belum tersedia");
    const di = V.dates.length - 1, d = V.dates[di], us = V.units.filter(u => DS.kc === "ALL" || u.kc === kcByName(DS.kc)), c = kSnap(V, di, us), r = kRka(V, d.slice(0, 7), us);
    return tile(`OS ${PRODS.find(p => p[0] === V.p)[2]}`, rpJ(c.os), `${r && r.os ? pct(c.os / r.os, 1) + " RKA · " : ""}NPL ${pct(c.pnpl, 2)} · ${tglS(d)}`, r && r.os ? c.os / r.os : null);
  }
  function myRM() {
    const u = A.user, k = nmKey(u.rm_name), pn = pnKey(u.pn);
    const mine = (RM ? RM.months : []).filter(x => (k && nmKey(x.rm) === k) || (pn && pnKey(x.pn) === pn));
    return { name: u.rm_name || u.nama, rows: mine };
  }
  function renderMe(me) {
    const el = $("#meBox"); if (!el) return;
    const rows = me.rows, ym = uniq(rows.filter(x => x.os || x.t).map(x => x.ym)).sort().pop();
    if (!ym) { el.innerHTML = `<div class="banner"><span>Nama RM <b>${esc(me.name || "-")}</b> belum ditemukan di data disburse/target. Minta admin mencocokkan nama atau PN di menu Admin → User.</span></div>`; return; }
    const cur = rows.filter(x => x.ym === ym), t = sum(cur, "t"), o = sum(cur, "os"), yr = ym.slice(0, 4), ytd = rows.filter(x => x.ym.startsWith(yr) && x.ym <= ym), tY = sum(ytd, "t"), oY = sum(ytd, "os");
    const seg = cur[0] ? cur[0].seg : "R", peers = RM.months.filter(x => x.ym === ym && x.seg === seg && x.t > 0).sort((a, b) => b.pen - a.pen), rank = peers.findIndex(x => nmKey(x.rm) === nmKey(cur[0] && cur[0].rm)) + 1;
    const lw = LWR.length ? { os: sum(LWR, "os"), sml: sum(LWR.filter(r => r.kol === 2), "os"), npl: sum(LWR.filter(r => r.kol >= 3), "os"), akan: LWR.filter(r => r.npl90 != null && r.npl90 <= todayN() + 30).length } : null;
    el.innerHTML = `<div class="me-card"><div><small>Kinerja saya · ${ymS(ym)}</small><h3>${esc(cur[0] ? cur[0].rm : me.name)}</h3><small>${esc(cur[0] ? cur[0].kc : "")}${cur[0] && cur[0].jg ? " · JG " + esc(cur[0].jg) : ""}${rank ? ` · peringkat #${rank} dari ${peers.length}` : ""}</small>
      <div style="margin-top:10px">${kq(kuadOf(t ? o / t : null))} <small>kuadran bulan ini</small> &nbsp; ${kq(kuadOf(tY ? oY / tY : null))} <small>carry over ${yr}</small></div></div>
      <div class="me-stats"><div><span>Realisasi ${ymS(ym)}</span><b>${rpJ(o)}</b></div><div><span>Target</span><b>${t ? rpJ(t) : "–"}</b></div><div><span>Pencapaian</span><b>${t ? pct(o / t, 0) : "–"}</b></div>
        <div><span>Carry over ${yr}</span><b>${tY ? pct(oY / tY, 0) : "–"}</b></div>${lw ? `<div><span>OS kelolaan</span><b>${rpR(lw.os)}</b></div><div><span>SML / NPL</span><b>${pct(lw.os ? lw.sml / lw.os : 0, 2)} / ${pct(lw.os ? lw.npl / lw.os : 0, 2)}</b></div><div><span>Akan NPL ≤30 hr</span><b>${lw.akan} rek</b></div>` : ""}</div></div>`;
  }
  function renderRank(scope, curYm) {
    const el = $("#rankSec"), months = RM.months, yms = uniq(months.filter(x => x.ym.startsWith(DS.yr) && (x.os || x.t)).map(x => x.ym)).sort();
    if (!yms.includes(DS.ym)) DS.ym = curYm;
    const ym = DS.ym, rows = months.filter(x => x.ym === ym && scope(x) && (x.t > 0 || x.os > 0)).sort((a, b) => (b.pen ?? -1) - (a.pen ?? -1) || b.os - a.os);
    const last6 = Array.from({ length: 6 }, (_, i) => { const d = new Date(+ym.slice(0, 4), +ym.slice(5, 7) - 6 + i, 1); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); });
    const kOf = (rm, seg, m) => { const r = months.find(x => x.ym === m && x.seg === seg && nmKey(x.rm) === nmKey(rm)); return r && r.t ? kuadOf(r.os / r.t) : null; };
    const showAll = el.dataset.all === "1", list = showAll ? rows : rows.slice(0, 15);
    el.innerHTML = `<div class="card-h"><h2>Peringkat produktivitas RM</h2><div class="flex gap-2 items-center flex-wrap"><select class="inp" id="fYm" style="width:auto">${[...yms].reverse().map(m => `<option value="${m}" ${m === ym ? "selected" : ""}>${ymS(m)}</option>`).join("")}</select><button class="btn" type="button" id="rkCsv">Unduh CSV</button></div></div>
      <div class="lb">${list.length ? list.map((x, i) => `<div class="lb-row"><span class="lb-rank">${i + 1}</span><div class="lb-name"><b>${esc(x.rm)}</b><small>${esc(x.kc)} · ${x.seg === "M" ? "Mikro" : "Ritel"}${x.jg ? " · JG " + esc(x.jg) : ""}</small></div>
        <div class="lb-mid"><div class="lb-bar"><i style="width:${clamp((x.pen || 0) / 1.5, 0, 1) * 100}%;background:var(--${x.pen == null ? "muted" : capaiCls(x.pen)})"></i><span class="tick"></span></div><small class="muted num">${rpJ(x.os)} / ${x.t ? rpJ(x.t) : "tanpa target"} · ${x.deb} deb · ${last6.map(m => kq(kOf(x.rm, x.seg, m))).join("")}</small></div>
        <span class="flex gap-1 items-center">${x.pen != null ? chip(pct(x.pen, 0), capaiCls(x.pen)) : ""}${kq(kuadOf(x.pen))}</span></div>`).join("") : `<div class="empty">Belum ada data RM pada filter ini.</div>`}</div>
      ${rows.length > 15 ? `<div class="flex justify-center"><button class="btn" type="button" id="rkAll">${showAll ? "Tampilkan 15 teratas" : "Tampilkan semua (" + rows.length + ")"}</button></div>` : ""}
      <p class="muted" style="margin:0;font-size:12px">Garis tegak = 100% target · ikon kecil = kuadran 6 bulan terakhir · K1 ≥105%, K2 100–105%, K3 50–100%, K4 &lt;50%.</p>`;
    $("#fYm").onchange = e => { DS.ym = e.target.value; saveDS(); renderRank(scope, curYm); };
    const b = $("#rkAll"); if (b) b.onclick = () => { el.dataset.all = showAll ? "0" : "1"; renderRank(scope, curYm); };
    $("#rkCsv").onclick = () => download(`peringkat-rm-${ym}.csv`, toCSV(["Peringkat", "RM", "Kanca", "Segmen", "JG", "Target (juta)", "Realisasi (juta)", "Pencapaian", "Kuadran", "Debitur", "Baru (juta)", "Suplesi (juta)"],
      rows.map((x, i) => [i + 1, x.rm, x.kc, x.seg === "M" ? "Mikro" : "Ritel", x.jg, x.t, Math.round(x.os * 10) / 10, x.pen == null ? "" : Math.round(x.pen * 1000) / 10 + "%", x.pen == null ? "" : "K" + kuadOf(x.pen), x.deb, Math.round(x.baru * 10) / 10, Math.round(x.sup * 10) / 10])), "text/csv");
  }
  function renderKer() {
    const el = $("#kerSec"); if (!el) return;
    if (!DATA.ker) { el.innerHTML = `<div class="empty">Data keragaan belum tersedia.</div>`; return; }
    const V = kerView(DS.prod), ds = V.dates; if (!ds.includes(DS.kd)) DS.kd = ds[ds.length - 1];
    const d = DS.kd, di = ds.indexOf(d), ym = d.slice(0, 7), yr = d.slice(0, 4), mtd = idxBefore(ds, ym + "-01"), ytd = idxBefore(ds, yr + "-01-01");
    const kcFilt = DS.kc === "ALL" ? null : kcByName(DS.kc), us = V.units.filter(u => kcFilt == null || u.kc === kcFilt);
    const cur = kSnap(V, di, us), pm = kSnap(V, mtd, us), py = kSnap(V, ytd, us), rk = kRka(V, ym, us), PS = PRODS.find(p => p[0] === V.p)[2];
    const mid = +d.slice(8) < new Date(+yr, +d.slice(5, 7), 0).getDate();
    el.innerHTML = `<div class="card-h"><h2>Keragaan & pencapaian RKA</h2><div class="flex gap-2 flex-wrap"><select class="inp" id="kPr" style="width:auto">${PRODS.map(([k, l]) => `<option value="${k}" ${k === V.p ? "selected" : ""}>${l}</option>`).join("")}</select>
      <select class="inp" id="kD" style="width:auto">${[...ds].reverse().slice(0, 400).map(x => `<option value="${x}" ${x === d ? "selected" : ""}>${tglS(x)}</option>`).join("")}</select></div></div>
      ${mid ? `<p class="muted" style="margin:0;font-size:12px"><b>Posisi bulan berjalan:</b> SML berjalan mengikuti tanggal gajian debitur; bandingkan dengan tanggal yang sama bulan lalu, bukan akhir bulan.</p>` : ""}
      <div class="tiles">
        ${tile("OS " + PS, rpJ(cur.os), rk && rk.os ? `${pct(cur.os / rk.os, 2)} dari RKA ${ymS(ym)}` : "RKA belum ada", rk && rk.os ? cur.os / rk.os : null)}
        ${tile("Growth MtD", `<span class="delta ${dCls(pm ? cur.os - pm.os : 0)}" style="font-size:inherit">${pm ? (cur.os - pm.os >= 0 ? "+" : "−") + nf2.format(Math.abs(cur.os - pm.os) / 1000) + " M" : "–"}</span>`, `YtD ${py ? (cur.os - py.os >= 0 ? "+" : "−") + nf2.format(Math.abs(cur.os - py.os) / 1000) + " M" : "–"}`)}
        ${tile("SML " + PS, pct(cur.psml, 2), `${rpJ(cur.sml)}${rk && rk.sml != null ? " · RKA " + pct(rk.psml, 2) + " · Penc " + pct(capP(cur.sml, rk.sml, false), 0) : ""}`)}
        ${tile("NPL " + PS, pct(cur.pnpl, 2), `${rpJ(cur.npl)}${rk && rk.npl != null ? " · RKA " + pct(rk.pnpl, 2) + " · Penc " + pct(capP(cur.npl, rk.npl, false), 0) : ""}`)}
        ${tile("Debitur " + PS, nf0.format(cur.deb), `MtD ${pm ? (cur.deb - pm.deb >= 0 ? "+" : "−") + nf0.format(Math.abs(cur.deb - pm.deb)) : "–"}${rk && rk.deb ? " · " + pct(cur.deb / rk.deb, 1) + " RKA" : ""}`)}
      </div>
      <div class="grid2"><div><h3 style="font-size:13px;margin-bottom:6px">OS vs RKA ${yr}</h3><div class="chart"><canvas id="cKerOs"></canvas></div></div><div><h3 style="font-size:13px;margin-bottom:6px">% SML & % NPL · 90 hari</h3><div class="chart"><canvas id="cKerQ"></canvas></div></div></div>
      <div id="kerTbl"></div>
      <p class="muted" style="margin:0;font-size:12px">Rp juta · %Penc OS = realisasi ÷ RKA; %Penc SML/NPL = RKA ÷ realisasi (maks. 120%) · hijau ≥100%, kuning 95–100%, merah &lt;95%.</p>`;
    $("#kPr").onchange = e => { DS.prod = e.target.value; saveDS(); renderKer(); };
    $("#kD").onchange = e => { DS.kd = e.target.value; saveDS(); renderKer(); };
    const rows = us.map(u => { const c = kSnap(V, di, [u]), m = kSnap(V, mtd, [u]), y = kSnap(V, ytd, [u]), r = kRka(V, ym, [u]); return { u, c, m, y, r, po: r && r.os ? c.os / r.os : null, ps: r ? capP(c.sml, r.sml, false) : null, pn: r ? capP(c.npl, r.npl, false) : null }; })
      .filter(x => x.c.os > 0).sort((a, b) => (b.po ?? -1) - (a.po ?? -1) || b.c.os - a.c.os);
    const pcell = v => v == null ? "–" : `<span class="pc ${pencCls(v)}">${pct(v, 1)}</span>`, dlt = (a, b) => b ? dJ(a - b) : "–";
    $("#kerTbl").innerHTML = simpleTable([{ l: V.ud ? "Unit" : "Kantor cabang" }, { l: "Area" }, { l: "OS", r: 1 }, { l: "%Penc OS", r: 1 }, { l: "MtD", r: 1 }, { l: "YtD", r: 1 }, { l: "SML", r: 1 }, { l: "% SML", r: 1 }, { l: "%Penc SML", r: 1 }, { l: "NPL", r: 1 }, { l: "% NPL", r: 1 }, { l: "%Penc NPL", r: 1 }, { l: "Debitur", r: 1 }],
      rows.map(x => [esc(x.u.nama), esc(x.u.area.replace(/ · .*/, "")), nf0.format(x.c.os), pcell(x.po), dlt(x.c.os, x.m && x.m.os), dlt(x.c.os, x.y && x.y.os), nf0.format(x.c.sml), pct(x.c.psml, 2), pcell(x.ps), nf0.format(x.c.npl), pct(x.c.pnpl, 2), pcell(x.pn), nf0.format(x.c.deb)]),
      ["<b>Total</b>", "", nf0.format(cur.os), pcell(rk && rk.os ? cur.os / rk.os : null), dlt(cur.os, pm && pm.os), dlt(cur.os, py && py.os), nf0.format(cur.sml), pct(cur.psml, 2), pcell(rk ? capP(cur.sml, rk.sml, false) : null), nf0.format(cur.npl), pct(cur.pnpl, 2), pcell(rk ? capP(cur.npl, rk.npl, false) : null), nf0.format(cur.deb)]);
    const ms = Array.from({ length: 12 }, (_, i) => yr + "-" + String(i + 1).padStart(2, "0"));
    const me = ms.map(m => { if (m > ym) return null; const i = m === ym ? di : idxBefore(ds, m.slice(0, 4) + "-" + String(+m.slice(5) + 1).padStart(2, "0") + "-01"); return i >= 0 && ds[i].startsWith(m) ? kSnap(V, i, us) : null; });
    const s1 = cssv("--s1"), s2 = cssv("--s2"), ink2 = cssv("--ink-2");
    mkChart("cKerOs", { type: "line", data: { labels: ms.map(ymS), datasets: [{ label: "Aktual", data: me.map(s => s ? s.os : null), borderColor: s1, backgroundColor: s1, borderWidth: 2, pointRadius: 3, tension: .2 },
      { label: "RKA", data: ms.map(m => { const r = kRka(V, m, us); return r ? r.os : null; }), borderColor: ink2, borderDash: [5, 4], borderWidth: 2, pointRadius: 0, spanGaps: true }] },
      options: baseOpts({ plugins: { ...baseOpts().plugins, tooltip: { ...baseOpts().plugins.tooltip, callbacks: { label: c => c.parsed.y == null ? "" : ` ${c.dataset.label}: ${rpJ(c.parsed.y)}` } } }, scales: { ...baseOpts().scales, y: { ...baseOpts().scales.y, beginAtZero: false, ticks: { ...baseOpts().scales.y.ticks, callback: x => nf0.format(x / 1000) + " M" } } } }) });
    const idx = []; for (let i = Math.max(0, di - 89); i <= di; i++) idx.push(i);
    const sn = idx.map(i => kSnap(V, i, us));
    mkChart("cKerQ", { type: "line", data: { labels: idx.map(i => tglS(ds[i]).replace(/ \d{4}$/, "")), datasets: [{ label: "% SML", data: sn.map(s => s.psml), borderColor: s2, borderWidth: 2, pointRadius: 0, tension: .2 }, { label: "% NPL", data: sn.map(s => s.pnpl), borderColor: s1, borderWidth: 2, pointRadius: 0, tension: .2 }] },
      options: baseOpts({ plugins: { ...baseOpts().plugins, tooltip: { ...baseOpts().plugins.tooltip, callbacks: { label: c => ` ${c.dataset.label}: ${pct(c.parsed.y, 2)}` } } }, scales: { x: { ...baseOpts().scales.x, ticks: { ...baseOpts().scales.x.ticks, maxTicksLimit: 8, maxRotation: 0 } }, y: { ...baseOpts().scales.y, ticks: { ...baseOpts().scales.y.ticks, callback: x => nf1.format(x * 100) + "%" } } } }) });
  }
  function renderLwAgg(agg) {
    const el = $("#lwAggSec"), segF = x => DS.seg === "ALL" || x.seg === DS.seg, a = agg.filter(segF), g = {};
    a.forEach(x => { const o = g[x.kc] || (g[x.kc] = { kc: x.kc, n: 0, os: 0, sml: 0, npl: 0 }); o.n += x.n; o.os += x.os; o.sml += x.sml; o.npl += x.npl; });
    const rows = Object.values(g).sort((p, q) => q.os - p.os), T = { n: sum(rows, "n"), os: sum(rows, "os"), sml: sum(rows, "sml"), npl: sum(rows, "npl") };
    const pc = (v, lim) => `<span class="pc ${v <= lim[0] ? "good" : v <= lim[1] ? "warn" : "crit"}">${pct(v, 2)}</span>`;
    el.innerHTML = `<div class="card-h"><h2>Kualitas portofolio per cabang</h2><span class="sub">LW321 posisi ${nS(DATA.meta.lw)} · agregat</span></div>` +
      simpleTable([{ l: "Kantor cabang" }, { l: "Rekening", r: 1 }, { l: "OS (Jt)", r: 1 }, { l: "SML (Jt)", r: 1 }, { l: "% SML", r: 1 }, { l: "NPL (Jt)", r: 1 }, { l: "% NPL", r: 1 }],
        rows.map(x => [esc(x.kc), nf0.format(x.n), nf1.format(x.os / 1e6), nf1.format(x.sml / 1e6), pc(x.os ? x.sml / x.os : 0, [.015, .03]), nf1.format(x.npl / 1e6), pc(x.os ? x.npl / x.os : 0, [.02, .03])]),
        ["<b>Total</b>", nf0.format(T.n), nf1.format(T.os / 1e6), nf1.format(T.sml / 1e6), pct(T.os ? T.sml / T.os : 0, 2), nf1.format(T.npl / 1e6), pct(T.os ? T.npl / T.os : 0, 2)]);
  }

  /* ================= DETAIL DEBITUR (admin & RM) ================= */
  const PD = Object.assign({ tab: "lw", seg: "ALL", kc: "ALL", rm: "ALL", cat: "all", dseg: "ALL", dyr: "ALL", dm: "ALL" }, lsGet("brg.pd", {}));
  const savePD = () => lsSet("brg.pd", PD);
  let DT = null;
  const killDT = () => { if (DT) { try { DT.destroy(); } catch {} DT = null; } };
  async function viewDebitur(v) {
    killDT();
    v.innerHTML = `<section class="card"><div class="empty">Memuat data debitur…</div></section>`;
    await Promise.all([loadPart("lw").catch(() => null), loadPart("disb").catch(() => null)]);
    if (curView() !== "debitur") return;
    const scoped = A.user.role === "rm";
    v.innerHTML = `${scoped ? `<div class="banner info"><span>Menampilkan debitur kelolaan <b>${esc(A.user.rm_name || A.user.nama)}</b> saja.</span></div>` : ""}
      <nav class="tabs" role="tablist"><button type="button" role="tab" data-t="lw" aria-selected="${PD.tab === "lw"}">Portofolio LW321 ${LWR.length ? `<span class="chip neutral">${nf0.format(LWR.length)}</span>` : ""}</button><button type="button" role="tab" data-t="disb" aria-selected="${PD.tab === "disb"}">Disburse ${DISB.length ? `<span class="chip neutral">${nf0.format(DISB.length)}</span>` : ""}</button></nav>
      <div id="pdBody" class="grid gap-4"></div>`;
    $$(".tabs [data-t]", v).forEach(b => b.onclick = () => { PD.tab = b.dataset.t; savePD(); render(); });
    PD.tab === "disb" ? renderDisb() : renderLW();
  }
  const CATS = [["all", "Semua"], ["sml", "SML"], ["npl", "NPL"], ["akan", "Akan NPL ≤30 hari"], ["sml1", "SML 1"], ["nplbaru", "NPL Baru"], ["oo", "One obligor"], ["dg", "Turun kolek"], ["sup", "Kandidat suplesi"]];
  function catFilter(c) { const T = todayN(), per = DATA.lw ? DATA.lw.asof : 0; return {
    all: () => true, sml: r => r.kol === 2, npl: r => r.kol >= 3, akan: r => r.npl90 != null && r.npl90 <= T + 30, sml1: r => r.krit === "SML 1", nplbaru: r => r.krit === "NPL Baru", oo: r => r.oo, dg: r => r.prevKol != null && r.kol > r.prevKol,
    sup: r => r.kol === 1 && r.tgk === 0 && r.pl > 0 && r.umurPinj >= 365 && r.os / r.pl <= .7 && r.jt != null && r.jt - per >= 365 && !(LWCIF.get(r.cif) || []).some(x => x.kol >= 2) }[c] || (() => true); }
  function renderLW() {
    const el = $("#pdBody");
    if (!LWR.length) { el.innerHTML = `<section class="card"><div class="empty">${A.user.role === "admin" ? "LW321 belum diupload. Upload lewat menu Admin → Upload LW321." : "Belum ada debitur LW321 atas nama Anda. Bila seharusnya ada, minta admin mencocokkan nama RM / PN Anda."}</div></section>`; return; }
    const base0 = LWR.filter(r => PD.seg === "ALL" || r.seg === PD.seg);
    const kcs = uniq(base0.map(r => r.kc)).sort(); if (PD.kc !== "ALL" && !kcs.includes(PD.kc)) PD.kc = "ALL";
    const base1 = base0.filter(r => PD.kc === "ALL" || r.kc === PD.kc), rms = uniq(base1.map(r => r.rm)).sort((a, b) => a.localeCompare(b)); if (PD.rm !== "ALL" && !rms.includes(PD.rm)) PD.rm = "ALL";
    const S = base1.filter(r => PD.rm === "ALL" || r.rm === PD.rm), T = todayN();
    const os = sum(S, "os"), sml = S.filter(r => r.kol === 2), npl = S.filter(r => r.kol >= 3), akan = S.filter(r => r.npl90 != null && r.npl90 <= T + 30);
    const L = S.filter(catFilter(PD.cat)), hasPrev = !!(DATA.lw.prev);
    el.innerHTML = `<section class="card"><div class="filters">
        <label class="fld"><span>Segmen</span><select class="inp" id="pSeg">${[["ALL", "Ritel + Mikro"], ["R", "Ritel"], ["M", "Mikro"]].map(([k, l]) => `<option value="${k}" ${PD.seg === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <label class="fld"><span>Cabang</span><select class="inp" id="pKc"><option value="ALL">Semua cabang</option>${kcs.map(k => `<option ${k === PD.kc ? "selected" : ""}>${esc(k)}</option>`).join("")}</select></label>
        ${A.user.role === "admin" ? `<label class="fld"><span>RM / Mantri</span><select class="inp" id="pRm"><option value="ALL">Semua (${rms.length})</option>${rms.map(k => `<option ${k === PD.rm ? "selected" : ""}>${esc(k)}</option>`).join("")}</select></label>` : ""}
      </div><p class="muted" style="margin:0;font-size:12px">LW321 posisi ${nS(DATA.lw.asof)}${hasPrev ? " · pembanding " + nS(DATA.lw.prev.asof) : ""} · ${nf0.format(S.length)} rekening</p></section>
      <div class="tiles">${tile("Baki debet", rpR(os), `${nf0.format(S.length)} rek · ${nf0.format(new Set(S.map(r => r.cif)).size)} CIF`)}${tile("SML (Kol 2)", pct(os ? sum(sml, "os") / os : 0, 2), `${rpR(sum(sml, "os"))} · ${sml.length} rek`)}
        ${tile("NPL (Kol 3–5)", pct(os ? sum(npl, "os") / os : 0, 2), `${rpR(sum(npl, "os"))} · ${npl.length} rek`)}${tile("Akan NPL ≤30 hari", nf0.format(akan.length), rpR(sum(akan, "os")), null, akan.length ? "" : "")}${tile("Total tunggakan", rpR(sum(S, "tgk")), "pokok + bunga + pinalti")}</div>
      <section class="card"><div class="card-h"><h2>Daftar debitur</h2><div class="flex gap-2 items-center"><span class="sub">${nf0.format(L.length)} rekening · ${rpR(sum(L, "os"))}</span><button class="btn" type="button" id="lwCsv">Unduh CSV</button></div></div>
        <div class="seg">${CATS.map(([k, l]) => { const n = k === "dg" && !hasPrev ? null : S.filter(catFilter(k)).length; return `<button type="button" data-c="${k}" aria-selected="${PD.cat === k}" ${n == null ? "disabled title=\"Perlu LW321 bulan lalu\"" : ""}>${l}${n != null ? ` <small class="num">${nf0.format(n)}</small>` : ""}</button>`; }).join("")}</div>
        <div class="dt-scroll"><table id="tLw" class="display stripe" style="width:100%"></table></div>
        <p class="muted" style="margin:0;font-size:12px">Ketuk baris untuk detail. Tembus 90 hari = jatuh tempo angsuran tertunggak + 90 hari (bila belum ada pembayaran). One obligor = tunggakan 0 atau umur tunggakan tidak sejalan dengan KOL_ADK.</p></section>`;
    const go = () => { savePD(); renderLW(); };
    $("#pSeg").onchange = e => { PD.seg = e.target.value; go(); }; $("#pKc").onchange = e => { PD.kc = e.target.value; go(); }; if ($("#pRm")) $("#pRm").onchange = e => { PD.rm = e.target.value; go(); };
    $$("[data-c]", el).forEach(b => b.onclick = () => { PD.cat = b.dataset.c; go(); });
    killDT();
    DT = jQuery("#tLw").DataTable({ data: L, deferRender: true, pageLength: 25, lengthMenu: [10, 25, 50, 100], order: [[7, "desc"]], scrollX: false, autoWidth: false,
      language: dtLang(), columns: [
        { title: "Debitur", data: "nama", render: (d, t, r) => t === "display" ? `<b>${esc(d)}</b><br><small class="muted num">${esc(r.rek)} · ${esc(r.cif)}</small>` : d + " " + r.rek + " " + r.cif },
        { title: "Kanca / Unit", data: "kc", render: (d, t, r) => t === "display" ? esc(d) + (r.seg === "M" ? `<br><small class="muted">${esc(r.uker)}</small>` : "") : d + " " + r.uker },
        { title: "RM", data: "rm", render: d => esc(d), visible: A.user.role === "admin" },
        { title: "Produk", data: "prod" },
        { title: "Kol", data: "kol", className: "dt-r", render: (d, t) => t === "display" ? kolB(d) : d },
        { title: "Kriteria", data: "krit", render: (d, t) => t === "display" ? chip(esc(d), kritCls(d)) : d },
        { title: "Umur tgk", data: "umur", className: "dt-r", render: (d, t) => d == null ? (t === "sort" ? -1e9 : "–") : t === "display" ? (d < 0 ? `<span class="muted">${d}</span>` : d + " hr") : d },
        { title: "OS (Jt)", data: "os", className: "dt-r", render: (d, t) => t === "display" ? nf1.format(d / 1e6) : d },
        { title: "Tunggakan (Jt)", data: "tgk", className: "dt-r", render: (d, t) => t === "display" ? (d ? nf1.format(d / 1e6) : "–") : d },
        { title: "Tembus 90 hr", data: "npl90", className: "dt-r", render: (d, t) => d == null ? (t === "sort" ? 9e9 : "–") : t === "display" ? (d < T ? `<span class="pc crit">lewat</span>` : (d - T) + " hr") : d },
        { title: "Kol bln lalu", data: "prevKol", className: "dt-r", visible: hasPrev, render: (d, t) => d == null ? (t === "display" ? "baru" : 0) : t === "display" ? kolB(d) : d }] });
    jQuery("#tLw tbody").on("click", "tr", function () { const r = DT.row(this).data(); if (r) openDebitur(r); });
    $("#lwCsv").onclick = () => { const rows = DT.rows({ search: "applied" }).data().toArray();
      download(`nominatif-${PD.cat}-${nIso(DATA.lw.asof)}.csv`, toCSV(["Kode Kanca", "Kanca", "Uker", "Nomor Rekening", "Nama Debitur", "CIF", "Kolek", "Produk", "RM Pengelola", "Umur Tunggakan", "Baki Debet", "Total Tunggakan", "Kualitas Kredit", "Kriteria Kredit", "Plafon", "Tgl Realisasi", "Tgl Jatuh Tempo", "Next Pmt Date"],
        rows.map(r => [r.kk, r.kc, r.seg === "M" ? r.uker : "", "'" + r.rek, r.nama, r.cif, r.kol, r.prod === "Mikro" ? "Briguna Mikro" : "Briguna " + r.prod, r.rm, r.umur, r.os, r.tgk, r.kq, r.krit, r.pl, nIso(r.rl), nIso(r.jt), nIso(r.nx)])), "text/csv"); };
  }
  function openDebitur(r) {
    const T = todayN(), sib = (LWCIF.get(r.cif) || []).filter(x => x !== r), prog = r.rl != null && r.jt > r.rl ? clamp((DATA.lw.asof - r.rl) / (r.jt - r.rl), 0, 1) : 0;
    const kv = (k, v) => `<dt>${k}</dt><dd>${v}</dd>`;
    $("#dlgTitle").textContent = r.nama;
    $("#dlgBody").innerHTML = `<div class="flex flex-wrap gap-2 items-center"><span class="muted num">${esc(r.rek)} · CIF ${esc(r.cif)}</span>${kolB(r.kol)}${chip(r.kq, r.kol === 1 ? "good" : r.kol === 2 ? "warn" : "crit")}${r.krit !== r.kq ? chip(esc(r.krit), kritCls(r.krit)) : ""}${r.restr ? chip("Restruk", "warn") : ""}</div>
      <div class="grid2"><dl class="kv">${kv("Baki debet", rpFull(r.os))}${kv("Plafon", rpFull(r.pl))}${kv("Total tunggakan", rpFull(r.tgk))}${kv("· pokok / bunga", nf0.format(r.tp) + " / " + nf0.format(r.tb))}${kv("· pinalti", nf0.format(r.tpn))}${kv("Suku bunga", r.rate ? nf2.format(r.rate) + "%" : "–")}</dl>
      <dl class="kv">${kv("Produk", "Briguna " + esc(r.prod))}${kv("Kanca", esc(r.kc))}${r.seg === "M" ? kv("Unit", esc(r.uker)) : ""}${kv("RM / mantri", esc(r.rm))}${kv("Angsuran berikut", nS(r.nx))}${kv("Umur tunggakan", r.umur == null ? "–" : r.umur + " hari")}
        ${r.npl90 != null ? kv("Tembus 90 hari", nS(r.npl90) + (r.npl90 >= T ? ` (${r.npl90 - T} hari lagi)` : " (lewat)")) : ""}${r.prevKol != null ? kv("Kol bulan lalu", r.prevKol) : ""}</dl></div>
      <div><div class="card-h"><h2 style="font-size:13px">Perjalanan kredit · ${r.jw ? r.jw + " bln" : "–"}</h2><span class="sub">${Math.round(prog * 100)}% tenor · OS ${pct(r.pl ? r.os / r.pl : 0, 1)} plafon</span></div>
        <div class="meter"><i style="width:${prog * 100}%;background:var(--accent)"></i></div><div class="flex justify-between muted" style="font-size:12px;margin-top:4px"><span>Realisasi ${nS(r.rl)}</span><span>Jatuh tempo ${nS(r.jt)}</span></div></div>
      ${r.oo ? `<div class="banner info"><span><b>One obligor · ${esc(r.ooCause)}.</b> Rekening ini ${r.tgk ? "umur tunggakannya tidak sejalan dengan" : "tidak menunggak, tetapi"} kolektibilitas CIF ${r.kol}.</span></div>` : ""}
      ${sib.length ? simpleTable([{ l: "Rekening lain a.n. CIF" }, { l: "Produk" }, { l: "Kol", r: 1 }, { l: "OS (Jt)", r: 1 }, { l: "Tunggakan (Jt)", r: 1 }], sib.map(s => [esc(s.rek), esc(s.prod), kolB(s.kol), nf1.format(s.os / 1e6), s.tgk ? nf1.format(s.tgk / 1e6) : "–"])) : ""}`;
    $("#dlg").showModal();
  }
  function renderDisb() {
    const el = $("#pdBody");
    if (!DISB.length) { el.innerHTML = `<section class="card"><div class="empty">Belum ada data disburse${A.user.role === "rm" ? " atas nama Anda" : ""}.</div></section>`; return; }
    const yrs = uniq(DISB.map(r => r.d.slice(0, 4))).sort(); if (PD.dyr !== "ALL" && !yrs.includes(PD.dyr)) PD.dyr = "ALL";
    const S = DISB.filter(r => (PD.dseg === "ALL" || r.seg === PD.dseg) && (PD.dyr === "ALL" || r.d.startsWith(PD.dyr)) && (PD.dm === "ALL" || r.d.slice(5, 7) === PD.dm));
    el.innerHTML = `<section class="card"><div class="filters">
        <label class="fld"><span>Segmen</span><select class="inp" id="dSeg">${[["ALL", "Ritel + Mikro"], ["R", "Ritel"], ["M", "Mikro"]].map(([k, l]) => `<option value="${k}" ${PD.dseg === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <label class="fld"><span>Tahun</span><select class="inp" id="dYr"><option value="ALL">Semua</option>${yrs.map(y => `<option ${y === PD.dyr ? "selected" : ""}>${y}</option>`).join("")}</select></label>
        <label class="fld"><span>Bulan</span><select class="inp" id="dM"><option value="ALL">Semua</option>${BULAN.map((b, i) => { const m = String(i + 1).padStart(2, "0"); return `<option value="${m}" ${m === PD.dm ? "selected" : ""}>${b}</option>`; }).join("")}</select></label>
      </div></section>
      <div class="tiles">${tile("Net disburse", rpJ(sum(S, "net")), `${nf0.format(S.length)} rekening`)}${tile("Realisasi baru", rpJ(sum(S.filter(r => !r.jenis), "net")), nf0.format(S.filter(r => !r.jenis).length) + " rek")}${tile("Suplesi", rpJ(sum(S.filter(r => r.jenis), "net")), nf0.format(S.filter(r => r.jenis).length) + " rek")}${tile("Rata-rata plafond", rpJ(S.length ? sum(S, "plafon") / S.length : 0), "per rekening")}</div>
      <section class="card"><div class="card-h"><h2>Daftar realisasi</h2><button class="btn" type="button" id="dCsv">Unduh CSV</button></div><div class="dt-scroll"><table id="tDisb" class="display stripe" style="width:100%"></table></div>
      <p class="muted" style="margin:0;font-size:12px">Nama debitur sudah dimasking di sumber data. Status LW = kolektibilitas rekening di LW321 posisi terakhir (cocok nomor rekening).</p></section>`;
    const go = () => { savePD(); renderDisb(); };
    $("#dSeg").onchange = e => { PD.dseg = e.target.value; go(); }; $("#dYr").onchange = e => { PD.dyr = e.target.value; go(); }; $("#dM").onchange = e => { PD.dm = e.target.value; go(); };
    const lwOf = r => { const x = r.rek ? LWK.get(pnKey(r.rek)) : null; return x ? x.kol : null; };
    killDT();
    DT = jQuery("#tDisb").DataTable({ data: S, deferRender: true, pageLength: 25, order: [[0, "desc"]], autoWidth: false, language: dtLang(), columns: [
      { title: "Tanggal", data: "d", render: (d, t) => t === "display" ? tglS(d) : d },
      { title: "Debitur", data: "nama", render: (d, t, r) => t === "display" ? `<b>${esc(d || "-")}</b><br><small class="muted num">${esc(r.rek || "")}${r.cif ? " · " + esc(r.cif) : ""}</small>` : (d || "") + " " + r.rek + " " + r.cif },
      { title: "Segmen", data: "seg", render: d => d === "M" ? "Mikro" : "Ritel" },
      { title: "Kanca / Unit", data: "kc", render: (d, t, r) => t === "display" ? esc(d) + (r.uker ? `<br><small class="muted">${esc(titleCase(r.uker))}</small>` : "") : d + " " + r.uker },
      { title: "Plafond (Jt)", data: "plafon", className: "dt-r", render: (d, t) => t === "display" ? nf1.format(d) : d },
      { title: "Net (Jt)", data: "net", className: "dt-r", render: (d, t) => t === "display" ? nf1.format(d) : d },
      { title: "Jenis", data: "jenis", render: d => d ? "Suplesi" : "Baru" },
      { title: "Produk", data: "prod" },
      { title: "Bunga", data: "rate", className: "dt-r", render: (d, t) => t === "display" ? (d ? nf2.format(d) + "%" : "–") : d },
      { title: "Satker / instansi", data: "instansi", render: (d, t, r) => esc([d, r.profesi].filter(Boolean).join(" · ") || "–") },
      { title: "RM / mantri", data: "rm", render: d => esc(d), visible: A.user.role === "admin" },
      { title: "Status LW", data: null, className: "dt-r", render: (d, t, r) => { const k = lwOf(r); return k == null ? (t === "display" ? `<span class="muted">–</span>` : 0) : t === "display" ? kolB(k) : k; } }] });
    $("#dCsv").onclick = () => { const rows = DT.rows({ search: "applied" }).data().toArray();
      download("disburse.csv", toCSV(["Tanggal", "Segmen", "Kanca", "Unit", "Nomor Rekening", "CIF", "Nama Debitur", "Plafond (juta)", "Net (juta)", "Jenis", "Produk", "Bunga", "Tenor", "Instansi", "RM", "Status LW"],
        rows.map(r => [r.d, r.seg === "M" ? "Mikro" : "Ritel", r.kc, r.uker, "'" + (r.rek || ""), r.cif, r.nama, r.plafon, r.net, r.jenis ? "Suplesi" : "Baru", r.prod, r.rate, r.tenor, r.instansi, r.rm, lwOf(r) ?? ""])), "text/csv"); };
  }
  const dtLang = () => ({ search: "Cari:", lengthMenu: "_MENU_ baris", info: "_START_–_END_ dari _TOTAL_", infoEmpty: "Tidak ada data", infoFiltered: "(disaring dari _MAX_)", zeroRecords: "Tidak ada yang cocok", paginate: { previous: "‹", next: "›" } });

  /* ================= ADMIN ================= */
  const AD = { tab: "data" };
  async function viewAdmin(v) {
    killDT();
    v.innerHTML = `<nav class="tabs" role="tablist">${[["data", "Data & sync"], ["upload", "Upload LW321"], ["users", "User"], ["log", "Access log"]].map(([k, l]) => `<button type="button" data-t="${k}" aria-selected="${AD.tab === k}">${l}</button>`).join("")}</nav><div id="adBody" class="grid gap-4"></div>`;
    $$(".tabs [data-t]", v).forEach(b => b.onclick = () => { AD.tab = b.dataset.t; render(); });
    ({ data: adData, upload: adUpload, users: adUsers, log: adLog })[AD.tab]($("#adBody"));
  }
  async function adData(el) {
    await loadPart("meta"); const M = DATA.meta || {};
    el.innerHTML = `<section class="card"><div class="card-h"><h2>Status data</h2><span class="sub">cache dibangun ${M.updated ? new Date(M.updated).toLocaleString("id-ID") : "–"}</span></div>
      ${simpleTable([{ l: "Bagian" }, { l: "Sumber sheet" }, { l: "Posisi terakhir" }], [["Keragaan & RKA", "keragaan, RKA", tglS(M.ker)], ["Disburse Ritel", "disburse ritel 2025, disburse ritel 2026", tglS(M.disb && M.disb.R)], ["Disburse Mikro", "disburse mikro", tglS(M.disb && M.disb.M)], ["Target RM / mantri", "list RM ritel, list mantri mikro", RM ? uniq(RM.months.filter(x => x.t > 0).map(x => x.ym)).sort().map(ymS).slice(-1)[0] || "belum ada" : "–"], ["LW321", "LW321", M.lw ? nS(M.lw) : "belum diupload"], ["LW321 bulan lalu", "LW321 bulan lalu", M.lwPrev ? nS(M.lwPrev) : "belum ada"]])}
      <div class="flex gap-2 flex-wrap"><button class="btn primary" type="button" id="syncForce">Sync paksa sekarang</button><span class="muted" style="font-size:12px;align-self:center">Membaca ulang semua sheet (±10–60 detik). Pengguna lain mendapat data baru saat membuka atau menekan Sync.</span></div></section>
      <section class="card"><div class="card-h"><h2>Catatan pengisian sheet</h2></div><ul class="muted" style="margin:0;padding-left:18px;font-size:13px;line-height:1.7">
      <li>Setelan lokal spreadsheet harus sesuai format angka sumber (File → Setelan → Lokal), agar 1,250 tidak terbaca 1,25.</li>
      <li>Isi ulang sheet lewat File → Impor → Ganti sheet, jangan copy-paste teks berformat.</li>
      <li>Nama sheet yang dibaca: keragaan, RKA, disburse ritel 2025, disburse ritel 2026, disburse mikro, list RM ritel, list mantri mikro.</li>
      <li>Jangan aktifkan "Publikasikan ke web": data hanya boleh dibaca Apps Script.</li></ul></section>`;
    $("#syncForce").onclick = async e => { const b = e.currentTarget; b.disabled = true; b.textContent = "Menyinkronkan…"; try { const j = await A.call("sync", { force: true }); toast(`Sync selesai (${Math.round((j.stats && j.stats.ms || 0) / 1000)} dtk).`); await reloadAll(); render(); } catch (er) { toast(er.message); b.disabled = false; b.textContent = "Sync paksa sekarang"; } };
  }
  function loadSheetJS() { return window.XLSX ? Promise.resolve() : new Promise((res, rej) => { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"; s.onload = res; s.onerror = () => rej(new Error("Pustaka Excel gagal dimuat.")); document.head.appendChild(s); }); }
  function adUpload(el) {
    el.innerHTML = `<section class="card"><div class="card-h"><h2>Upload LW321</h2><span class="sub">khusus admin · file diolah di browser, lalu dikirim bertahap ke Google Sheets</span></div>
      <div class="filters"><label class="fld"><span>Posisi</span><select class="inp" id="upMode"><option value="cur">LW321 posisi terkini</option><option value="prev">LW321 / data debitur bulan lalu (pembanding)</option></select></label>
      <label class="fld"><span>File (.xlsx / .xls / .csv)</span><input class="inp" type="file" id="upFile" accept=".xlsx,.xls,.xlsb,.csv" style="padding-top:6px"></label></div>
      <div id="upInfo"></div>
      <p class="muted" style="margin:0;font-size:12px">Format yang dikenali: LW321 (header PERIODE, NOMOR_REKENING, KOL_ADK, BALANCE DALAM IDR, …) dan Data Debitur Briguna (NOMOR REKENING, KOL ADK, OS IDR, …). Semua sheet dibaca, rekening ganda dibuang. Bila posisi terkini baru lebih baru sebulan, LW321 lama otomatis menjadi pembanding bulan lalu.</p></section>`;
    $("#upFile").onchange = async e => {
      const f = e.target.files[0], info = $("#upInfo"); if (!f) return;
      info.innerHTML = `<div class="progress"><i style="width:15%"></i></div><p class="muted">Membaca ${esc(f.name)}…</p>`;
      try {
        await loadSheetJS(); await new Promise(r => setTimeout(r, 30));
        const wb = XLSX.read(await f.arrayBuffer(), { dense: true }), P = parseLW(wb);
        const segN = { R: P.rows.filter(r => r[19] !== "Mikro").length, M: P.rows.filter(r => r[19] === "Mikro").length };
        info.innerHTML = `<div class="banner info"><span><b>${nf0.format(P.rows.length)} rekening</b> · posisi <b>${tglS(P.asof)}</b> · Ritel ${nf0.format(segN.R)} · Mikro ${nf0.format(segN.M)} · sheet: ${esc(P.sheets.join(", "))}</span></div>
          <div class="flex gap-2"><button class="btn primary" type="button" id="upGo">Kirim ke database</button><button class="btn" type="button" id="upCancel">Batal</button></div><div id="upProg"></div>`;
        $("#upCancel").onclick = () => adUpload(el);
        $("#upGo").onclick = async ev => {
          ev.currentTarget.disabled = true; const mode = $("#upMode").value, N = CFG.UPLOAD_CHUNK, total = Math.ceil(P.rows.length / N), pg = $("#upProg");
          try {
            for (let i = 0; i < total; i++) {
              pg.innerHTML = `<div class="progress" style="margin-top:8px"><i style="width:${(i / total) * 100}%"></i></div><p class="muted">Mengirim bagian ${i + 1} dari ${total}…${i === total - 1 ? " (menyusun cache, bisa ±1 menit)" : ""}</p>`;
              await A.call("lwUpload", { mode, seq: i, total, asof: P.asof, rows: P.rows.slice(i * N, (i + 1) * N) });
            }
            pg.innerHTML = `<div class="banner info"><span>Upload selesai: ${nf0.format(P.rows.length)} rekening tersimpan sebagai <b>${mode === "cur" ? "LW321" : "LW321 bulan lalu"}</b>.</span></div>`;
            DATA.lw = null; DATA.meta = null; await loadPart("meta", true); toast("LW321 tersimpan.");
          } catch (er) { pg.innerHTML = `<div class="banner"><span>Upload gagal: ${esc(er.message)}. Ulangi dari awal.</span></div>`; }
        };
      } catch (er) { info.innerHTML = `<div class="banner"><span>${esc(er.message)}</span></div>`; }
    };
  }
  // LW321 / Data Debitur → baris sesuai kolom sheet LW321 di Apps Script
  function parseLW(wb) {
    const nk = k => String(k ?? "").trim().toLowerCase().replace(/[\s\-\/]+/g, "_").replace(/[^a-z0-9_]/g, "");
    const num = v => { if (typeof v === "number") return v; const s = String(v ?? "").replace(/[^\d,.\-]/g, ""); if (!s || s === "-") return 0; return parseFloat(/,\d{1,2}$/.test(s) && s.includes(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "")) || 0; };
    const iso = v => { if (v == null || v === "") return ""; if (typeof v === "number") { if (v > 20000000 && v < 30000000) { const s = String(v); return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`; } return new Date(Math.round((v - 25569) * 864e5)).toISOString().slice(0, 10); }
      const s = String(v).trim(); let m; if ((m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/))) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`; if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return m[0]; return ""; };
    const prod = d => { d = String(d || "").toUpperCase(); return d.includes("MIKRO") ? "Mikro" : /PRA[\s-]?PURNA|UMUM/.test(d) ? "Pra-Purna" : /PURNA|KRESUN/.test(d) ? "Purna" : /KARYA|KRETAP/.test(d) ? "Karya" : "Lainnya"; };
    const rmClean = s => { s = String(s ?? ""); if (!s.trim() || /^\s*-\s*$/.test(s)) return ["(Tanpa RM)", ""]; const pn = (s.match(/^\s*(\d+)/) || [])[1] || ""; const nm = (s.slice(0, 11).replace(/[^A-Za-z]/g, "") + s.slice(11)).trim().replace(/\s+/g, " "); return [nm === nm.toUpperCase() ? titleCase(nm) : nm || "(Tanpa RM)", pn]; };
    const rows = [], seen = new Set(), sheets = []; let asof = "";
    for (const n of wb.SheetNames) {
      const a = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null, blankrows: false });
      let hi = -1; for (let h = 0; h < Math.min(25, a.length); h++) { const hd = (a[h] || []).map(nk); if (hd.includes("nomor_rekening") && hd.includes("kol_adk")) { hi = h; break; } }
      if (hi < 0) continue; const H = a[hi].map(nk), c = (...ks) => { for (const k of ks) { const i = H.indexOf(k); if (i >= 0) return i; } return -1; };
      const C = { per: c("periode"), kk: c("kode_kanca", "kode_cabang"), ku: c("kode_uker", "branch"), un: c("uker", "unit"), rek: c("nomor_rekening"), nama: c("nama_debitur"), pl: c("plafon_dalam_idr", "plafon"), nx: c("next_pmt_date", "tgl_next_pmt"), rate: c("rate"), rl: c("tgl_realisasi"), jt: c("tgl_jatuh_tempo"), jw: c("jangka_waktu"), rs: c("flag_restruk"), cif: c("cifno", "cif"), tp: c("tunggakan_pokok"), tb: c("tunggakan_bunga"), tpn: c("tunggakan_pinalti", "tunggakan_penalti"), desc: c("description"), kol: c("kol_adk"), rm: c("pn_pengelola_singlepn", "pn_pengelola_1", "pn_pengelola1"), os: c("balance_dalam_idr", "os_idr", "baki_debet") };
      if (C.os < 0) continue; sheets.push(n); const g = (r, i) => i < 0 ? null : r[i];
      a.slice(hi + 1).forEach(r => {
        const rek = String(g(r, C.rek) ?? "").trim(), key = rek.replace(/\D/g, "").replace(/^0+/, ""); if (!key || seen.has(key)) return; seen.add(key);
        const per = iso(g(r, C.per)); if (per > asof) asof = per;
        let rate = num(g(r, C.rate)); if (rate > 0 && rate < 1) rate = Math.round(rate * 10000) / 100;
        const [rmN, pn] = rmClean(g(r, C.rm));
        rows.push([per, rek, String(g(r, C.nama) ?? "").trim(), String(g(r, C.cif) ?? "").trim().toUpperCase(), String(g(r, C.kk) ?? "").trim(), String(g(r, C.ku) ?? "").trim(), String(g(r, C.un) ?? "").trim(),
          Math.round(num(g(r, C.pl))), Math.round(num(g(r, C.os))), rate, iso(g(r, C.nx)), iso(g(r, C.rl)), iso(g(r, C.jt)), parseInt(String(g(r, C.jw) ?? "")) || 0,
          String(g(r, C.rs) ?? "").trim().toUpperCase() === "Y" ? "Y" : "N", Math.round(num(g(r, C.tp))), Math.round(num(g(r, C.tb))), Math.round(num(g(r, C.tpn))), Math.max(1, Math.min(5, parseInt(g(r, C.kol)) || 1)), prod(g(r, C.desc)), rmN, pn]);
      });
    }
    if (!rows.length) throw new Error("Kolom NOMOR_REKENING dan KOL_ADK tidak ditemukan. Pastikan file adalah LW321 atau data debitur Briguna.");
    rows.forEach(r => { if (!r[0]) r[0] = asof; });
    return { rows, asof, sheets };
  }
  async function adUsers(el) {
    el.innerHTML = `<section class="card"><div class="empty">Memuat user…</div></section>`;
    const j = await A.call("usersList"), users = j.users || [];
    const rmNames = uniq([...(RM ? RM.months.map(x => x.rm) : []), ...(DATA.lw ? DATA.lw.rmN : [])]).filter(n => n && !/^PN |^Tanpa|^\(Tanpa/.test(n)).sort((a, b) => a.localeCompare(b));
    el.innerHTML = `<section class="card"><div class="card-h"><h2>User</h2><button class="btn primary" type="button" id="uNew">Tambah user</button></div>
      ${simpleTable([{ l: "Username" }, { l: "Nama" }, { l: "Peran" }, { l: "Nama RM (data)" }, { l: "PN" }, { l: "Status" }, { l: "Login terakhir" }, { l: "" }],
        users.map((u, i) => [`<b>${esc(u.username)}</b>`, esc(u.nama), chip(esc(A.ROLE_LABEL[u.role] || u.role), u.role === "admin" ? "crit" : u.role === "rm" ? "good" : "neutral"), esc(u.rm_name || "–"), esc(u.pn || "–"), u.active ? chip("aktif", "good") : chip("nonaktif", "neutral"), u.last_login ? new Date(u.last_login).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "–", `<button class="linkish" data-u="${i}">Ubah</button>`]))}
      <p class="muted" style="margin:0;font-size:12px">Peran RM hanya melihat debitur yang <b>Nama RM</b> atau <b>PN</b>-nya cocok dengan data LW321 / disburse. Guest hanya melihat angka agregat.</p></section>
      <datalist id="rmList">${rmNames.map(n => `<option value="${esc(n)}">`).join("")}</datalist>`;
    const form = u => {
      $("#dlgTitle").textContent = u ? "Ubah user " + u.username : "Tambah user";
      $("#dlgBody").innerHTML = `<form id="uForm" class="form-grid" novalidate>
        <label class="fld"><span>Username</span><input class="inp" id="fUn" value="${esc(u ? u.username : "")}" ${u ? "readonly" : ""} maxlength="60" autocapitalize="none" required></label>
        <label class="fld"><span>Nama lengkap</span><input class="inp" id="fNm" value="${esc(u ? u.nama : "")}" maxlength="80"></label>
        <label class="fld"><span>Peran</span><select class="inp" id="fRo">${["admin", "rm", "guest"].map(r => `<option value="${r}" ${u && u.role === r ? "selected" : !u && r === "rm" ? "selected" : ""}>${A.ROLE_LABEL[r]}</option>`).join("")}</select></label>
        <label class="fld"><span>Nama RM / mantri di data</span><input class="inp" id="fUrm" list="rmList" value="${esc(u ? u.rm_name : "")}" maxlength="80" placeholder="ketik untuk mencari"></label>
        <label class="fld"><span>PN (opsional)</span><input class="inp" id="fPn" value="${esc(u ? u.pn : "")}" inputmode="numeric" maxlength="12"></label>
        <label class="fld"><span>${u ? "Password baru (kosongkan bila tetap)" : "Password awal"}</span><input class="inp" id="fPw" type="password" autocomplete="new-password" minlength="8" maxlength="100"></label>
        <label class="fld" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="fAc" ${!u || u.active ? "checked" : ""}><span>Aktif</span></label>
        <div class="flex gap-2" style="grid-column:1/-1"><button class="btn primary" type="submit">Simpan</button><button class="btn" type="button" data-close>Batal</button></div><p id="uMsg" class="warn" hidden style="grid-column:1/-1;margin:0"></p></form>`;
      $("#dlg").showModal();
      $("#uForm").onsubmit = async e => { e.preventDefault(); const msg = $("#uMsg"), pw = $("#fPw").value, un = A.cleanInput($("#fUn").value, 60).toLowerCase();
        if (!u && pw.length < 8) { msg.hidden = false; msg.textContent = "Password awal minimal 8 karakter."; return; }
        if (pw && pw.length < 8) { msg.hidden = false; msg.textContent = "Password minimal 8 karakter."; return; }
        try { await A.call("userSave", { user: { username: un, nama: A.cleanInput($("#fNm").value, 80), role: $("#fRo").value, rm_name: A.cleanInput($("#fUrm").value, 80), pn: A.cleanInput($("#fPn").value, 12), active: $("#fAc").checked, phash: pw ? await A.pwHash(un, pw) : undefined } });
          $("#dlg").close(); toast("User tersimpan."); adUsers(el); } catch (er) { msg.hidden = false; msg.textContent = er.message; } };
    };
    $("#uNew").onclick = () => form(null);
    $$("[data-u]", el).forEach(b => b.onclick = () => form(users[+b.dataset.u]));
  }
  async function adLog(el) {
    el.innerHTML = `<section class="card"><div class="empty">Memuat log…</div></section>`;
    const j = await A.call("logList", { limit: 500 });
    el.innerHTML = `<section class="card"><div class="card-h"><h2>Access log</h2><span class="sub">500 aktivitas terakhir</span></div><div class="dt-scroll"><table id="tLog" class="display stripe" style="width:100%"></table></div></section>`;
    killDT();
    DT = jQuery("#tLog").DataTable({ data: j.rows, pageLength: 25, order: [[0, "desc"]], language: dtLang(), columns: [
      { title: "Waktu", render: (d, t, r) => t === "display" ? new Date(r[0]).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "medium" }) : r[0] },
      { title: "User", render: (d, t, r) => esc(r[1]) }, { title: "Peran", render: (d, t, r) => esc(r[2]) }, { title: "Aktivitas", render: (d, t, r) => esc(r[3]) },
      { title: "Status", render: (d, t, r) => t === "display" ? chip(esc(r[4]), r[4] === "OK" ? "good" : /FAIL|DENIED|LOCKED|RATE/.test(r[4]) ? "crit" : "neutral") : r[4] }, { title: "Keterangan", render: (d, t, r) => esc(r[5]) }] });
  }

  /* ================= boot, login & shell ================= */
  async function reloadAll() { DATA.meta = DATA.ker = DATA.rmk = DATA.disb = DATA.lw = null; RM = null; LWR = []; DISB = []; await loadPart("meta", true); }
  function showLogin(msg) {
    $("#app").hidden = true; $("#login").hidden = false; $("#boot").hidden = true;
    const m = $("#lgMsg"); if (msg) { m.hidden = false; m.textContent = msg; } else m.hidden = true;
    setTimeout(() => $("#lgUser").focus(), 50);
  }
  function enterApp() {
    const u = A.user; $("#login").hidden = true; $("#app").hidden = false; $("#boot").hidden = true;
    $("#uName").textContent = u.nama || u.username; $("#uRole").textContent = A.ROLE_LABEL[u.role] || u.role;
    $("#uAv").textContent = String(u.nama || u.username).split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
    $$(".nav a").forEach(a => a.hidden = !A.can(a.dataset.perm));
    if (!A.can(curView())) location.hash = "#dashboard";
    syncLabel(); render();
  }
  function syncLabel() { const M = DATA.meta; $("#syncSt").textContent = M && M.updated ? "data " + new Date(M.updated).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""; }
  $("#appName").textContent = CFG.APP_NAME; document.title = CFG.APP_NAME;
  $("#loginForm").addEventListener("submit", async e => {
    e.preventDefault(); const b = $("#lgBtn"), m = $("#lgMsg"), un = A.cleanInput($("#lgUser").value, 60), pw = $("#lgPass").value;
    if (!un || !pw) { m.hidden = false; m.textContent = "Isi username dan password."; return; }
    b.disabled = true; b.textContent = "Memeriksa…"; m.hidden = true;
    try { await A.login(un, pw); $("#lgPass").value = ""; await loadPart("meta").catch(() => null); enterApp(); }
    catch (er) { m.hidden = false; m.textContent = er.message; }
    b.disabled = false; b.textContent = "Masuk";
  });
  $("#btnSync").onclick = async e => { const b = e.currentTarget; b.disabled = true; try { const j = await A.call("sync", { force: A.user.role === "admin" }); await reloadAll(); syncLabel(); render(); toast(j.skipped ? "Data sudah terbaru." : "Data diperbarui dari Google Sheets."); } catch (er) { toast(er.message); } b.disabled = false; };
  $("#btnTheme").onclick = () => { const r = document.documentElement, dark = r.dataset.theme ? r.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches; r.dataset.theme = dark ? "light" : "dark"; lsSet("brg.theme", r.dataset.theme); render(); };
  { const t = lsGet("brg.theme", null); if (t) document.documentElement.dataset.theme = t; }
  $("#btnUser").onclick = () => { const m = $("#userMenu"); m.hidden = !m.hidden; $("#btnUser").setAttribute("aria-expanded", !m.hidden); };
  document.addEventListener("click", e => { if (!e.target.closest(".user-menu")) $("#userMenu").hidden = true; });
  $("#umOut").onclick = () => A.logout();
  $("#umPw").onclick = () => {
    $("#userMenu").hidden = true; $("#dlgTitle").textContent = "Ganti password";
    $("#dlgBody").innerHTML = `<form id="pwF" class="form-grid" novalidate><label class="fld"><span>Password lama</span><input class="inp" type="password" id="pw0" autocomplete="current-password"></label><label class="fld"><span>Password baru (min. 8)</span><input class="inp" type="password" id="pw1" autocomplete="new-password"></label><label class="fld"><span>Ulangi password baru</span><input class="inp" type="password" id="pw2" autocomplete="new-password"></label>
      <div class="flex gap-2" style="grid-column:1/-1"><button class="btn primary" type="submit">Simpan</button><button class="btn" type="button" data-close>Batal</button></div><p id="pwM" class="warn" hidden style="grid-column:1/-1;margin:0"></p></form>`;
    $("#dlg").showModal();
    $("#pwF").onsubmit = async e => { e.preventDefault(); const m = $("#pwM"), a = $("#pw1").value;
      if (a.length < 8) { m.hidden = false; m.textContent = "Password baru minimal 8 karakter."; return; } if (a !== $("#pw2").value) { m.hidden = false; m.textContent = "Ulangan password tidak sama."; return; }
      try { await A.changePassword($("#pw0").value, a); $("#dlg").close(); toast("Password diganti."); } catch (er) { m.hidden = false; m.textContent = er.message; } };
  };
  $("#dlg").addEventListener("click", e => { if (e.target === $("#dlg") || e.target.closest("[data-close]")) $("#dlg").close(); });
  window.addEventListener("auth:expired", () => { killDT(); showLogin("Sesi berakhir. Silakan login lagi."); });
  window.addEventListener("auth:logout", e => { killDT(); Object.keys(DATA).forEach(k => DATA[k] = null); RM = null; LWR = []; DISB = []; $("#view").innerHTML = ""; showLogin(e.detail === "idle" ? "Anda keluar otomatis karena tidak aktif." : ""); });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => A.session && render());

  window.App = { toast, download };
  (async () => {
    if (typeof DecompressionStream === "undefined") { $("#bootMsg").textContent = "Browser ini terlalu lama. Gunakan Chrome, Edge, atau Safari versi terbaru."; return; }
    const s = await A.loadSession();
    if (!s) { showLogin(); return; }
    A.startIdle();
    try { await A.call("me"); await loadPart("meta").catch(() => null); enterApp(); } catch (e) { showLogin(e.code === "auth" ? "Sesi berakhir. Silakan login lagi." : e.message); }
  })();
})();
