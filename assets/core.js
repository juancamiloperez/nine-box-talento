// ===== Configuración del backend =====
const NB_API = "https://zmgitsmngdjpacvrxfkx.supabase.co/functions/v1/ninebox-api";
const NB_KEY = "sb_publishable_KAx-Q9YdVDBOM99ahIt-gg_lE13czGu"; // clave pública (publishable), segura para el navegador

async function api(accion, body = {}) {
  let r;
  try {
    r = await fetch(NB_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: NB_KEY },
      body: JSON.stringify({ accion, ...body }),
    });
  } catch (e) {
    return { ok: false, error: "No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.", status: 0 };
  }
  let j = {};
  try { j = await r.json(); } catch { j = { ok: false, error: "Respuesta inválida del servidor." }; }
  j.status = r.status;
  return j;
}

const store = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch {} },
  del(k) { try { sessionStorage.removeItem(k); } catch {} },
};

// ===== Modelo Nine Box =====
const PERF = ["Cumplimiento de metas", "Calidad del trabajo", "Productividad / oportunidad", "Colaboración y trabajo en equipo"];
const POT = ["Agilidad de aprendizaje", "Capacidad de liderazgo", "Motivación y aspiración", "Adaptabilidad al cambio"];
const PERF_HELP = ["¿Logra los objetivos acordados?", "¿Entrega con precisión y sin reprocesos?", "¿Cumple tiempos con buen uso de recursos?", "¿Aporta y facilita el trabajo de otros?"];
const POT_HELP = ["¿Aprende rápido de situaciones nuevas?", "¿Influye, orienta y moviliza a otros?", "¿Quiere crecer y asumir más responsabilidad?", "¿Se ajusta bien a cambios e incertidumbre?"];
const LEVELS = ["Bajo", "Medio", "Alto"];

