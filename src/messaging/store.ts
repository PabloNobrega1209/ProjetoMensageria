import { Pool, PoolClient } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

export const pool = new Pool({ connectionString: process.env.ORDERS_DATABASE_URL || 'postgres://orders_user:orders_password@localhost:5432/orders_db' });

export async function initOrdersSchema(): Promise<void> {
  const sql = readFileSync(process.env.ORDERS_SCHEMA_PATH || join(__dirname, '../..', 'schema.sql'), 'utf8');
  await pool.query(sql);
}

export function validateOrder(input: any): void {
  const nonempty = (value: unknown) => typeof value === 'string' && value.trim().length > 0;
  if (!input || typeof input.uuid !== 'string' || !input.uuid.trim() || !Number.isFinite(Date.parse(input.created_at)) ||
      !nonempty(input.status) ||
      !input.customer || !Number.isSafeInteger(input.customer.id) || !input.seller || !Number.isSafeInteger(input.seller.id) ||
      !nonempty(input.channel) || !nonempty(input.customer.name) || !nonempty(input.customer.email) ||
      !nonempty(input.customer.document) || !nonempty(input.seller.name) || !nonempty(input.seller.city) || !nonempty(input.seller.state) ||
      !Array.isArray(input.items) || input.items.length === 0) throw new Error('Pedido inválido');
  const ids = new Set<number>();
  for (const item of input.items) {
    if (!Number.isSafeInteger(item.id) || ids.has(item.id) || !item.product || !nonempty(item.product.id) || !nonempty(item.product.title) ||
        !Number.isFinite(Number(item.unit_price)) || Number(item.unit_price) < 0 ||
        !Number.isSafeInteger(item.quantity) || item.quantity < 1 || !item.category || typeof item.category !== 'object') throw new Error('Item inválido');
    ids.add(item.id);
  }
}

export async function saveOrder(order: any): Promise<void> {
  validateOrder(order);
  const client: PoolClient = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('INSERT INTO order_customers VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,email=EXCLUDED.email,document=EXCLUDED.document', [order.customer.id, order.customer.name, order.customer.email, order.customer.document]);
    await client.query('INSERT INTO order_sellers VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,city=EXCLUDED.city,state=EXCLUDED.state', [order.seller.id, order.seller.name, order.seller.city, order.seller.state]);
    const inserted = await client.query(`INSERT INTO orders (uuid,created_at,channel,status,customer_id,seller_id,shipment,payment,metadata)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (uuid) DO NOTHING`,
      [order.uuid, order.created_at, order.channel, order.status, order.customer.id, order.seller.id, order.shipment || null, order.payment || null, order.metadata || null]);
    for (const item of inserted.rowCount ? order.items : []) {
      await client.query('INSERT INTO order_products VALUES ($1,$2) ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title', [item.product.id, item.product.title]);
      await client.query('INSERT INTO order_items VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (order_uuid,id) DO NOTHING',
        [order.uuid, item.id, item.product.id, item.unit_price, item.quantity, item.category]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
