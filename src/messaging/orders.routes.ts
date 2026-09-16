import { Router, Request, Response } from 'express';
import { pool } from './store';

export const ordersRouter = Router();

function numberParam(value: unknown, name: string): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1) throw new Error(`${name} inválido`);
  return n;
}

function filters(query: Request['query'], summary = false): { where: string; args: unknown[] } {
  const args: unknown[] = [];
  const conditions: string[] = [];
  const add = (sql: string, value: unknown) => { args.push(value); conditions.push(sql.replace('?', `$${args.length}`)); };
  if (!summary) {
    const customer = numberParam(query['customer.id'], 'customer.id');
    if (customer !== undefined) add('o.customer_id = ?', customer);
    if (query['product.id'] !== undefined) add('EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_uuid=o.uuid AND oi.product_id=?)', String(query['product.id']));
    if (query.status !== undefined) add('o.status = ?', String(query.status));
  }
  const seller = numberParam(query['seller.id'], 'seller.id');
  if (seller !== undefined) add('o.seller_id = ?', seller);
  if (summary) {
    for (const [key, op] of [['start_date','>='], ['end_date','<=']] as const) {
      if (query[key] !== undefined) {
        const raw = String(query[key]);
        if (!Number.isFinite(Date.parse(raw))) throw new Error(`${key} inválida`);
        const value = /^\d{4}-\d{2}-\d{2}$/.test(raw)
          ? `${raw}${key === 'start_date' ? 'T00:00:00.000Z' : 'T23:59:59.999Z'}` : raw;
        add(`o.created_at ${op} ?`, value);
      }
    }
  }
  return { where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', args };
}

const base = `FROM orders o JOIN order_customers c ON c.id=o.customer_id JOIN order_sellers s ON s.id=o.seller_id`;

async function orderPayload(uuid: string): Promise<any | null> {
  const row = (await pool.query(`SELECT o.*, c.name AS customer_name,c.email,c.document,s.name AS seller_name,s.city,s.state ${base} WHERE o.uuid=$1`, [uuid])).rows[0];
  if (!row) return null;
  const items = (await pool.query(`SELECT i.id,i.unit_price,i.quantity,i.category,p.id AS product_id,p.title FROM order_items i JOIN order_products p ON p.id=i.product_id WHERE i.order_uuid=$1 ORDER BY i.id`, [uuid])).rows;
  const mapped = items.map(i => ({ id: Number(i.id), product: { id: i.product_id, title: i.title }, unit_price: Number(i.unit_price), quantity: i.quantity, category: i.category, total: Number((Number(i.unit_price) * i.quantity).toFixed(2)) }));
  return { uuid: row.uuid, created_at: row.created_at, indexed_at: row.indexed_at, channel: row.channel,
    total: Number(mapped.reduce((sum, item) => sum + item.total, 0).toFixed(2)), status: row.status,
    customer: { id: Number(row.customer_id), name: row.customer_name, email: row.email, document: row.document },
    seller: { id: Number(row.seller_id), name: row.seller_name, city: row.city, state: row.state },
    items: mapped, shipment: row.shipment, payment: row.payment, metadata: row.metadata };
}

function fail(res: Response, error: unknown): void {
  if (error instanceof Error && error.message.includes('inválid')) { res.status(400).json({ error: error.message }); return; }
  console.error(error); res.status(500).json({ error: 'Erro interno' });
}

ordersRouter.get('/financial-summary', async (req, res) => {
  try {
    const { where, args } = filters(req.query, true);
    const rows = (await pool.query(`SELECT o.status,o.payment->>'method' AS method,COALESCE(SUM(i.unit_price*i.quantity),0)::numeric AS total
      ${base} LEFT JOIN order_items i ON i.order_uuid=o.uuid ${where} GROUP BY o.uuid,o.status,o.payment`, args)).rows;
    const total = rows.reduce((sum, row) => sum + Number(row.total), 0);
    const by_status: Record<string, number> = { created: 0, paid: 0, shipped: 0, delivered: 0, canceled: 0 };
    const by_payment_method: Record<string, { count: number; total: number }> = {};
    for (const row of rows) {
      by_status[row.status] = (by_status[row.status] || 0) + 1;
      const method = row.method || 'unknown';
      const entry = by_payment_method[method] || { count: 0, total: 0 };
      entry.count++; entry.total = Number((entry.total + Number(row.total)).toFixed(2));
      by_payment_method[method] = entry;
    }
    res.json({ total_orders: rows.length, total_revenue: Number(total.toFixed(2)), average_order_value: rows.length ? Number((total / rows.length).toFixed(2)) : 0, by_status, by_payment_method });
  } catch (e) { fail(res, e); }
});

ordersRouter.get('/', async (req, res) => {
  try {
    const page = numberParam(req.query.page ?? 1, 'page')!;
    const limit = numberParam(req.query.limit ?? 20, 'limit')!;
    if (limit > 100) throw new Error('limit inválido');
    const { where, args } = filters(req.query);
    const count = Number((await pool.query(`SELECT count(*) ${base} ${where}`, args)).rows[0].count);
    const ids = (await pool.query(`SELECT o.uuid ${base} ${where} ORDER BY o.created_at DESC,o.uuid DESC LIMIT $${args.length + 1} OFFSET $${args.length + 2}`, [...args, limit, (page - 1) * limit])).rows;
    res.json({ data: await Promise.all(ids.map(row => orderPayload(row.uuid))), page, limit, total: count, total_pages: Math.ceil(count / limit) });
  } catch (e) { fail(res, e); }
});

ordersRouter.get('/:uuid/items', async (req, res) => {
  try { const order = await orderPayload(req.params.uuid); if (!order) { res.status(404).json({ error: 'Pedido não encontrado' }); return; } res.json({ items: order.items }); }
  catch (e) { fail(res, e); }
});

ordersRouter.get('/:uuid', async (req, res) => {
  try { const order = await orderPayload(req.params.uuid); if (!order) { res.status(404).json({ error: 'Pedido não encontrado' }); return; } res.json(order); }
  catch (e) { fail(res, e); }
});