const BOXES = {
  "2-2": { n: 9, t: "Estrella", alt: "Futuro líder", tone: "g", h: "Acelerar y retener",
    desc: "Alto desempeño y alto potencial. Hoy entrega resultados sobresalientes y muestra capacidad para roles de mayor alcance.",
    st: ["Diseñar un plan de carrera y sucesión explícito (próximo rol en 12–24 meses).", "Asignar retos estratégicos y proyectos transversales visibles.", "Mentoría con líderes senior y exposición a la alta dirección.", "Plan de retención: reconocimiento, compensación competitiva y conversación de expectativas.", "Cuidar la sobrecarga: no convertirla en la solución a todo."] },
  "1-2": { n: 8, t: "Talento emergente", alt: "Estrella en crecimiento", tone: "g", h: "Desarrollar",
    desc: "Desempeño adecuado con alto potencial. Tiene capacidad para crecer, pero aún no la convierte plenamente en resultados.",
    st: ["Identificar qué frena el desempeño (claridad del rol, recursos, experiencia).", "Coaching enfocado en convertir el potencial en resultados medibles.", "Retos de desarrollo progresivos con metas de corto plazo.", "Retroalimentación frecuente y seguimiento cercano del líder."] },
  "0-2": { n: 7, t: "Enigma", alt: "Diamante en bruto", tone: "a", h: "Diagnosticar y reorientar",
    desc: "Bajo desempeño pero alto potencial. Puede estar en el rol equivocado, ser nuevo o enfrentar barreras que impiden ver su capacidad.",
    st: ["Conversación individual para diagnosticar causas (encaje con el rol, motivación, contexto).", "Considerar reubicación a un rol que aproveche sus fortalezas.", "Plan de mejora con metas claras y apoyo de un mentor.", "Definir un plazo de revisión: si no mejora, reevaluar el potencial asignado."] },
  "2-1": { n: 6, t: "Alto desempeño", alt: "Profesional destacado", tone: "g", h: "Reconocer y ampliar",
    desc: "Desempeño sobresaliente con potencial moderado. Domina su rol y entrega resultados consistentes.",
    st: ["Reconocer y recompensar los resultados.", "Ampliar el alcance del rol (enriquecimiento horizontal) antes que ascender verticalmente.", "Usarle como referente o formador de otros en su especialidad.", "Explorar si el potencial está subestimado (¿le interesa crecer? ¿ha tenido oportunidad?)."] },
  "1-1": { n: 5, t: "Profesional clave", alt: "Core player", tone: "a", h: "Mantener y estimular",
    desc: "Desempeño y potencial medios. Es el núcleo estable del equipo: cumple lo esperado y sostiene la operación.",
    st: ["Mantener la motivación con objetivos claros y reconocimiento.", "Capacitación para fortalecer competencias técnicas del rol.", "Identificar una fortaleza concreta para desarrollarla.", "Revisar periódicamente: puede moverse hacia arriba con el estímulo adecuado."] },
  "0-1": { n: 4, t: "Dilema", alt: "Inconsistente", tone: "r", h: "Mejorar con plazo",
    desc: "Bajo desempeño con potencial moderado. No está alcanzando lo esperado, aunque podría mejorar.",
    st: ["Plan de mejora del desempeño con metas y plazos definidos.", "Aclarar expectativas del rol y revisar si tiene los recursos necesarios.", "Acompañamiento cercano y retroalimentación frecuente.", "Evaluar si hay un problema de encaje con el rol o el equipo."] },
  "2-0": { n: 3, t: "Profesional confiable", alt: "Experto / pilar", tone: "a", h: "Valorar y aprovechar",
    desc: "Alto desempeño con bajo potencial. Experto en su rol actual, sin interés o capacidad evidente para crecer verticalmente.",
    st: ["Reconocer su aporte y valorar su experiencia.", "Asignarle la transferencia de conocimiento (formar a otros, documentar procesos).", "Mantenerle motivado con retos dentro de su especialidad.", "Evitar promoverle a roles de liderazgo que no desea o no encajan."] },
  "1-0": { n: 2, t: "Profesional efectivo", alt: "Trabajador eficaz", tone: "a", h: "Sostener",
    desc: "Desempeño medio con bajo potencial. Cumple con lo básico del rol, con poco margen de crecimiento visible.",
    st: ["Definir metas claras y medibles en el rol actual.", "Capacitación puntual en las brechas técnicas detectadas.", "Reconocer la constancia y el cumplimiento.", "Monitorear para evitar que descienda a bajo desempeño."] },
  "0-0": { n: 1, t: "Bajo rendimiento", alt: "Riesgo", tone: "r", h: "Actuar de inmediato",
    desc: "Bajo desempeño y bajo potencial. Requiere atención inmediata del líder.",
    st: ["Conversación directa sobre la brecha entre lo esperado y lo logrado.", "Plan de mejora formal, corto y con seguimiento documentado.", "Revisar si hay causas externas (carga, salud, conflictos, falta de formación).", "Si no hay mejora en el plazo acordado: reubicación o desvinculación, según la política de la organización."] },
};

const defaultModel = () => ({ members: [], wPerf: [1, 1, 1, 1], wPot: [1, 1, 1, 1], cut1: 2.5, cut2: 3.75, baseline: null });
function normModel(d) {
  const m = Object.assign(defaultModel(), d && typeof d === "object" ? d : {});
  if (!Array.isArray(m.members)) m.members = [];
  return m;
}
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => Math.random().toString(36).slice(2, 9);
function wavg(v, w) { const sw = w.reduce((a, b) => a + +b, 0) || 1; return v.reduce((a, x, i) => a + x * w[i], 0) / sw; }
function lvl(M, x) { return x < M.cut1 ? 0 : x >= M.cut2 ? 2 : 1; }
function calc(M, m) { const p = wavg(m.perf, M.wPerf), q = wavg(m.pot, M.wPot); const k = lvl(M, p) + "-" + lvl(M, q); return { p, q, k, box: BOXES[k] }; }

function moveArrow(M, m, k) {
  if (!M.baseline || !(m.id in M.baseline)) return "";
  const b = M.baseline[m.id]; if (b === k || !BOXES[b]) return "";
  const [bp, bq] = b.split("-").map(Number), [kp, kq] = k.split("-").map(Number);
  const s = kp + kq - (bp + bq);
  return `<span class="mv" title="Antes: caja ${BOXES[b].n}">${s > 0 ? "▲" : s < 0 ? "▼" : "↔"}${BOXES[b].n}</span>`;
}

