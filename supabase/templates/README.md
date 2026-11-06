# Correos de Supabase Auth (tienda web)

Plantillas en español con la marca Valkar para los clientes de la tienda. Los correos del personal del ERP
no se envían (usuarios `@staff.valkar.local` creados por la Edge Function con el correo ya confirmado).

| Plantilla | Asunto sugerido | Archivo |
|---|---|---|
| Confirm signup | Confirma tu cuenta en Valkar | `confirmation.html` |
| Reset password | Crea una contraseña nueva para Valkar | `recovery.html` |

## Cómo aplicarlas
1. Supabase > **Authentication > Email Templates**: pega cada archivo en su plantilla y pon el asunto.
2. **Authentication > URL Configuration**:
   - *Site URL*: la dirección de la tienda (ej. `https://tienda.valkar.com.ve`).
   - *Redirect URLs*: agrega `https://tienda.valkar.com.ve/cuenta` y `https://tienda.valkar.com.ve/recuperar`
     (y `http://localhost:5173/**` para probar en local). La tienda los usa en `signUp` y `resetPasswordForEmail`.
3. Para producción configura un SMTP propio (Authentication > SMTP Settings, por ejemplo Resend o el correo del
   dominio): el SMTP de prueba de Supabase solo envía pocos correos por hora.

Con la CLI (`supabase/config.toml`) el equivalente es:

```toml
[auth.email.template.confirmation]
subject = "Confirma tu cuenta en Valkar"
content_path = "./supabase/templates/confirmation.html"

[auth.email.template.recovery]
subject = "Crea una contraseña nueva para Valkar"
content_path = "./supabase/templates/recovery.html"
```

Variables usadas: `{{ .ConfirmationURL }}` y `{{ .Email }}`.
