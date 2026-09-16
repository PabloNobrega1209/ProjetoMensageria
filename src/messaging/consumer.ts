import { Message, PubSub, Subscription } from '@google-cloud/pubsub';
import { initOrdersSchema, saveOrder, validateOrder } from './store';

const projectId = process.env.GOOGLE_CLOUD_PROJECT || 'serjava-demo';
const subscriptionId = process.env.PUBSUB_SUBSCRIPTION || 'projects/serjava-demo/subscriptions/grupo-i';
const topicId = process.env.PUBSUB_TOPIC || 'marketplace-orders';

async function getSubscription(pubsub: PubSub): Promise<Subscription> {
  const current = pubsub.subscription(subscriptionId, { flowControl: { maxMessages: 1 } });
  if (process.env.PUBSUB_AUTO_CREATE !== 'true') return current;
  const topic = pubsub.topic(topicId);
  const [topicExists] = await topic.exists();
  if (!topicExists) await topic.create();
  const [subscriptionExists] = await current.exists();
  if (!subscriptionExists) await topic.createSubscription(subscriptionId);
  return pubsub.subscription(subscriptionId, { flowControl: { maxMessages: 1 } });
}

export async function startOrderConsumer(): Promise<void> {
  await initOrdersSchema();
  const pubsub = new PubSub({ projectId });
  const orders = await getSubscription(pubsub);
  orders.on('message', async (message: Message) => {
    try {
      const order = JSON.parse(message.data.toString('utf8'));
      validateOrder(order);
      await saveOrder(order);
      message.ack();
      console.log(`Pedido da mensagem ${message.id} persistido`);
    } catch (error) {
      console.error(`Mensagem ${message.id} não processada:`, error);
      message.nack();
    }
  });
  orders.on('error', error => console.error('Falha na assinatura Pub/Sub:', error));
  console.log(`Consumidor Pub/Sub iniciado na assinatura ${subscriptionId}`);
}
