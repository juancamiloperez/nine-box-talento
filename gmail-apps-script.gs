/**
 * Nine Box – Aviso por Gmail de nuevas solicitudes de ingreso.
 * Envía el correo a la misma cuenta de Gmail dueña de este script.
 *
 * Instalación: script.google.com → Proyecto nuevo → pegar este código → Guardar
 * → Implementar → Nueva implementación → Tipo: Aplicación web
 *   · Ejecutar como: Yo
 *   · Quién tiene acceso: Cualquier usuario
 * → Implementar → Autorizar acceso → copiar la URL de la aplicación web.
 */
function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    if (d.app !== 'ninebox' || !d.subject || !d.html) {
      return ContentService.createTextOutput('rechazado');
    }
    MailApp.sendEmail({
      to: Session.getEffectiveUser().getEmail(),
      subject: String(d.subject).slice(0, 200),
      htmlBody: String(d.html).slice(0, 20000),
      name: 'Nine Box TH'
    });
    return ContentService.createTextOutput('ok');
  } catch (err) {
    return ContentService.createTextOutput('error: ' + err);
  }
}

/** Ejecuta esta función una vez desde el editor para autorizar el envío y recibir un correo de prueba. */
function probar() {
  MailApp.sendEmail(Session.getEffectiveUser().getEmail(), 'Prueba Nine Box', 'Si ves este correo, el aviso de solicitudes ya funciona.');
}
