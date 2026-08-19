# Plantillas de correo

Pega cada archivo en **Authentication → Emails** del panel de Supabase, en la
plantilla que le corresponde.

| Archivo | Plantilla de Supabase | Cuándo se envía |
| --- | --- | --- |
| [`email-change.html`](email-change.html) | *Change Email Address* | Al pasar de cuenta anónima a registrada con correo. **Es la que usa Stonksu.** |
| [`confirm-signup.html`](confirm-signup.html) | *Confirm signup* | Al registrarse directamente con correo y contraseña |
| [`reset-password.html`](reset-password.html) | *Reset Password* | Al pedir recuperar la contraseña |
| [`magic-link.html`](magic-link.html) | *Magic Link* | Acceso sin contraseña, si algún día se activa |

## Por qué están escritas así

El correo no es una página web. Gmail, Outlook y Apple Mail eliminan las hojas
de estilo, ignoran flexbox y no cargan tipografías externas, así que:

- **Todo en tablas y estilos en línea.** Es feo, y es lo único que se ve igual
  en todas partes.
- **Nunito no se carga**, por eso la pila de fuentes cae en la del sistema. El
  peso y el interletrado hacen el trabajo que haría la tipografía.
- **`color-scheme: dark`** evita que los clientes inviertan los colores por su
  cuenta y conviertan el fondo carbón en un gris sucio.
- **El botón es una tabla**, no un enlace con relleno, porque Outlook ignora el
  `padding` de un `<a>` y lo dejaría como texto suelto.
- Debajo del botón va **la URL en texto**: algunos clientes corporativos
  desactivan los enlaces, y sin eso el correo sería inservible.

## El logo

Va como texto, no como imagen, a propósito: **la mayoría de clientes bloquean
las imágenes remotas** hasta que el usuario las autoriza, y un correo cuyo
encabezado desaparece hasta que pulsas "mostrar imágenes" da mala espina justo
cuando pides confianza.

Si prefieres el toro, sustituye el bloque del encabezado por:

```html
<img src="https://TU-DOMINIO/apple-touch-icon.png" width="56" height="56"
     alt="Stonksu" style="display:block;border:0;border-radius:14px;">
```

y súbelo a un dominio estable — el de producción en Vercel, no `localhost`.
