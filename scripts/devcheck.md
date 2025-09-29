# Verificaciones Manuales MVP Asistencia Geimser

1. **Marca IN/OUT con recibo y hash**
   - Inicia sesión como trabajador demo.
   - Selecciona un sitio válido y marca entrada y salida.
   - En `app/api/attendance/history` verifica que `hash_self` tenga longitud 64 y que `receipt_signed_url` abra un PDF con los datos de la marca.

2. **Corrección de marca**
   - Desde el historial abre "Solicitar corrección" en una marca y envía la justificación.
   - Ingresa al panel admin, pestaña "Correcciones", aprueba la solicitud.
   - Confirma que `attendance_marks` mantiene la marca original y que la fila aparece en `attendance_modifications` con `status=APPROVED`.

3. **Exportes por período**
   - En pestaña "Reportes" genera CSV y PDF para un rango con marcas.
   - Abre los archivos y verifica que las filas coincidan con el historial.

4. **Token DT**
   - En "Acceso DT" genera un enlace de prueba con vigencia corta.
   - Usa el enlace en una ventana privada y confirma que devuelve solo registros dentro del alcance.
   - Repite luego de la expiración para validar que responde `TOKEN_INVALID`.

5. **Geolocalización puntual**
   - Cierra permisos de ubicación, vuelve a la página y observa el guard.
   - Marca asistencia y confirma que solo solicita geolocalización al presionar el botón.

6. **RLS estrictas**
   - Desde el panel trabajador intenta consultar `fetch('/api/attendance/history?personId=...')` con otro `personId`; debe devolver 403.
   - Como admin, realiza la misma consulta y verifica que responde con datos.

