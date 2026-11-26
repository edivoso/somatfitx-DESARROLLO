export default async function handler(req, res) {
    // Mercado Pago envía notificaciones por POST (y a veces valida con GET)
    if (req.method !== 'POST') {
        return res.status(200).send('OK');
    }

    try {
        const { type, data, action } = req.body;
        const paymentId = data?.id || req.query['data.id'];

        // Verificar que la notificación sea de un pago
        if ((type === 'payment' || action?.includes('payment')) && paymentId) {
            // 1. Consultar el pago completo a Mercado Pago para verificar que sea real y esté aprobado
            const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
                headers: {
                    'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`
                }
            });

            const payment = await mpResponse.json();

            // 2. Solo notificar si el pago ya fue APROBADO
            if (payment.status === 'approved') {
                const items = payment.additional_info?.items || [];
                const listaProductos = items.length > 0
                    ? items.map(i => `• ${i.quantity}x ${i.title} ($${i.unit_price} MXN)`).join('\n')
                    : `• ${payment.description || 'Compra en SomaFitX'}`;

                const total = payment.transaction_amount;
                const compradorEmail = payment.payer?.email || 'No proporcionado';
                const compradorNombre = `${payment.payer?.first_name || ''} ${payment.payer?.last_name || ''}`.trim() || 'Cliente';

                // 3A. ENVIAR CORREO (Si configuraste RESEND_API_KEY en Vercel)
                if (process.env.RESEND_API_KEY && process.env.VENDEDOR_EMAIL) {
                    await fetch('https://api.resend.com/emails', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            from: 'SomaFitX Ventas <onboarding@resend.dev>',
                            to: process.env.VENDEDOR_EMAIL,
                            subject: `💰 ¡Nueva venta aprobada por $${total} MXN! - SomaFitX`,
                            text: `¡Hola! Se ha acreditado un nuevo pago en SomaFitX.\n\n` +
                                  `PRODUCTOS ADQUIRIDOS:\n${listaProductos}\n\n` +
                                  `TOTAL PAGADO: $${total} MXN\n` +
                                  `ID DE PAGO MP: ${payment.id}\n` +
                                  `COMPRADOR: ${compradorNombre} (${compradorEmail})\n\n` +
                                  `Ya puedes preparar el envío.`
                        })
                    });
                }

                // 3B. ENVIAR WHATSAPP (Si configuraste CALLMEBOT_PHONE y CALLMEBOT_APIKEY en Vercel)
                if (process.env.CALLMEBOT_PHONE && process.env.CALLMEBOT_APIKEY) {
                    const mensajeWA = encodeURIComponent(
                        `💰 *NUEVA VENTA SOMAFITX*\n\n` +
                        `*Productos:*\n${listaProductos}\n\n` +
                        `*Total:* $${total} MXN\n` +
                        `*Cliente:* ${compradorEmail}\n` +
                        `*ID Pago:* ${payment.id}`
                    );
                    await fetch(`https://api.callmebot.com/whatsapp.php?phone=${process.env.CALLMEBOT_PHONE}&text=${mensajeWA}&apikey=${process.env.CALLMEBOT_APIKEY}`);
                }
            }
        }

        // Responder siempre 200 OK rápido a Mercado Pago para que no reintente la notificación
        return res.status(200).json({ received: true });

    } catch (error) {
        console.error('Error en webhook:', error);
        return res.status(200).json({ received: true });
    }
}
