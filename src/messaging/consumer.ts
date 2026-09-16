import amqp from 'amqplib';
import { initOrdersSchema, saveOrder, validateOrder } from './store';

export async function startOrderConsumer(): Promise<void> {
  await initOrdersSchema();
  const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672');
  const channel = await connection.createChannel();
  await channel.assertQueue('marketplace.orders', { durable: true });
  await channel.assertQueue('marketplace.orders.invalid', { durable: true });
  await channel.prefetch(1);
  await channel.consume('marketplace.orders', async message => {
    if (!message) return;
    let order: any;
    try {
      order = JSON.parse(message.content.toString('utf8'));
      validateOrder(order);
    } catch (error) {
      console.error('Mensagem inválida:', error);
      channel.sendToQueue('marketplace.orders.invalid', message.content, { persistent: true });
      channel.ack(message);
      return;
    }
    try {
      await saveOrder(order);
      channel.ack(message);
    } catch (error) {
      console.error('Falha ao persistir pedido; será tentado novamente:', error);
      await new Promise(resolve => setTimeout(resolve, 3000));
      channel.nack(message, false, true);
    }
  });
  console.log('Consumidor de pedidos iniciado');
}
