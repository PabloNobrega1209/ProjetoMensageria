import express from 'express';
import { join } from 'path';
import { ordersRouter } from './messaging/orders.routes';
import { initOrdersSchema } from './messaging/store';

const app = express();
const publicDir = join(__dirname, '../public');

app.use(express.static(publicDir));
app.use(express.static(join(process.cwd(), 'public')));

app.get('/', (_req, res) => {
  res.sendFile(join(publicDir, 'index.html'), err => {
    if (err) {
      res.sendFile(join(process.cwd(), 'public/index.html'));
    }
  });
});

app.get('/health', (_req, res) => res.json({ status: 'online' }));
app.use('/orders', ordersRouter);

async function boot(): Promise<void> {
  for (;;) {
    try {
      await initOrdersSchema();
      app.listen(Number(process.env.PORT || 3000), () => console.log('API de pedidos na porta 3000'));
      return;
    } catch (error) {
      console.error('Aguardando banco:', error);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
}
void boot();
