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
| Correo al docente | Resend (`onboarding@resend.dev`) |

## Configuración (una sola vez)

En Supabase → **Edge Functions → Secrets**, crear:

| Secreto | Valor |
|---|---|
| `RESEND_API_KEY` | API key de tu cuenta en resend.com |
| `ADMIN_EMAIL` | El mismo correo con el que creaste la cuenta de Resend (sin dominio propio, Resend solo envía a ese correo) |
| `ADMIN_PASSWORD` | Contraseña para entrar a `admin.html` |
| `APP_URL` *(opcional)* | URL de GitHub Pages si cambia el nombre del repositorio |

## Notas

- No hay PIN: cualquier persona que conozca el correo de un estudiante aprobado podría entrar como él. Es una decisión consciente para simplificar el uso en clase.
- Si un estudiante se equivocó de correo: elimina su solicitud en el panel y pídele que la haga de nuevo; la matriz del equipo se conserva.
- Las sesiones duran 30 días (estudiantes) y 8 h (docente).
