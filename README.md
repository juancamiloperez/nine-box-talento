# Simulador Matriz Nine Box · Administración del Talento Humano

Simulador web para que los estudiantes evalúen, bajo hipótesis, el desempeño y el potencial de los integrantes de su equipo, y vean su ubicación en la matriz Nine Box con las estrategias recomendadas por cuadrante.

- **Estudiantes:** `index.html` → solicitan acceso (nombre, correo, grupo, equipo y PIN). Cuando el docente aprueba, ingresan con correo + PIN. Todos los integrantes de un equipo editan la misma matriz (guardado automático).
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

- Si un estudiante olvida el PIN: elimina su solicitud en el panel y pídele que la haga de nuevo; la matriz del equipo se conserva.
- 5 intentos fallidos de PIN bloquean el ingreso 15 minutos.
- Los PIN se guardan con hash y sal; las sesiones duran 12 h (estudiantes) y 8 h (docente).
