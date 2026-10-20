/* Tools RM: kalkulator max plafond (THP & DSR), kalkulator angsuran anuitas / flat, dan tabel angsuran.
   Semua perhitungan di browser; tidak ada data yang dikirim ke server. */
(function () {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const { esc } = window.Auth;
  const nf0 = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
  const nf2 = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const rp = v => "Rp " + nf0.format(Math.round(v || 0));
  const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  // input uang: terima "5.000.000", "5,000,000", "5jt", "1,5 M"
  function money(v) {
    let s = String(v || "").trim().toLowerCase().replace(/\s/g, ""); if (!s) return 0;
    let mult = 1; if (/(m|miliar)$/.test(s)) { mult = 1e9; s = s.replace(/(miliar|m)$/, ""); } else if (/(jt|juta)$/.test(s)) { mult = 1e6; s = s.replace(/(juta|jt)$/, ""); } else if (/(rb|ribu|k)$/.test(s)) { mult = 1e3; s = s.replace(/(ribu|rb|k)$/, ""); }
    if (mult > 1) s = s.replace(",", "."); else s = s.replace(/[.,](?=\d{3}(\D|$))/g, "").replace(",", ".");
    const n = parseFloat(s.replace(/[^\d.\-]/g, "")); return isFinite(n) ? n * mult : 0;
  }
  const fmtMoneyInput = el => { const n = money(el.value); if (n) el.value = nf0.format(n); };

  /* ---------- rumus ---------- */
  // anuitas: A = P·i / (1 − (1+i)^−n), i = bunga per bulan
  const annuity = (P, rateYear, n) => { const i = rateYear / 1200; return i ? P * i / (1 - Math.pow(1 + i, -n)) : P / n; };
  const pvAnnuity = (A, rateYear, n) => { const i = rateYear / 1200; return i ? A * (1 - Math.pow(1 + i, -n)) / i : A * n; };
  // flat: angsuran = P/n + P·r/12 (bunga dihitung dari plafon awal)
  const flat = (P, rateYear, n) => P / n + P * rateYear / 1200;
  const pvFlat = (A, rateYear, n) => A / (1 / n + rateYear / 1200);
  function schedule(P, rateYear, n, method, start) {
    const rows = []; let sisa = P; const i = rateYear / 1200, A = method === "flat" ? flat(P, rateYear, n) : annuity(P, rateYear, n);
    const d0 = start ? new Date(start + "T00:00:00") : new Date();
    for (let k = 1; k <= n; k++) {
      const bunga = method === "flat" ? P * i : sisa * i;
      let pokok = method === "flat" ? P / n : A - bunga;
      if (k === n) pokok = sisa; // pembulatan akhir
      sisa = Math.max(0, sisa - pokok);
      const d = new Date(d0.getFullYear(), d0.getMonth() + k, Math.min(d0.getDate(), 28));
      rows.push({ k, tgl: d, angs: pokok + bunga, pokok, bunga, sisa });
    }
    return { A, rows, totBunga: rows.reduce((a, r) => a + r.bunga, 0), totBayar: rows.reduce((a, r) => a + r.angs, 0) };
  }
  // suku bunga efektif setara dari bunga flat (iterasi Newton), untuk informasi
  function effFromFlat(rateFlat, n) {
    const A = flat(1, rateFlat, n); let r = rateFlat * 1.8 / 1200;
    for (let it = 0; it < 60; it++) { const f = r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1) - A, h = 1e-7, f2 = (r + h) * Math.pow(1 + r + h, n) / (Math.pow(1 + r + h, n) - 1) - A; r -= f / ((f2 - f) / h); }
    return r * 1200;
  }

  /* ---------- tampilan ---------- */
  const ST = { view: "bulan" };
  function render(el) {
    const T = window.APP_CONFIG.TOOLS;
    el.innerHTML = `
    <div class="grid gap-4 lg:grid-cols-2">
      <section class="card">
        <div class="card-h"><h2>Kalkulator max plafond</h2><span class="sub">berdasarkan THP & DSR</span></div>
        <form id="fMax" class="form-grid" novalidate>
          <label class="fld"><span>Take home pay / bulan</span><input id="mThp" inputmode="numeric" class="inp" placeholder="mis. 8.500.000" autocomplete="off"></label>
          <label class="fld"><span>Angsuran lain yang berjalan</span><input id="mOth" inputmode="numeric" class="inp" placeholder="0" autocomplete="off"></label>
          <label class="fld"><span>Batas DSR (%)</span><input id="mDsr" type="number" min="1" max="100" step="1" class="inp" value="${T.DSR}"></label>
          <label class="fld"><span>Suku bunga (% p.a.)</span><input id="mRate" type="number" min="0" max="40" step="0.01" class="inp" value="${T.RATE}"></label>
          <label class="fld"><span>Tenor (bulan)</span><input id="mTen" type="number" min="1" max="360" step="1" class="inp" value="${T.TENOR}"></label>
          <label class="fld"><span>Metode</span><select id="mMet" class="inp"><option value="anuitas">Anuitas</option><option value="flat">Flat</option></select></label>
        </form>
        <div id="mOut" class="result"></div>
      </section>
      <section class="card">
        <div class="card-h"><h2>Kalkulator angsuran</h2><span class="sub">anuitas atau flat</span></div>
        <form id="fAng" class="form-grid" novalidate>
          <label class="fld"><span>Plafond</span><input id="aPl" inputmode="numeric" class="inp" placeholder="mis. 250.000.000" autocomplete="off"></label>
          <label class="fld"><span>Suku bunga (% p.a.)</span><input id="aRate" type="number" min="0" max="40" step="0.01" class="inp" value="${T.RATE}"></label>
          <label class="fld"><span>Tenor (bulan)</span><input id="aTen" type="number" min="1" max="360" step="1" class="inp" value="${T.TENOR}"></label>
          <label class="fld"><span>Metode</span><select id="aMet" class="inp"><option value="anuitas">Anuitas</option><option value="flat">Flat</option></select></label>
          <label class="fld"><span>Provisi + administrasi (%)</span><input id="aBy" type="number" min="0" max="10" step="0.01" class="inp" value="0"></label>
          <label class="fld"><span>Tanggal realisasi</span><input id="aTgl" type="date" class="inp"></label>
        </form>
        <div id="aOut" class="result"></div>
      </section>
    </div>
    <section class="card" id="schSec">
      <div class="card-h"><h2>Tabel angsuran</h2>
        <div class="flex flex-wrap gap-2 items-center no-print">
          <div class="seg" role="tablist"><button type="button" data-v="bulan" aria-selected="true">Per bulan</button><button type="button" data-v="tahun">Per tahun</button></div>
          <button type="button" class="btn" id="schCsv">Unduh CSV</button><button type="button" class="btn" id="schPrint">Cetak</button>
        </div></div>
      <div id="schHead" class="print-only"></div>
      <div id="sch" class="tbl-wrap"></div>
    </section>`;
    const today = new Date(); $("#aTgl", el).value = today.toISOString().slice(0, 10);
    el.querySelectorAll("#mThp,#mOth,#aPl").forEach(i => i.addEventListener("blur", () => { fmtMoneyInput(i); }));
    const calcMax = () => {
      const thp = money($("#mThp").value), oth = money($("#mOth").value), dsr = +$("#mDsr").value || 0, rate = +$("#mRate").value || 0, n = Math.round(+$("#mTen").value || 0), met = $("#mMet").value;
      if (!thp || !n) { $("#mOut").innerHTML = `<p class="muted">Isi THP dan tenor untuk melihat hasil.</p>`; return; }
      const maxA = Math.max(0, thp * dsr / 100 - oth), P = met === "flat" ? pvFlat(maxA, rate, n) : pvAnnuity(maxA, rate, n);
      $("#mOut").innerHTML = `<div class="big"><small>Max plafond</small><b>${rp(Math.floor(P / 1e5) * 1e5)}</b></div>
        <dl class="kv"><dt>Max angsuran (${dsr}% × THP − angsuran lain)</dt><dd>${rp(maxA)}</dd><dt>DSR terpakai angsuran lain</dt><dd>${nf2.format(thp ? oth / thp * 100 : 0)}%</dd><dt>Tenor</dt><dd>${n} bln (${nf2.format(n / 12)} th)</dd></dl>
        ${maxA <= 0 ? `<p class="warn">Angsuran lain sudah melebihi batas DSR. Tidak ada ruang plafond.</p>` : `<button type="button" class="btn primary" id="mUse">Pakai di kalkulator angsuran</button>`}`;
      const u = $("#mUse"); if (u) u.onclick = () => { $("#aPl").value = nf0.format(Math.floor(P / 1e5) * 1e5); $("#aRate").value = rate; $("#aTen").value = n; $("#aMet").value = met; calcAng(); $("#aPl").scrollIntoView({ behavior: "smooth", block: "center" }); };
    };
    let last = null;
    const calcAng = () => {
      const P = money($("#aPl").value), rate = +$("#aRate").value || 0, n = Math.round(+$("#aTen").value || 0), met = $("#aMet").value, by = +$("#aBy").value || 0;
      if (!P || !n) { $("#aOut").innerHTML = `<p class="muted">Isi plafond dan tenor untuk melihat angsuran.</p>`; $("#sch").innerHTML = ""; last = null; return; }
      const S = schedule(P, rate, n, met, $("#aTgl").value); last = { P, rate, n, met, S };
      $("#aOut").innerHTML = `<div class="big"><small>Angsuran per bulan${met === "anuitas" ? "" : " (flat)"}</small><b>${rp(S.A)}</b></div>
        <dl class="kv"><dt>Total bunga</dt><dd>${rp(S.totBunga)}</dd><dt>Total pembayaran</dt><dd>${rp(S.totBayar)}</dd><dt>Biaya provisi + admin</dt><dd>${rp(P * by / 100)}</dd><dt>Dana diterima</dt><dd>${rp(P * (1 - by / 100))}</dd>
        ${met === "flat" ? `<dt>Setara bunga efektif</dt><dd>${nf2.format(effFromFlat(rate, n))}% p.a.</dd>` : ""}<dt>Penghasilan minimal (DSR ${window.APP_CONFIG.TOOLS.DSR}%)</dt><dd>${rp(S.A / (window.APP_CONFIG.TOOLS.DSR / 100))}</dd></dl>`;
      drawSch();
    };
    const drawSch = () => {
      if (!last) return; const { S, P, rate, n, met } = last;
      $("#schHead").innerHTML = `<h3>Simulasi angsuran Briguna</h3><p>Plafond ${rp(P)} · bunga ${nf2.format(rate)}% p.a. ${met} · tenor ${n} bulan · angsuran ${rp(S.A)} · dicetak ${new Date().toLocaleDateString("id-ID")}</p>`;
      let rows = S.rows;
      if (ST.view === "tahun") { const g = []; rows.forEach(r => { const y = Math.ceil(r.k / 12); const o = g[y - 1] || (g[y - 1] = { k: y, angs: 0, pokok: 0, bunga: 0, sisa: 0 }); o.angs += r.angs; o.pokok += r.pokok; o.bunga += r.bunga; o.sisa = r.sisa; }); rows = g; }
      $("#sch").innerHTML = `<table class="tbl"><thead><tr><th>${ST.view === "tahun" ? "Tahun ke" : "Bulan ke"}</th>${ST.view === "tahun" ? "" : "<th>Jatuh tempo</th>"}<th class="r">Angsuran</th><th class="r">Pokok</th><th class="r">Bunga</th><th class="r">Sisa pokok</th></tr></thead>
        <tbody>${rows.map(r => `<tr><td>${r.k}</td>${ST.view === "tahun" ? "" : `<td>${r.tgl.getDate()} ${BULAN[r.tgl.getMonth()]} ${r.tgl.getFullYear()}</td>`}<td class="r">${nf0.format(r.angs)}</td><td class="r">${nf0.format(r.pokok)}</td><td class="r">${nf0.format(r.bunga)}</td><td class="r">${nf0.format(r.sisa)}</td></tr>`).join("")}</tbody>
        <tfoot><tr><td colspan="${ST.view === "tahun" ? 1 : 2}">Total</td><td class="r">${nf0.format(S.totBayar)}</td><td class="r">${nf0.format(P)}</td><td class="r">${nf0.format(S.totBunga)}</td><td></td></tr></tfoot></table>`;
    };
    el.querySelectorAll("#fMax input,#fMax select").forEach(i => i.addEventListener("input", calcMax));
    el.querySelectorAll("#fAng input,#fAng select").forEach(i => i.addEventListener("input", calcAng));
    el.querySelectorAll("#schSec .seg button").forEach(b => b.onclick = () => { ST.view = b.dataset.v; el.querySelectorAll("#schSec .seg button").forEach(x => x.setAttribute("aria-selected", x === b)); drawSch(); });
    $("#schCsv", el).onclick = () => {
      if (!last) { window.App.toast("Hitung angsuran dulu."); return; }
      const L = [["Bulan ke", "Jatuh tempo", "Angsuran", "Pokok", "Bunga", "Sisa pokok"], ...last.S.rows.map(r => [r.k, r.tgl.toISOString().slice(0, 10), Math.round(r.angs), Math.round(r.pokok), Math.round(r.bunga), Math.round(r.sisa)])];
      window.App.download("simulasi-angsuran.csv", "﻿" + L.map(r => r.join(";")).join("\n"), "text/csv");
    };
    $("#schPrint", el).onclick = () => { if (!last) { window.App.toast("Hitung angsuran dulu."); return; } document.body.classList.add("printing-sch"); window.print(); setTimeout(() => document.body.classList.remove("printing-sch"), 500); };
    calcMax(); calcAng();
  }
  window.Tools = { render, annuity, flat, pvAnnuity, pvFlat, schedule, money };
})();