// Dibuja la matriz 3x3. opts: {selBox, selected, onBox(k), onMember(id)}
function drawGrid(el, M, opts = {}) {
  let h = "";
  for (let q = 2; q >= 0; q--) for (let p = 0; p <= 2; p++) {
    const k = p + "-" + q, b = BOXES[k];
    const ms = M.members.filter((m) => calc(M, m).k === k);
    h += `<div class="cell tone-${b.tone} ${opts.selBox === k ? "sel" : ""}" data-k="${k}">
      <div class="hd"><span class="tt">${b.t}</span><span class="no">${b.n}</span></div>
      <div class="lv">Desempeño ${LEVELS[p].toLowerCase()} · Potencial ${LEVELS[q].toLowerCase()}</div>
      <div class="chips">${ms.map((m) => `<span class="chip ${m.id === opts.selected ? "sel" : ""}" data-id="${m.id}">${esc(m.name)}${moveArrow(M, m, k)}</span>`).join("")}</div>
    </div>`;
  }
  el.innerHTML = h;
  el.querySelectorAll(".cell").forEach((c) => (c.onclick = () => opts.onBox && opts.onBox(c.dataset.k)));
  el.querySelectorAll(".chip").forEach((c) => (c.onclick = (e) => { e.stopPropagation(); opts.onMember && opts.onMember(c.dataset.id); }));
}

function boxDetailHTML(M, k) {
  const b = BOXES[k], [p, q] = k.split("-").map(Number);
  const ms = M.members.filter((m) => calc(M, m).k === k);
  return `<h2>Caja ${b.n}: ${b.t} <span class="note" style="font-weight:400">(${b.alt})</span></h2>
   <span class="pill">Desempeño ${LEVELS[p]}</span><span class="pill">Potencial ${LEVELS[q]}</span><span class="badge b-${b.tone}">${b.h}</span>
   <p>${b.desc}</p>
   <h3>Estrategias recomendadas</h3><ul>${b.st.map((s) => `<li>${s}</li>`).join("")}</ul>
   <h3>Integrantes en esta caja</h3>
   ${ms.length ? `<ul>${ms.map((m) => `<li><b>${esc(m.name)}</b>${m.role ? " – " + esc(m.role) : ""}${m.hyp ? `<br><span class="note">Hipótesis: ${esc(m.hyp)}</span>` : ""}</li>`).join("")}</ul>` : '<div class="empty">Nadie está ubicado aquí con las calificaciones actuales.</div>'}`;
}

