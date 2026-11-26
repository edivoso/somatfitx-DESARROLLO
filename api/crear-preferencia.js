export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    try {
        const { items } = req.body;

        const mpItems = items.map(item => ({
            title: item.title,
            quantity: Number(item.quantity),
            unit_price: Number(item.price),
            currency_id: 'MXN'
        }));

        const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`
            },
            body: JSON.stringify({
                items: mpItems,
                back_urls: {
                    success: 'https://somafitx-desa.vercel.app/',
                    failure: 'https://somafitx-desa.vercel.app/',
                    pending: 'https://somafitx-desa.vercel.app/'
                },
                auto_return: 'approved'
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({ error: data });
        }

        return res.status(200).json({ init_point: data.init_point });

    } catch (error) {
        return res.status(500).json({ error: 'Error al generar el pago' });
    }
}
