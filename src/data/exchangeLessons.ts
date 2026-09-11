import type { IntroGame, QuizQuestion, SkillNode } from '../types';

// Generic practice: labels and available features differ between exchanges.
// Editorial references are recorded in docs/PROJECT_MEMORY.md.
function question(id: string, prompt: string, options: [string, string, string], correct: number, explanation: string): QuizQuestion {
  return { id, type: 'mcq', prompt, options: options.map((label, i) => ({ id: String(i), label })), correctOptionId: String(correct), explanation };
}

function sequence(instructions: string, labels: [string, string, string, string]): IntroGame {
  return { type: 'sequence', instructions, steps: labels.map((label, i) => ({ id: `step-${i}`, label, order: i + 1 })) };
}

export const EXCHANGE_NODES: SkillNode[] = [
  {
    id: 'exchange-inicio', title: 'Conoce tu exchange', icon: 'wallet',
    description: 'Encuentra cada pantalla y protege tu cuenta antes de empezar.',
    requires: ['fundamentales'], position: { x: 50, y: 8 }, difficulty: 'easy',
    section: { number: 5, title: 'Tu primer exchange' },
    unit: { number: 1, title: 'Ubícate y protege tu cuenta' },
    intro: {
      flashcards: [
        { id: 'ex-exchange', term: 'Exchange', definition: 'Plataforma para intercambiar activos, como criptomonedas. Aquí aprenderás con ejemplos, sin enviar dinero.' },
        { id: 'ex-mercados', term: 'Mercados', definition: 'Pantalla donde buscas qué comprar o vender. Un par como BTC/EUR expresa el precio de bitcoin en euros.' },
        { id: 'ex-cartera', term: 'Cartera', definition: 'Resumen de tus activos y saldos. También puede llamarse Activos o Billetera.' },
        { id: 'ex-2fa', term: 'Doble factor (2FA)', definition: 'Una segunda comprobación al entrar o retirar. Nunca compartas sus códigos con otra persona.' },
        { id: 'ex-kyc', term: 'Verificación de identidad', definition: 'Comprobación de documentos que puede pedir la plataforma. Hazla solo desde su app o web oficial.' },
        { id: 'ex-phishing', term: 'Phishing', definition: 'Mensaje o web que se hace pasar por un servicio para robar tus datos. Comprueba el dominio antes de entrar.' },
      ],
      explanations: [
        'Imagina tres puertas: Mercados para buscar un par, Operar para preparar una compra y Cartera para consultar lo que tienes. En BTC/EUR, BTC es el activo y EUR la moneda en la que ves su precio. Los nombres cambian según el exchange; aquí practicamos el recorrido sin usar dinero real.',
        'Antes de operar, entra desde la app o web oficial, usa una contraseña única y activa el doble factor. Si la plataforma solicita verificar tu identidad, hazlo dentro de ese canal. Un mensaje que pide tu contraseña o tus códigos puede ser phishing, aunque tenga el logo correcto.',
      ],
      games: [
        sequence('Ordena el recorrido para consultar bitcoin sin comprar.', ['Abre la pantalla Mercados', 'Busca el par BTC/EUR', 'Abre la ficha de ese par', 'Lee el precio de BTC expresado en euros']),
        sequence('Prepara el doble factor desde tu cuenta.', ['Entra desde la app o web oficial', 'Abre los ajustes de Seguridad', 'Configura el doble factor disponible', 'Guarda los códigos de recuperación a salvo']),
      ],
    },
    lessons: [{ id: 'exchange-inicio-1', title: 'Tu primera visita', icon: 'wallet', questions: [
      question('ex-i1', 'Acabas de entrar. ¿Dónde buscarías BTC/EUR?', ['En Mercados', 'En el historial de retiradas', 'En Seguridad'], 0, 'Mercados sirve para localizar pares. Buscar y mirar un precio no envía una orden.'),
      question('ex-i2', 'BTC/EUR muestra 50.000. ¿Qué significa?', ['Tienes 50.000 BTC', 'Un BTC cuesta 50.000 euros', 'Comprar cuesta 50.000 euros de comisión'], 1, 'Es un precio por unidad: 1 BTC equivale a 50.000 EUR en este ejemplo. No necesitas comprar una unidad entera.'),
      question('ex-i3', 'Quieres consultar cuántos activos tienes. ¿Qué abres?', ['Seguridad', 'Notificaciones', 'Cartera o Activos'], 2, 'La cartera reúne tus saldos. El formulario de compra sirve para preparar una operación.'),
      question('ex-i4', 'Estás leyendo el gráfico. ¿Ya has comprado?', ['No, mirar el gráfico no compra nada', 'Sí, al abrir el par', 'Sí, si la vela es verde'], 0, 'Consultar un mercado y enviar una orden son acciones distintas. Siempre revisa el resumen antes de confirmar.'),
      question('ex-i5', 'Un supuesto soporte te pide el código 2FA por chat. ¿Qué haces?', ['Se lo envío si tiene el logo', 'No lo comparto y consulto el soporte oficial', 'Le envío también mi contraseña'], 1, 'Los códigos son para que tú autorices acciones en el servicio oficial, no para enviarlos a otras personas.'),
      question('ex-i6', '¿Dónde completarías una verificación de identidad?', ['En un enlace de un desconocido', 'En un grupo público', 'Dentro de la app o web oficial'], 2, 'Comprueba el canal antes de aportar documentos. Los requisitos dependen de la plataforma y de tu región.'),
      question('ex-i7', '¿Qué añade protección a tu acceso?', ['Una contraseña única y doble factor', 'La misma contraseña en todas partes', 'Publicar los códigos de recuperación'], 0, 'Una contraseña única evita reutilizar una que se haya filtrado en otro servicio. El doble factor añade otra comprobación.'),
      question('ex-i8', 'Un mensaje promete un premio si entras en una web casi idéntica. ¿Qué revisas?', ['Solo el color del logo', 'El dominio y el acceso oficial', 'Cuántos emojis incluye'], 1, 'Las páginas falsas pueden copiar el diseño. Abre el servicio por su canal oficial antes de actuar.'),
    ] }],
  },
  {
    id: 'exchange-operar', title: 'Tu primera orden', icon: 'clipboard',
    description: 'Lee el formulario, revisa los costes y distingue una orden de una compra.',
    requires: ['exchange-inicio'], position: { x: 50, y: 9 }, difficulty: 'easy',
    section: { number: 5, title: 'Tu primer exchange' },
    unit: { number: 2, title: 'Compra y vende paso a paso' },
    intro: {
      flashcards: [
        { id: 'ex-spot', term: 'Spot', definition: 'Compra o venta del propio activo. El spot sin margen no usa apalancamiento; los futuros son otro producto.' },
        { id: 'ex-importe', term: 'Importe y cantidad', definition: 'Importe: dinero de la operación, por ejemplo 20 EUR. Cantidad: unidades del activo, por ejemplo 0,0004 BTC.' },
        { id: 'ex-comision', term: 'Comisión', definition: 'Coste de una operación. Revisa cuánto pagas y cuánto recibes en el resumen; las tarifas varían.' },
        { id: 'ex-market', term: 'Orden de mercado', definition: 'Busca ejecutarse con las ofertas disponibles. El precio final puede diferir del que viste en pantalla.' },
        { id: 'ex-limit', term: 'Orden límite', definition: 'Fija el máximo al comprar o el mínimo al vender. Puede quedar pendiente o ejecutarse solo en parte.' },
        { id: 'ex-estado', term: 'Estado de la orden', definition: 'Pendiente no significa comprada. Consulta cuánto se ejecutó y qué parte sigue abierta en Órdenes.' },
      ],
      explanations: [
        'Para este ejemplo usamos spot sin margen: compras el activo sin apalancamiento. Si 1 BTC cuesta 50.000 EUR, un importe de 20 EUR equivale a 0,0004 BTC antes de comisiones. Mira la unidad junto a cada campo y revisa el coste total antes de confirmar. Son cifras inventadas para practicar.',
        'Mercado busca ejecutar con las ofertas disponibles; límite añade un precio que debes respetar. Una compra límite a 49.000 EUR puede seguir pendiente si las ventas están a 50.000 EUR. Tras enviar, consulta Órdenes: puede estar abierta, parcialmente ejecutada o completada. Cancelar solo afecta a la parte que aún no se ejecutó.',
      ],
      games: [
        sequence('Ordena la preparación de una compra de práctica.', ['Selecciona Spot sin margen y el par BTC/EUR', 'Elige Comprar e introduce el importe', 'Revisa cantidad, comisión y total', 'Confirma la orden de práctica']),
        sequence('Cancela la parte pendiente de una orden.', ['Abre la lista de órdenes abiertas', 'Selecciona la orden que quieres cancelar', 'Solicita cancelar la parte pendiente', 'Comprueba el estado final y lo ejecutado']),
      ],
    },
    lessons: [{ id: 'exchange-operar-1', title: 'Del formulario al historial', icon: 'clipboard', questions: [
      question('ex-o1', 'El ejercicio pide comprar el activo sin apalancamiento. ¿Qué eliges?', ['Futuros 20x', 'Spot sin margen', 'Margen cruzado'], 1, 'Spot sin margen es la modalidad de este ejemplo. Los futuros y el margen tienen mecanismos y riesgos diferentes.'),
      question('ex-o2', 'El campo dice «Cantidad (BTC)». ¿Qué representa 0,0004?', ['0,0004 euros de comisión', '400 euros', '0,0004 unidades de bitcoin'], 2, 'La etiqueta BTC indica la unidad del campo. No confundas la cantidad del activo con el importe en euros.'),
      question('ex-o3', 'Compra: 20 EUR. Comisión adicional: 0,20 EUR. ¿Total del ejemplo?', ['20,20 EUR', '19,80 EUR', '20 EUR siempre'], 0, 'Aquí la comisión se suma: 20 + 0,20 = 20,20 EUR. Revisa el resumen porque otras plataformas pueden descontarla del importe.'),
      question('ex-o4', 'Antes de confirmar, ¿qué resumen debes revisar?', ['Solo el color del botón', 'Par, compra o venta, importe y costes', 'Solo el precio de ayer'], 1, 'Comprueba qué activo operas, en qué dirección y por cuánto. Una cifra correcta en el campo equivocado puede cambiar la operación.'),
      question('ex-o5', 'Usas una orden de mercado. ¿El precio visto está garantizado?', ['Sí, siempre', 'Solo si el gráfico está verde', 'No, depende de las ofertas al ejecutarse'], 2, 'El mercado puede moverse y la orden puede cruzar varios precios. Revisa el precio medio de ejecución.'),
      question('ex-o6', 'Tu compra límite está a 49.000 EUR y las ventas a 50.000 EUR. ¿Qué puede pasar?', ['Queda pendiente sin comprar', 'Compra obligatoriamente a 50.000', 'Genera beneficios automáticamente'], 0, 'El límite de compra no permite pagar más de 49.000 EUR. No hay garantía de que encuentre una venta compatible.'),
      question('ex-o7', 'Una orden de 20 EUR ejecutó 8 EUR. Cancelas el resto. ¿Qué ocurre?', ['Se deshace toda la compra', 'Los 8 EUR ejecutados siguen comprados', 'Se compran los 20 EUR'], 1, 'Cancelar no revierte lo que ya se ejecutó. Comprueba el estado final porque puede haber nuevas ejecuciones antes de aceptar la cancelación.'),
      question('ex-o8', 'Quieres comprobar el precio real de tu compra completada. ¿Dónde miras?', ['En el precio actual del gráfico', 'En Seguridad', 'En el historial de ejecuciones'], 2, 'El historial recoge lo ejecutado y sus costes. El gráfico actual no demuestra a qué precio compraste.'),
    ] }],
  },
  {
    id: 'exchange-transferencias', title: 'Mueve tus fondos', icon: 'shield',
    description: 'Distingue ingresar, transferir y retirar, y revisa cada dato.',
    requires: ['exchange-operar'], position: { x: 50, y: 10 }, difficulty: 'easy',
    section: { number: 5, title: 'Tu primer exchange' },
    unit: { number: 3, title: 'Depósitos y retiradas sin confusiones' },
    intro: {
      flashcards: [
        { id: 'ex-deposito', term: 'Depósito', definition: 'Entrada de fondos al exchange. Depositar euros no compra criptomonedas automáticamente.' },
        { id: 'ex-transferencia', term: 'Transferencia interna', definition: 'Movimiento entre saldos del mismo servicio, como financiación y trading, si la plataforma los separa.' },
        { id: 'ex-retirada', term: 'Retirada', definition: 'Salida de fondos del exchange. Retirar euros al banco y enviar cripto por una red son recorridos distintos.' },
        { id: 'ex-red', term: 'Red y dirección', definition: 'La red debe estar admitida en origen y destino para ese activo. Verifica también la dirección del receptor.' },
        { id: 'ex-memo', term: 'Memo o tag', definition: 'Dato adicional que algunos destinos exigen para identificar al destinatario. Si se solicita, no lo omitas.' },
        { id: 'ex-confirmaciones', term: 'Confirmaciones', definition: 'Registro progresivo de una transacción en la red. Un depósito puede tardar en acreditarse; consulta su estado.' },
      ],
      explanations: [
        'Depositar es traer fondos; operar es comprar o vender; retirar es sacarlos. Algunos exchanges separan el saldo de financiación del de trading y permiten transferir entre ambos. Lee las instrucciones del servicio: una retirada bancaria en euros no usa una dirección de criptomonedas.',
        'Para enviar cripto, consulta primero lo que admite el destino: activo, red, dirección y memo si lo exige. Revisa costes, mínimo y cantidad que llegará. Una red barata no sirve si el receptor no la admite. Una prueba pequeña compatible con el mínimo permite comprobar la recepción; los envíos por blockchain normalmente no se pueden deshacer.',
      ],
      games: [
        sequence('Ordena las comprobaciones de un envío de cripto.', ['Consulta los datos de recepción del destino', 'Introduce activo, red, dirección y memo pedido', 'Revisa los datos, el mínimo y la comisión', 'Autoriza y consulta el estado del envío']),
        sequence('Comprueba un depósito que todavía no aparece.', ['Abre el historial de envíos del origen', 'Busca el identificador de la transacción', 'Consulta su estado en el explorador de la red', 'Contrasta con los requisitos del destino']),
      ],
    },
    lessons: [{ id: 'exchange-transferencias-1', title: 'Revisa antes de enviar', icon: 'shield', questions: [
      question('ex-t1', 'Depositas 30 EUR en tu cuenta. ¿Ya tienes bitcoin?', ['No, tienes euros hasta realizar una compra', 'Sí, se compra solo', 'Sí, si bitcoin ha subido'], 0, 'Depositar añade saldo. Comprar es otra acción y requiere elegir y confirmar una operación.'),
      question('ex-t2', 'El saldo está en Financiación y el servicio exige saldo en Trading. ¿Qué buscas?', ['Una retirada a otra red', 'La transferencia interna entre esos saldos', 'El botón de apalancamiento'], 1, 'Si el exchange separa esos saldos, su transferencia interna permite moverlos. Comprueba las cuentas de origen y destino.'),
      question('ex-t3', 'Quieres recibir euros en tu banco. ¿Qué recorrido corresponde?', ['Copiar una dirección BTC', 'Elegir la red más barata', 'Retirada de euros por un método bancario disponible'], 2, 'Los métodos, plazos y requisitos bancarios dependen del servicio. No se usan direcciones de criptomonedas para una retirada de euros al banco.'),
      question('ex-t4', 'Tienes saldo total, pero parte está reservada en una orden. ¿Qué puedes usar?', ['El saldo disponible, no necesariamente el total', 'Siempre todo el saldo', 'El doble si refrescas'], 0, 'Las órdenes abiertas pueden reservar fondos. Revisa saldo disponible y reservas antes de preparar otra operación.'),
      question('ex-t5', 'La red más barata no está admitida por el destino. ¿La eliges?', ['Sí, porque es el mismo activo', 'No, verifico una red compatible en ambos lados', 'Sí, si envío poco'], 1, 'Coincidir en el nombre del activo no basta. Una red incompatible puede impedir que el depósito llegue y causar pérdidas.'),
      question('ex-t6', 'El destino indica «memo obligatorio». ¿Qué debes hacer?', ['Dejarlo vacío', 'Escribir mi apodo', 'Copiar y comprobar el memo indicado'], 2, 'El memo identifica al destinatario en ciertos servicios. Una dirección correcta sin el memo requerido puede no acreditar el depósito.'),
      question('ex-t7', 'La retirada figura pendiente. ¿Cuál es el siguiente paso?', ['Consultar el estado antes de repetir el envío', 'Repetirla varias veces', 'Compartir mi contraseña para acelerarla'], 0, 'Pendiente no significa fallida. Revisa el historial y, si existe, el identificador de transacción; usa soporte oficial si necesitas ayuda.'),
      question('ex-t8', 'Vas a probar un destino nuevo con una cantidad pequeña. ¿Qué compruebas?', ['Solo el logo del activo', 'Datos, mínimo, comisión y recepción de la prueba', 'Que alguien prometa devolverte el doble'], 1, 'La prueba debe respetar mínimos y costes. Comprueba que llegó al destino correcto antes de plantear otro envío.'),
    ] }],
  },
];
