# Simulador Matriz Nine Box · Administración del Talento Humano

Simulador web para que los estudiantes evalúen, bajo hipótesis, el desempeño y el potencial de los integrantes de su equipo, y vean su ubicación en la matriz Nine Box con las estrategias recomendadas por cuadrante.

- **Estudiantes:** `index.html` → solicitan acceso (nombre, correo, grupo y equipo). El docente aprueba con un clic desde el correo y la página del estudiante entra automáticamente; luego pueden volver a entrar solo con su correo. Todos los integrantes de un equipo editan la misma matriz (guardado automático).
- **Docente:** `admin.html` → aprueba o rechaza solicitudes, cambia estudiantes de equipo y revisa la matriz, las hipótesis y las calificaciones de cada equipo. Puede copiar todos los resultados para pegarlos en Excel.

## Arquitectura

| Parte | Dónde |
|---|---|
| Páginas estáticas | GitHub Pages (este repositorio) |
| API | Supabase Edge Function `ninebox-api` (`supabase/functions/ninebox-api/index.ts`) |
| Datos | Tablas `nb_equipos`, `nb_estudiantes`, `nb_sesiones` (RLS activado, sin acceso público directo) |
| Correo al docente | Gmail del docente vía Google Apps Script (`gmail-apps-script.gs`) |

## Configuración (una sola vez)

### 1. Aviso por Gmail (sin Resend)
1. Entra a https://script.google.com con tu cuenta de Gmail → **Proyecto nuevo**.
2. Borra lo que aparece y pega el contenido de `gmail-apps-script.gs`. Guarda.
3. Selecciona la función `probar` y pulsa **Ejecutar** → autoriza los permisos → te llega un correo de prueba.
4. **Implementar → Nueva implementación → Aplicación web** · Ejecutar como: **Yo** · Acceso: **Cualquier usuario** → **Implementar** → copia la URL.
5. En Supabase → Edge Functions → Secrets crea `GMAIL_SCRIPT_URL` con esa URL.

### 2. Panel docente
En Supabase → Edge Functions → Secrets crea `ADMIN_PASSWORD` con la contraseña para `admin.html`.

*(Alternativa al paso 1: `RESEND_API_KEY` + `ADMIN_EMAIL` con una cuenta de resend.com.)*

## Notas

- No hay PIN: cualquier persona que conozca el correo de un estudiante aprobado podría entrar como él. Es una decisión consciente para simplificar el uso en clase.
- Si un estudiante se equivocó de correo: elimina su solicitud en el panel y pídele que la haga de nuevo; la matriz del equipo se conserva.
- Las sesiones duran 30 días (estudiantes) y 8 h (docente).