function summaryHTML(M) {
  const n = M.members.length, cs = M.members.map((m) => ({ m, c: calc(M, m) }));
  const cnt = (t) => cs.filter((x) => x.c.box.tone === t).length;
  const pct = (x) => (n ? Math.round((100 * x) / n) + "%" : "–");
  const avgP = n ? (cs.reduce((a, x) => a + x.c.p, 0) / n).toFixed(2) : "–", avgQ = n ? (cs.reduce((a, x) => a + x.c.q, 0) / n).toFixed(2) : "–";
  const kpis = `<div class="kpis">
   <div class="kpi"><small>Integrantes</small><strong>${n}</strong></div>
   <div class="kpi"><small>Prom. desempeño</small><strong>${avgP}</strong></div>
   <div class="kpi"><small>Prom. potencial</small><strong>${avgQ}</strong></div>
   <div class="kpi"><small>Zona alta (verde)</small><strong style="color:var(--g)">${pct(cnt("g"))}</strong></div>
   <div class="kpi"><small>Zona de atención (rojo)</small><strong style="color:var(--r)">${pct(cnt("r"))}</strong></div></div>`;
  if (!n) return kpis + '<div class="empty">Sin datos todavía.</div>';
  const ins = [];
  if (cnt("r") / n >= 0.4) ins.push("Más del 40% del equipo está en zona de atención: revisen si el escenario supuesto es demasiado exigente o si hay un problema de equipo (no solo individual).");
  if (cnt("g") / n >= 0.6) ins.push("Más del 60% está en zona alta: ¿hay indulgencia en las calificaciones? Intenten calibrar con evidencia concreta.");
  const flat = cs.filter((x) => x.m.perf.concat(x.m.pot).every((v) => v === 3)).length;
  if (flat) ins.push(`${flat} integrante(s) tienen todas las calificaciones en 3: posible tendencia central.`);
  return kpis + `<table><thead><tr><th>Integrante</th><th>Desemp.</th><th>Potenc.</th><th>Caja</th></tr></thead><tbody>
   ${cs.sort((a, b) => b.c.box.n - a.c.box.n).map((x) => `<tr><td><b>${esc(x.m.name)}</b>${x.m.role ? `<br><span class="note">${esc(x.m.role)}</span>` : ""}</td><td>${x.c.p.toFixed(2)}</td><td>${x.c.q.toFixed(2)}</td><td><span class="badge b-${x.c.box.tone}">${x.c.box.n} · ${x.c.box.t}</span></td></tr>`).join("")}
   </tbody></table>${ins.length ? `<h3>Alertas de calibración</h3><ul class="note">${ins.map((i) => `<li>${i}</li>`).join("")}</ul>` : ""}`;
}

function movesHTML(M) {
  if (!M.baseline) return "";
  const ch = M.members.filter((m) => m.id in M.baseline).map((m) => ({ m, b: M.baseline[m.id], k: calc(M, m).k })).filter((r) => r.b !== r.k && BOXES[r.b]);
  if (!ch.length) return '<div class="empty">Ningún integrante ha cambiado de caja frente a la línea base.</div>';
  return `<table><thead><tr><th>Integrante</th><th>Antes</th><th>Ahora</th><th>Lectura</th></tr></thead><tbody>
   ${ch.map((r) => { const A = BOXES[r.b], B = BOXES[r.k]; const [bp, bq] = r.b.split("-").map(Number), [kp, kq] = r.k.split("-").map(Number);
     const t = []; if (kp !== bp) t.push(`desempeño ${kp > bp ? "sube" : "baja"}`); if (kq !== bq) t.push(`potencial ${kq > bq ? "sube" : "baja"}`);
     return `<tr><td><b>${esc(r.m.name)}</b></td><td><span class="badge b-${A.tone}">${A.n} · ${A.t}</span></td><td><span class="badge b-${B.tone}">${B.n} · ${B.t}</span></td><td>${t.join(", ")}</td></tr>`; }).join("")}
   </tbody></table>`;
}

function modelTSV(M, prefix = []) {
  return M.members.map((m) => { const c = calc(M, m);
    return [...prefix, m.name, m.role, m.hyp, ...m.perf, ...m.pot, c.p.toFixed(2).replace(".", ","), c.q.toFixed(2).replace(".", ","), c.box.n, c.box.t, c.box.h].map((v) => String(v ?? "").replace(/[\t\n]/g, " ")).join("\t"); });
}
const TSV_HEAD = ["Integrante", "Rol", "Hipótesis", ...PERF, ...POT, "Puntaje desempeño", "Puntaje potencial", "Caja", "Clasificación", "Estrategia principal"];

function toast(t) { let e = document.getElementById("toast"); if (!e) { e = document.createElement("div"); e.id = "toast"; e.className = "toast"; document.body.appendChild(e); }
  e.textContent = t; e.classList.add("on"); clearTimeout(e._t); e._t = setTimeout(() => e.classList.remove("on"), 2800); }

async function copyText(txt, fallbackTextarea) {
  try { await navigator.clipboard.writeText(txt); toast("Copiado: pégalo en Excel o Google Sheets"); return true; }
  catch { if (fallbackTextarea) { fallbackTextarea.value = txt; fallbackTextarea.closest(".modal")?.classList.add("on"); } return false; }
}
function fmtFecha(s) { if (!s) return "–"; try { return new Date(s).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" }); } catch { return s; } }
