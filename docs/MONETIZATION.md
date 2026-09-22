# Pagos y anuncios

## Checkout web de Stripe

La web ya contiene el recorrido de [Stripe Checkout para suscripciones](https://docs.stripe.com/payments/checkout/quickstarts), un portal para gestionar la suscripción y un webhook que valida la firma antes de cambiar el plan. El botón solo abre Stripe cuando `VITE_BILLING_ENABLED=true`, hay sesión de Supabase registrada y las funciones están desplegadas. Stripe muestra los métodos compatibles con el navegador y el dispositivo; la app no recoge tarjetas. En Android/iOS nativos sigue pendiente integrar las compras de sus tiendas.

### Activar primero en `dev` sin dinero real

1. En una cuenta Stripe, activa el **modo de prueba** y crea dos precios recurrentes mensuales en EUR: Premium **2,99 €** y Ultra **6,99 €**. Copia sus IDs `price_...`. Los importes, moneda y periodicidad se verifican en el servidor antes de crear cada Checkout Session.
2. La migración `20260922125730_billing.sql` del repositorio `database` ya se aplicó a Supabase `dev` el 2026-09-22. Impide que el cliente cambie `profiles.plan`, crea las tablas de facturación y devuelve a Gratis los planes de simulación sin suscripción verificada. La copia `supabase/migrations/0017_billing.sql` de este repositorio sirve para el check local; no la apliques otra vez a `dev`.
3. Configura estos secretos **solo en Supabase Edge Functions**: `APP_URL=https://dev-stonksu.vercel.app`, `APP_ENV=dev`, `STRIPE_MODE=test`, `STRIPE_SECRET_KEY=sk_test_...`, `STRIPE_PRICE_PREMIUM=price_...`, `STRIPE_PRICE_ULTRA=price_...`, `STRIPE_WEBHOOK_SECRET=whsec_...`. No uses variables `VITE_*` para claves secretas. Por ahora las funciones rechazan cualquier clave `sk_live_` y no aceptan `APP_ENV=production`.
4. El repositorio `database` ya contiene `create-checkout`, `billing-portal` y `stripe-webhook`. Para que su workflow los despliegue, añade `SUPABASE_ACCESS_TOKEN` como secret del GitHub Environment `dev` y vuelve a ejecutar «Desplegar funciones de pagos». La variable `SUPABASE_PROJECT_REF` de `dev` ya está configurada. `supabase/config.toml` desactiva la validación JWT de la plataforma; las dos funciones de usuario verifican el token con Supabase y el webhook verifica la firma de Stripe. URL del webhook: `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`. Suscribe los eventos `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated` y `customer.subscription.deleted`.
5. En Stripe, activa el [portal de clientes](https://docs.stripe.com/customer-management) y permite cancelar suscripciones. En Vercel, configura `VITE_BILLING_ENABLED=true` **solo para el despliegue de `dev`**, y vuelve a desplegar. El flujo anterior de simulación queda como alternativa cuando esa variable vale `false`.
6. Registra una cuenta en Stonksu, pulsa «Elegir Ultra» y completa Checkout con una [tarjeta de prueba de Stripe](https://docs.stripe.com/testing), por ejemplo `4242 4242 4242 4242`, fecha futura y cualquier CVC válido. Comprueba que el webhook cambie `profiles.plan` a `ultra`, que la web lo refleje al volver y que «Gestionar» abra el portal. Cancela en el portal y comprueba la fecha de fin y el plan tras vencer la suscripción. Prueba también un pago rechazado y verifica que no activa Ultra.

No hay credenciales Stripe en el repositorio. El workflow de funciones falló por faltar `SUPABASE_ACCESS_TOKEN`; las funciones siguen respondiendo 404 en `dev`. Hasta que la configuración externa esté completa, **no existe un checkout utilizable ni se puede afirmar que el cobro de prueba funciona en el proyecto desplegado**. `npm run check`, lint y build no contactan Stripe ni Supabase.

La compra en la web requiere una cuenta registrada para que el acceso no se pierda al borrar datos locales. El webhook es la única vía que concede el plan; el cliente ya no envía `plan` en la sincronización. Una cancelación al final del periodo conserva el acceso hasta que Stripe informa de su finalización. Los precios mostrados son los del código: antes de aceptar cargos reales habrá que habilitar el modo real de forma deliberada y revisar impuestos, textos legales, descuentos y configuración del portal.

## Android e iOS

La web de Stripe se desactiva en la app nativa. Para las funciones digitales dentro de las apps distribuidas por Google Play o App Store, hay que integrar sus compras nativas y verificar recibos en el servidor antes de ofrecer suscripciones allí, de acuerdo con las [reglas de Google Play](https://support.google.com/googleplay/android-developer/answer/9858738) y las [de Apple](https://developer.apple.com/app-store/review/guidelines/). Sus entornos sandbox también permiten pruebas sin cargos reales.

## Anuncios

Los `AdSlot` de Home y Guía muestran un anuncio de prueba en `dev` y `test`, sin llamar a una red publicitaria. En producción la promoción interna se identifica como tal. Para anuncios reales falta integrar SDK, consentimiento y unidades de prueba nativas; [AdMob proporciona IDs de demostración](https://developers.google.com/admob/android/test-ads).
