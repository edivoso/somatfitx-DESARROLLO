export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(200).send('OK');
    }

    try {
        const { type, data, action } = req.body || {};
        const paymentId = data?.id || req.query['data.id'];

        if ((type === 'payment' || action?.includes('payment')) && paymentId) {
            const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
                headers: {
                    'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`
                }
            });

            const payment = await mpResponse.json();

            if (payment.status === 'approved') {
                const items = payment.additional_info?.items || [];
                const listaProductos = items.length > 0
                    ? items.map(i => `• ${i.quantity}x ${i.title} ($${i.unit_price} MXN)`).join('\n')
                    : `• ${payment.description || 'Compra en SomaFitX'}`;

                const total = payment.transaction_amount;
                const compradorEmail = payment.payer?.email || 'No proporcionado';
                const compradorNombre = `${payment.payer?.first_name || ''} ${payment.payer?.last_name || ''}`.trim() || 'Cliente';

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
            }
        }

        return res.status(200).json({ received: true });
    } catch (error) {
        console.error('Error en webhook:', error);
        return res.status(200).json({ received: true });
    }
}
