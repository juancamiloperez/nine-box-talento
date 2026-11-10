// Nine Box – API para el simulador de la clase de Talento Humano
// Secrets requeridos: RESEND_API_KEY, ADMIN_EMAIL, ADMIN_PASSWORD
// Opcional: APP_URL (URL pública de GitHub Pages, sin barra final)
import { createClient } from "npm:@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND = Deno.env.get("RESEND_API_KEY") ?? "";
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") ?? "";
const ADMIN_PASSWORD = Deno.env.get("ADMIN_PASSWORD") ?? "";
const APP_URL = (Deno.env.get("APP_URL") ?? "https://juancamiloperez.github.io/nine-box-talento").replace(/\/$/, "");

const db = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const fail = (msg: string, status = 400) => json({ ok: false, error: msg }, status);

const enc = new TextEncoder();
async function sha256(s: string) {
  const b = await crypto.subtle.digest("SHA-256", enc.encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
function randomToken(bytes = 32) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((x) => x.toString(16).padStart(2, "0")).join("");
}
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
const clean = (s: unknown, max = 80) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const likeEsc = (s: string) => s.replace(/[\\%_]/g, (c) => "\\" + c);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function nuevaSesion(rol: "estudiante" | "admin", estudiante_id: string | null, horas: number) {
  const token = randomToken();
  await db.from("nb_sesiones").insert({
    token_hash: await sha256(token), rol, estudiante_id,
    expira_at: new Date(Date.now() + horas * 3600_000).toISOString(),
  });
  return token;
}
async function sesion(token: unknown, rol: "estudiante" | "admin") {
  if (typeof token !== "string" || token.length < 20) return null;
  const { data } = await db.from("nb_sesiones").select("*").eq("token_hash", await sha256(token)).maybeSingle();
  if (!data || data.rol !== rol || new Date(data.expira_at) < new Date()) return null;
  return data;
}

async function equipoDe(grupo: string, nombre: string) {
  const { data: found } = await db.from("nb_equipos").select("*").ilike("grupo", likeEsc(grupo)).ilike("nombre", likeEsc(nombre)).maybeSingle();
  if (found) return found;
  const { data, error } = await db.from("nb_equipos").insert({ grupo, nombre }).select().single();
  if (error) {
    const { data: again } = await db.from("nb_equipos").select("*").ilike("grupo", likeEsc(grupo)).ilike("nombre", likeEsc(nombre)).maybeSingle();
    return again;
  }
  return data;
}

async function enviarCorreoAdmin(est: { nombre: string; email: string; grupo: string; equipo_nombre: string; token_aprobacion: string }) {
  if (!RESEND || !ADMIN_EMAIL) return { enviado: false, motivo: "Correo no configurado (RESEND_API_KEY / ADMIN_EMAIL)" };
  const link = `${APP_URL}/admin.html?t=${est.token_aprobacion}`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1d2330">
    <h2 style="margin:0 0 8px">Nueva solicitud de ingreso – Nine Box</h2>
    <table cellpadding="4">
      <tr><td><b>Estudiante</b></td><td>${esc(est.nombre)}</td></tr>
      <tr><td><b>Correo</b></td><td>${esc(est.email)}</td></tr>
      <tr><td><b>Grupo</b></td><td>${esc(est.grupo)}</td></tr>
      <tr><td><b>Equipo</b></td><td>${esc(est.equipo_nombre)}</td></tr>
    </table>
    <p><a href="${link}" style="display:inline-block;background:#2f4b7c;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Revisar y aprobar / rechazar</a></p>
    <p style="color:#5d6577;font-size:12px">También puedes gestionarla desde el panel: ${APP_URL}/admin.html</p></div>`;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Nine Box TH <onboarding@resend.dev>",
        to: [ADMIN_EMAIL],
        subject: `Solicitud Nine Box: ${est.nombre} (${est.grupo} · ${est.equipo_nombre})`,
        html,
      }),
    });
    if (!r.ok) return { enviado: false, motivo: `Resend ${r.status}: ${(await r.text()).slice(0, 200)}` };
    return { enviado: true };
  } catch (e) {
    return { enviado: false, motivo: String(e).slice(0, 200) };
  }
}

async function decidir(est_id: string, d: string) {
  if (d !== "aprobar" && d !== "rechazar") return { error: "Decisión inválida" };
  const { data: est } = await db.from("nb_estudiantes").select("*").eq("id", est_id).maybeSingle();
  if (!est) return { error: "Solicitud no encontrada" };
  const upd: Record<string, unknown> = { estado: d === "aprobar" ? "aprobado" : "rechazado", decidido_at: new Date().toISOString() };
  if (d === "aprobar") {
    const eq = await equipoDe(est.grupo, est.equipo_nombre);
    upd.equipo_id = eq?.id ?? null;
  } else {
    await db.from("nb_sesiones").delete().eq("estudiante_id", est.id);
  }
  await db.from("nb_estudiantes").update(upd).eq("id", est.id);
  return { ok: true, estado: upd.estado };
}

const publicEst = (e: Record<string, unknown>) => ({
  id: e.id, nombre: e.nombre, email: e.email, grupo: e.grupo, equipo_nombre: e.equipo_nombre,
  equipo_id: e.equipo_id, estado: e.estado, created_at: e.created_at, decidido_at: e.decidido_at,
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return fail("Método no permitido", 405);
  let b: Record<string, any>;
  try { b = await req.json(); } catch { return fail("JSON inválido"); }

  try {
    switch (b.accion) {
      // ---------- Público ----------
      case "equipos_publicos": {
        const { data } = await db.from("nb_equipos").select("grupo,nombre").order("grupo").order("nombre");
        return json({ ok: true, equipos: data ?? [] });
      }
      case "solicitar": {
        const nombre = clean(b.nombre, 80), email = clean(b.email, 120).toLowerCase();
        const grupo = clean(b.grupo, 40).toUpperCase(), equipo = clean(b.equipo, 50), pin = String(b.pin ?? "");
        if (nombre.length < 3) return fail("Escribe tu nombre completo.");
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("Correo no válido.");
        if (!grupo) return fail("Indica tu grupo.");
        if (equipo.length < 2) return fail("Indica el nombre de tu equipo.");
        if (!/^\d{4,6}$/.test(pin)) return fail("El PIN debe tener entre 4 y 6 dígitos.");
        const { data: existe } = await db.from("nb_estudiantes").select("estado").eq("email", email).maybeSingle();
        if (existe) return fail(`Ya existe una solicitud con este correo (estado: ${existe.estado}). Si necesitas cambiarla, habla con el docente.`);
        const salt = randomToken(16);
        const row = {
          nombre, email, grupo, equipo_nombre: equipo, pin_salt: salt,
          pin_hash: await sha256(salt + pin), token_aprobacion: randomToken(24),
        };
        const { error } = await db.from("nb_estudiantes").insert(row);
        if (error) return fail("No se pudo registrar la solicitud. Intenta de nuevo.");
        const correo = await enviarCorreoAdmin(row);
        if (!correo.enviado) console.error("Correo no enviado:", correo.motivo);
        return json({ ok: true, correo_enviado: correo.enviado });
      }
      case "login": {
        const email = clean(b.email, 120).toLowerCase(), pin = String(b.pin ?? "");
        const { data: est } = await db.from("nb_estudiantes").select("*").eq("email", email).maybeSingle();
        if (!est) { await sleep(600); return fail("Correo o PIN incorrectos."); }
        if (est.bloqueado_hasta && new Date(est.bloqueado_hasta) > new Date())
          return fail("Demasiados intentos. Espera 15 minutos e intenta de nuevo.");
        const okPin = safeEqual(await sha256(est.pin_salt + pin), est.pin_hash);
        if (!okPin) {
          const n = est.intentos_fallidos + 1;
          await db.from("nb_estudiantes").update({
            intentos_fallidos: n >= 5 ? 0 : n,
            bloqueado_hasta: n >= 5 ? new Date(Date.now() + 15 * 60_000).toISOString() : null,
          }).eq("id", est.id);
          await sleep(600);
          return fail("Correo o PIN incorrectos.");
        }
        await db.from("nb_estudiantes").update({ intentos_fallidos: 0, bloqueado_hasta: null }).eq("id", est.id);
        if (est.estado === "pendiente") return fail("Tu solicitud aún está pendiente de aprobación por el docente.");
        if (est.estado === "rechazado") return fail("Tu solicitud fue rechazada. Consulta con el docente.");
        const token = await nuevaSesion("estudiante", est.id, 12);
        const { data: eq } = await db.from("nb_equipos").select("*").eq("id", est.equipo_id).maybeSingle();
        return json({ ok: true, token, estudiante: publicEst(est), equipo: eq });
      }
      case "cargar": {
        const s = await sesion(b.token, "estudiante");
        if (!s) return fail("Sesión vencida. Ingresa de nuevo.", 401);
        const { data: est } = await db.from("nb_estudiantes").select("*").eq("id", s.estudiante_id).single();
        if (est.estado !== "aprobado") return fail("Acceso no autorizado.", 403);
        const { data: eq } = await db.from("nb_equipos").select("*").eq("id", est.equipo_id).maybeSingle();
        return json({ ok: true, estudiante: publicEst(est), equipo: eq });
      }
      case "guardar": {
        const s = await sesion(b.token, "estudiante");
        if (!s) return fail("Sesión vencida. Ingresa de nuevo.", 401);
        const { data: est } = await db.from("nb_estudiantes").select("*").eq("id", s.estudiante_id).single();
        if (est.estado !== "aprobado" || !est.equipo_id) return fail("Acceso no autorizado.", 403);
        const payload = JSON.stringify(b.data ?? {});
        if (payload.length > 200_000) return fail("Los datos superan el tamaño permitido.");
        const version = Number(b.version);
        const { data: upd } = await db.from("nb_equipos")
          .update({ data: b.data, version: version + 1, updated_at: new Date().toISOString(), updated_by: est.nombre })
          .eq("id", est.equipo_id).eq("version", version).select().maybeSingle();
        if (!upd) {
          const { data: eq } = await db.from("nb_equipos").select("*").eq("id", est.equipo_id).single();
          return json({ ok: false, conflicto: true, equipo: eq, error: "Otro integrante guardó cambios antes." }, 409);
        }
        return json({ ok: true, version: upd.version, updated_at: upd.updated_at });
      }
      case "logout": {
        if (typeof b.token === "string") await db.from("nb_sesiones").delete().eq("token_hash", await sha256(b.token));
        return json({ ok: true });
      }

      // ---------- Decisión desde el enlace del correo ----------
      case "token_info": {
        const t = String(b.t ?? "");
        if (t.length < 20) return fail("Enlace inválido.");
        const { data: est } = await db.from("nb_estudiantes").select("*").eq("token_aprobacion", t).maybeSingle();
        if (!est) return fail("Enlace inválido o solicitud eliminada.", 404);
        return json({ ok: true, estudiante: publicEst(est) });
      }
      case "decidir_token": {
        const t = String(b.t ?? "");
        const { data: est } = await db.from("nb_estudiantes").select("id").eq("token_aprobacion", t).maybeSingle();
        if (!est || t.length < 20) return fail("Enlace inválido.", 404);
        const r = await decidir(est.id, String(b.d));
        return r.error ? fail(r.error) : json(r);
      }

      // ---------- Administrador ----------
      case "admin_login": {
        if (!ADMIN_PASSWORD) return fail("Falta configurar ADMIN_PASSWORD en Supabase.", 500);
        if (!safeEqual(String(b.password ?? ""), ADMIN_PASSWORD)) { await sleep(1200); return fail("Contraseña incorrecta.", 401); }
        return json({ ok: true, token: await nuevaSesion("admin", null, 8) });
      }
      case "admin_datos": {
        if (!(await sesion(b.token, "admin"))) return fail("Sesión de administrador vencida.", 401);
        const [{ data: ests }, { data: eqs }] = await Promise.all([
          db.from("nb_estudiantes").select("*").order("created_at", { ascending: false }),
          db.from("nb_equipos").select("*").order("grupo").order("nombre"),
        ]);
        return json({ ok: true, estudiantes: (ests ?? []).map(publicEst), equipos: eqs ?? [] });
      }
      case "admin_decidir": {
        if (!(await sesion(b.token, "admin"))) return fail("Sesión de administrador vencida.", 401);
        const r = await decidir(String(b.id), String(b.d));
        return r.error ? fail(r.error) : json(r);
      }
      case "admin_mover": {
        if (!(await sesion(b.token, "admin"))) return fail("Sesión de administrador vencida.", 401);
        const grupo = clean(b.grupo, 40).toUpperCase(), equipo = clean(b.equipo, 50);
        if (!grupo || equipo.length < 2) return fail("Grupo y equipo son obligatorios.");
        const { data: est } = await db.from("nb_estudiantes").select("*").eq("id", String(b.id)).maybeSingle();
        if (!est) return fail("Estudiante no encontrado.");
        const upd: Record<string, unknown> = { grupo, equipo_nombre: equipo };
        if (est.estado === "aprobado") upd.equipo_id = (await equipoDe(grupo, equipo))?.id ?? null;
        await db.from("nb_estudiantes").update(upd).eq("id", est.id);
        return json({ ok: true });
      }
      case "admin_eliminar": {
        if (!(await sesion(b.token, "admin"))) return fail("Sesión de administrador vencida.", 401);
        await db.from("nb_estudiantes").delete().eq("id", String(b.id));
        return json({ ok: true });
      }
      case "admin_eliminar_equipo": {
        if (!(await sesion(b.token, "admin"))) return fail("Sesión de administrador vencida.", 401);
        await db.from("nb_estudiantes").update({ equipo_id: null }).eq("equipo_id", String(b.id));
        await db.from("nb_equipos").delete().eq("id", String(b.id));
        return json({ ok: true });
      }
      case "admin_estado_correo": {
        if (!(await sesion(b.token, "admin"))) return fail("Sesión de administrador vencida.", 401);
        return json({ ok: true, resend: !!RESEND, admin_email: !!ADMIN_EMAIL, app_url: APP_URL });
      }
      default:
        return fail("Acción desconocida.");
    }
  } catch (e) {
    console.error(e);
    return fail("Error interno del servidor.", 500);
  }
});
