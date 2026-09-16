import amqp from 'amqplib';

async function main(): Promise<void> {
  const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672');
  const channel = await connection.createChannel();
  await channel.assertQueue('marketplace.orders', { durable: true });
  const order = {
    uuid: 'ORD-2026-0001', created_at: '2026-09-15T10:15:00Z', channel: 'mobile_app', status: 'paid',
    customer: { id: 7788, name: 'Maria Oliveira', email: 'maria@email.com', document: '987.654.321-00' },
    seller: { id: 55, name: 'Tech Store', city: 'São Paulo', state: 'SP' },
    items: [{ id: 1, product: { id: 'abc-1344', title: 'Televisão' }, unit_price: 2500, quantity: 2,
      category: { id: 'ELEC', name: 'Eletrônicos', sub_category: { id: 'TV', name: 'Televisores' } } }],
    shipment: { carrier: 'Correios', service: 'SEDEX', status: 'created', tracking_code: null },
    payment: { method: 'pix', status: 'approved', transaction_id: 'pay_987654321' },
    metadata: { source: 'app', user_agent: 'demo', ip_address: '127.0.0.1' }
  };
  channel.sendToQueue('marketplace.orders', Buffer.from(JSON.stringify(order)), { persistent: true });
  await channel.close(); await connection.close();
  console.log('Pedido de exemplo publicado');
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
