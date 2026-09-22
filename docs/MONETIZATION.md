# Pagos y anuncios: primera prueba

## Estado actual

En `dev` y `test`, una cuenta creada con el apodo `test` puede entrar en Planes, elegir Premium o Ultra, escoger **tarjeta** o **Apple Pay / Google Pay** según dispositivo y pulsar **Simular pago sin cargo**. No se solicitan datos bancarios ni se abre una cartera. La simulación cambia el plan mediante el mecanismo de prueba existente; no crea una suscripción ni un recibo. El botón de cancelar vuelve al plan gratuito solo para esa cuenta de prueba.

Los espacios de Home y Guía muestran un anuncio de prueba en `dev` y `test`, solo para el plan Gratis. No se llama a una red publicitaria y no se generan impresiones. En producción se mantiene la promoción interna, identificada como tal.

## Camino a compras reales

- Web: integrar un proveedor de checkout alojado en su entorno de pruebas (por ejemplo, Stripe Checkout) para tarjeta y carteras compatibles. La disponibilidad de Apple Pay y Google Pay la determina el proveedor y el dispositivo. No capturar números de tarjeta en React ni guardar secretos en `VITE_*`.
- Android distribuido por Play e iOS distribuido por App Store: implementar las compras de suscripción de sus tiendas y probarlas con cuentas sandbox. Las reglas actuales de [Google Play](https://support.google.com/googleplay/android-developer/answer/9858738) y [Apple](https://developer.apple.com/app-store/review/guidelines/) exigen compras integradas para estas funciones digitales, salvo programas o excepciones aplicables. La elección final de medios de pago la presenta la tienda.
- Backend: crear productos Premium y Ultra, verificar eventos o recibos en servidor, guardar origen, identificador, estado y vencimiento, y derivar `profiles.plan` de esa verificación. Hoy el cliente puede escribir el plan en Supabase y por tanto no sirve como prueba de una compra. Antes de cobrar, impedir que la sincronización ordinaria escriba `plan` y `plan_started_at`, y hacer que solo el proceso de facturación los actualice.
- Anuncios reales: integrar el SDK nativo con identificadores de unidades de prueba en builds de desarrollo y comprobar dispositivos Android e iOS. [AdMob ofrece unidades de demostración](https://developers.google.com/admob/android/test-ads) que no generan tráfico facturable. Definir consentimiento y publicación antes de activar unidades reales.

La [sandbox de Stripe](https://docs.stripe.com/testing) permite simular tarjetas sin mover dinero cuando se configure el checkout web. Esta primera prueba de interfaz no usa aún esa sandbox.
