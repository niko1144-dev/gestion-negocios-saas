import test from 'node:test';
import assert from 'node:assert/strict';
import { parseInitialStock, parseProductInput, parseStockMovement } from '../src/services/product-validation.js';

test('normaliza un producto válido', () => {
  const result = parseProductInput({ name: ' Café molido ', sku: ' caf-01 ', price: '4990.5', cost: 2500, minimumStock: 3 });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.value, { name: 'Café molido', sku: 'CAF-01', description: null, price: 4990.5, cost: 2500, minimumStock: 3 });
});

test('rechaza valores comerciales inválidos', () => {
  const result = parseProductInput({ name: '', price: -1, cost: 'x', minimumStock: 1.5 });
  assert.equal(result.errors.length, 4);
});

test('valida el stock inicial como entero no negativo', () => {
  assert.deepEqual(parseInitialStock('8'), { value: 8 });
  assert.ok(parseInitialStock(-1).error);
  assert.ok(parseInitialStock(2.5).error);
});

test('calcula entradas y salidas sin permitir stock negativo', () => {
  assert.equal(parseStockMovement({ type: 'entry', quantity: 4 }, 3).value.stockAfter, 7);
  assert.equal(parseStockMovement({ type: 'exit', quantity: 2 }, 3).value.change, -2);
  assert.ok(parseStockMovement({ type: 'exit', quantity: 4 }, 3).error);
});

test('permite ajustes firmados y valida tipo y cantidad', () => {
  assert.equal(parseStockMovement({ type: 'adjustment', quantity: -2, note: 'Conteo' }, 5).value.stockAfter, 3);
  assert.ok(parseStockMovement({ type: 'sale', quantity: 1 }, 5).error);
  assert.ok(parseStockMovement({ type: 'entry', quantity: 0 }, 5).error);
});
