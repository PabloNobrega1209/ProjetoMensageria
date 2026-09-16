import { PubSub } from '@google-cloud/pubsub';

async function main(): Promise<void> {
  if (!process.env.PUBSUB_EMULATOR_HOST) {
    throw new Error('O publicador de exemplo só pode ser usado com o emulador local; a credencial do grupo é apenas subscriber.');
  }
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || 'marketplace-local';
  const topicId = process.env.PUBSUB_TOPIC || 'marketplace-orders';
  const pubsub = new PubSub({ projectId });
  const topic = pubsub.topic(topicId);
  if (process.env.PUBSUB_AUTO_CREATE === 'true') {
    const [exists] = await topic.exists();
    if (!exists) await topic.create();
  }
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
  const messageId = await topic.publishMessage({ data: Buffer.from(JSON.stringify(order)) });
  console.log(`Pedido de exemplo publicado na mensagem ${messageId}`);
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
