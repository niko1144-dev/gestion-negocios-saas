export function parseProductInput(body, { partial = false } = {}) {
  const errors = [];
  const value = {};

  if (!partial || body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) errors.push('El nombre es obligatorio.');
    else if (name.length > 180) errors.push('El nombre no puede superar 180 caracteres.');
    else value.name = name;
  }

  if (!partial || body.sku !== undefined) {
    const sku = typeof body.sku === 'string' ? body.sku.trim().toUpperCase() : '';
    if (sku.length > 80) errors.push('El SKU no puede superar 80 caracteres.');
    else value.sku = sku || null;
  }

  if (!partial || body.description !== undefined) {
    value.description = typeof body.description === 'string' ? body.description.trim() || null : null;
  }

  for (const field of ['price', 'cost']) {
    if (!partial || body[field] !== undefined) {
      const number = Number(body[field] ?? 0);
      if (!Number.isFinite(number) || number < 0) errors.push(`${field === 'price' ? 'El precio' : 'El costo'} debe ser un número igual o mayor que cero.`);
      else value[field] = Math.round(number * 100) / 100;
    }
  }

  if (!partial || body.minimumStock !== undefined) {
    const minimumStock = Number(body.minimumStock ?? 0);
    if (!Number.isInteger(minimumStock) || minimumStock < 0) errors.push('El stock mínimo debe ser un entero igual o mayor que cero.');
    else value.minimumStock = minimumStock;
  }

  if (partial && body.isActive !== undefined) {
    if (typeof body.isActive !== 'boolean') errors.push('El estado del producto no es válido.');
    else value.isActive = body.isActive;
  }

  return { value, errors };
}

export function parseInitialStock(rawStock) {
  const stock = Number(rawStock ?? 0);
  if (!Number.isInteger(stock) || stock < 0) return { error: 'El stock inicial debe ser un entero igual o mayor que cero.' };
  return { value: stock };
}

export function parseStockMovement(body, currentStock) {
  const type = body.type;
  const quantity = Number(body.quantity);
  if (!['entry', 'exit', 'adjustment'].includes(type)) return { error: 'El tipo de movimiento no es válido.' };
  if (!Number.isInteger(quantity) || quantity === 0) return { error: 'La cantidad debe ser un entero distinto de cero.' };

  let change;
  if (type === 'entry') change = Math.abs(quantity);
  else if (type === 'exit') change = -Math.abs(quantity);
  else change = quantity;

  const stockAfter = currentStock + change;
  if (stockAfter < 0) return { error: 'El movimiento dejaría el stock en un valor negativo.' };
  const note = typeof body.note === 'string' ? body.note.trim() : '';
  if (note.length > 300) return { error: 'La nota no puede superar 300 caracteres.' };
  return { value: { type, change, stockAfter, note: note || null } };
}
