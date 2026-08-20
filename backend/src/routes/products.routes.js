import { Router } from 'express';
import { pool } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { parseInitialStock, parseProductInput, parseStockMovement } from '../services/product-validation.js';

const router = Router();
router.use(requireAuth);

const productFields = `id, name, sku, description, price::float8 AS price, cost::float8 AS cost,
  stock, minimum_stock AS "minimumStock", is_active AS "isActive",
  created_at AS "createdAt", updated_at AS "updatedAt"`;

function databaseError(res, error, fallback) {
  if (error.code === '23505') return res.status(409).json({ message: 'Ya existe un producto con ese SKU en tu negocio.' });
  console.error(error);
  return res.status(500).json({ message: fallback });
}

router.get('/', async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const includeInactive = req.query.includeInactive === 'true';
  const lowStock = req.query.lowStock === 'true';
  const conditions = ['business_id = $1'];
  const values = [req.auth.businessId];
  if (!includeInactive) conditions.push('is_active = TRUE');
  if (lowStock) conditions.push('stock <= minimum_stock');
  if (search) {
    values.push(`%${search}%`);
    conditions.push(`(name ILIKE $${values.length} OR sku ILIKE $${values.length})`);
  }

  try {
    const result = await pool.query(
      `SELECT ${productFields} FROM products WHERE ${conditions.join(' AND ')} ORDER BY name ASC`,
      values,
    );
    const products = result.rows;
    return res.json({
      products,
      summary: {
        totalProducts: products.length,
        totalUnits: products.reduce((total, product) => total + product.stock, 0),
        lowStockProducts: products.filter((product) => product.stock <= product.minimumStock).length,
        inventoryValue: products.reduce((total, product) => total + product.stock * product.cost, 0),
      },
    });
  } catch (error) {
    return databaseError(res, error, 'No se pudieron obtener los productos.');
  }
});

router.post('/', async (req, res) => {
  const parsed = parseProductInput(req.body);
  const initialStock = parseInitialStock(req.body.initialStock);
  const errors = [...parsed.errors, ...(initialStock.error ? [initialStock.error] : [])];
  if (errors.length) return res.status(400).json({ message: errors[0], errors });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { name, sku, description, price, cost, minimumStock } = parsed.value;
    const result = await client.query(
      `INSERT INTO products (business_id, name, sku, description, price, cost, stock, minimum_stock)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING ${productFields}`,
      [req.auth.businessId, name, sku, description, price, cost, initialStock.value, minimumStock],
    );
    if (initialStock.value > 0) {
      await client.query(
        `INSERT INTO inventory_movements (business_id, product_id, user_id, type, quantity_change, stock_after, note)
         VALUES ($1, $2, $3, 'initial', $4, $4, 'Stock inicial')`,
        [req.auth.businessId, result.rows[0].id, req.auth.userId, initialStock.value],
      );
    }
    await client.query('COMMIT');
    return res.status(201).json({ product: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    return databaseError(res, error, 'No se pudo crear el producto.');
  } finally {
    client.release();
  }
});

router.patch('/:id', async (req, res) => {
  const parsed = parseProductInput(req.body, { partial: true });
  if (parsed.errors.length) return res.status(400).json({ message: parsed.errors[0], errors: parsed.errors });
  const columns = { name: 'name', sku: 'sku', description: 'description', price: 'price', cost: 'cost', minimumStock: 'minimum_stock', isActive: 'is_active' };
  const entries = Object.entries(parsed.value);
  if (!entries.length) return res.status(400).json({ message: 'No hay campos válidos para actualizar.' });
  const values = [req.auth.businessId, req.params.id];
  const assignments = entries.map(([key, value]) => {
    values.push(value);
    return `${columns[key]} = $${values.length}`;
  });

  try {
    const result = await pool.query(
      `UPDATE products SET ${assignments.join(', ')}, updated_at = NOW()
       WHERE business_id = $1 AND id = $2 RETURNING ${productFields}`,
      values,
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Producto no encontrado.' });
    return res.json({ product: result.rows[0] });
  } catch (error) {
    return databaseError(res, error, 'No se pudo actualizar el producto.');
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE products SET is_active = FALSE, updated_at = NOW()
       WHERE business_id = $1 AND id = $2 AND is_active = TRUE RETURNING id`,
      [req.auth.businessId, req.params.id],
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Producto no encontrado.' });
    return res.status(204).send();
  } catch (error) {
    return databaseError(res, error, 'No se pudo desactivar el producto.');
  }
});

router.get('/:id/movements', async (req, res) => {
  try {
    const product = await pool.query('SELECT id FROM products WHERE business_id = $1 AND id = $2', [req.auth.businessId, req.params.id]);
    if (!product.rowCount) return res.status(404).json({ message: 'Producto no encontrado.' });
    const result = await pool.query(
      `SELECT m.id, m.type, m.quantity_change AS "quantityChange", m.stock_after AS "stockAfter",
              m.note, m.created_at AS "createdAt", u.name AS "userName"
       FROM inventory_movements m LEFT JOIN users u ON u.id = m.user_id
       WHERE m.business_id = $1 AND m.product_id = $2 ORDER BY m.created_at DESC, m.id DESC LIMIT 100`,
      [req.auth.businessId, req.params.id],
    );
    return res.json({ movements: result.rows });
  } catch (error) {
    return databaseError(res, error, 'No se pudo obtener el historial de inventario.');
  }
});

router.post('/:id/movements', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const productResult = await client.query(
      'SELECT id, stock FROM products WHERE business_id = $1 AND id = $2 AND is_active = TRUE FOR UPDATE',
      [req.auth.businessId, req.params.id],
    );
    if (!productResult.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Producto no encontrado.' });
    }
    const movement = parseStockMovement(req.body, productResult.rows[0].stock);
    if (movement.error) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: movement.error });
    }
    const { type, change, stockAfter, note } = movement.value;
    const updated = await client.query(
      `UPDATE products SET stock = $3, updated_at = NOW()
       WHERE business_id = $1 AND id = $2 RETURNING ${productFields}`,
      [req.auth.businessId, req.params.id, stockAfter],
    );
    const created = await client.query(
      `INSERT INTO inventory_movements (business_id, product_id, user_id, type, quantity_change, stock_after, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, type, quantity_change AS "quantityChange", stock_after AS "stockAfter", note, created_at AS "createdAt"`,
      [req.auth.businessId, req.params.id, req.auth.userId, type, change, stockAfter, note],
    );
    await client.query('COMMIT');
    return res.status(201).json({ product: updated.rows[0], movement: created.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    return databaseError(res, error, 'No se pudo registrar el movimiento.');
  } finally {
    client.release();
  }
});

export default router;
