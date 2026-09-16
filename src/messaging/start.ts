import { startOrderConsumer } from './consumer';

async function boot(): Promise<void> {
  for (;;) {
    try { await startOrderConsumer(); return; }
    catch (error) { console.error('Aguardando banco/fila:', error); await new Promise(resolve => setTimeout(resolve, 3000)); }
  }
}
void boot();
