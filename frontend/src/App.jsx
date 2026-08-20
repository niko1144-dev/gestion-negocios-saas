import { useEffect, useMemo, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const emptyAuth = { businessName: '', name: '', email: '', password: '' };
const emptyProduct = { name: '', sku: '', description: '', price: '', cost: '', initialStock: '0', minimumStock: '0' };

async function apiRequest(path, options = {}) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}${path}`, { ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } });
  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'No se pudo completar la solicitud.');
  return data;
}

function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState('register');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState(emptyAuth);
  async function submit(event) {
    event.preventDefault(); setMessage('Procesando...');
    try {
      const endpoint = mode === 'register' ? 'register' : 'login';
      const payload = mode === 'register' ? form : { email: form.email, password: form.password };
      const data = await apiRequest(`/auth/${endpoint}`, { method: 'POST', body: JSON.stringify(payload) });
      localStorage.setItem('token', data.token); onAuthenticated({ user: data.user, business: data.business });
    } catch (error) { setMessage(error.message); }
  }
  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value });
  return <main className="auth-shell"><section className="auth-intro"><span className="eyebrow">Gestión simple, decisiones claras</span><h1>Tu negocio,<br />bajo control.</h1><p>Productos, inventario y operación diaria en un espacio diseñado para pequeños negocios.</p></section><section className="auth-panel"><div className="brand"><span>G</span> Gestión Negocios</div><div className="auth-tabs"><button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setMessage(''); }}>Crear cuenta</button><button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setMessage(''); }}>Ingresar</button></div><form onSubmit={submit}>{mode === 'register' && <><label>Nombre del negocio<input name="businessName" value={form.businessName} onChange={update} required /></label><label>Tu nombre<input name="name" value={form.name} onChange={update} required /></label></>}<label>Correo electrónico<input name="email" type="email" value={form.email} onChange={update} required /></label><label>Contraseña<input name="password" type="password" minLength="8" value={form.password} onChange={update} required /></label><button className="primary-button" type="submit">{mode === 'register' ? 'Crear mi negocio' : 'Entrar al panel'}</button>{message && <div className="form-message">{message}</div>}</form></section></main>;
}

function ProductModal({ product, onClose, onSaved }) {
  const [form, setForm] = useState(product ? { name: product.name, sku: product.sku || '', description: product.description || '', price: product.price, cost: product.cost, minimumStock: product.minimumStock, initialStock: product.stock } : emptyProduct);
  const [message, setMessage] = useState('');
  async function submit(event) {
    event.preventDefault(); setMessage('Guardando...');
    try { const { initialStock, ...editable } = form; await apiRequest(product ? `/products/${product.id}` : '/products', { method: product ? 'PATCH' : 'POST', body: JSON.stringify(product ? editable : form) }); onSaved(); } catch (error) { setMessage(error.message); }
  }
  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value });
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="product-title"><div className="modal-header"><div><span className="eyebrow">Catálogo</span><h2 id="product-title">{product ? 'Editar producto' : 'Nuevo producto'}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Cerrar">×</button></div><form onSubmit={submit}><div className="form-grid"><label className="wide">Nombre del producto<input name="name" value={form.name} onChange={update} maxLength="180" required autoFocus /></label><label>SKU <small>Opcional</small><input name="sku" value={form.sku} onChange={update} maxLength="80" placeholder="PROD-001" /></label><label>Precio de venta<input name="price" type="number" min="0" step="0.01" value={form.price} onChange={update} required /></label><label>Costo<input name="cost" type="number" min="0" step="0.01" value={form.cost} onChange={update} required /></label>{!product && <label>Stock inicial<input name="initialStock" type="number" min="0" step="1" value={form.initialStock} onChange={update} required /></label>}<label>Stock mínimo<input name="minimumStock" type="number" min="0" step="1" value={form.minimumStock} onChange={update} required /></label><label className="wide">Descripción <small>Opcional</small><textarea name="description" value={form.description} onChange={update} rows="3" /></label></div>{message && <div className="form-message">{message}</div>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" type="submit">Guardar producto</button></div></form></section></div>;
}

function StockModal({ product, onClose, onSaved }) {
  const [type, setType] = useState('entry'); const [quantity, setQuantity] = useState('1'); const [note, setNote] = useState(''); const [message, setMessage] = useState('');
  async function submit(event) { event.preventDefault(); try { await apiRequest(`/products/${product.id}/movements`, { method: 'POST', body: JSON.stringify({ type, quantity: Number(quantity), note }) }); onSaved(); } catch (error) { setMessage(error.message); } }
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><section className="modal small-modal"><div className="modal-header"><div><span className="eyebrow">Inventario</span><h2>Ajustar stock</h2><p>{product.name} · Stock actual: <strong>{product.stock}</strong></p></div><button type="button" className="icon-button" onClick={onClose}>×</button></div><form onSubmit={submit}><label>Tipo de movimiento<select value={type} onChange={(e) => setType(e.target.value)}><option value="entry">Entrada</option><option value="exit">Salida</option><option value="adjustment">Ajuste manual (+ / −)</option></select></label><label>Cantidad<input type="number" step="1" min={type === 'adjustment' ? undefined : '1'} value={quantity} onChange={(e) => setQuantity(e.target.value)} required /></label><label>Nota <small>Opcional</small><input value={note} onChange={(e) => setNote(e.target.value)} maxLength="300" placeholder="Compra a proveedor, merma..." /></label>{message && <div className="form-message">{message}</div>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button">Registrar movimiento</button></div></form></section></div>;
}

function Inventory({ session, onLogout }) {
  const [products, setProducts] = useState([]); const [summary, setSummary] = useState({ totalProducts: 0, totalUnits: 0, lowStockProducts: 0, inventoryValue: 0 }); const [search, setSearch] = useState(''); const [lowStock, setLowStock] = useState(false); const [modal, setModal] = useState(null); const [message, setMessage] = useState('');
  async function loadProducts() { try { const params = new URLSearchParams(); if (search) params.set('search', search); if (lowStock) params.set('lowStock', 'true'); const data = await apiRequest(`/products?${params}`); setProducts(data.products); setSummary(data.summary); setMessage(''); } catch (error) { setMessage(error.message); } }
  useEffect(() => { const timer = setTimeout(loadProducts, 250); return () => clearTimeout(timer); }, [search, lowStock]);
  const money = useMemo(() => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }), []);
  async function deactivate(product) { if (!window.confirm(`¿Desactivar “${product.name}”? Su historial se conservará.`)) return; try { await apiRequest(`/products/${product.id}`, { method: 'DELETE' }); await loadProducts(); } catch (error) { setMessage(error.message); } }
  const saved = async () => { setModal(null); await loadProducts(); };
  return <div className="app-layout"><aside className="sidebar"><div className="brand light"><span>G</span><b>Gestión</b></div><nav><button className="active"><span>▦</span> Productos</button><button disabled><span>◎</span> Clientes <small>Pronto</small></button><button disabled><span>↗</span> Ventas <small>Pronto</small></button><button disabled><span>◇</span> Gastos <small>Pronto</small></button></nav><div className="account"><div className="avatar">{session.user.name?.[0]?.toUpperCase()}</div><div><strong>{session.user.name}</strong><small>{session.business.name}</small></div><button onClick={onLogout} title="Cerrar sesión">↪</button></div></aside><main className="content"><header className="page-header"><div><span className="eyebrow">Catálogo e inventario</span><h1>Productos</h1><p>Controla tu catálogo, existencias y alertas de reposición.</p></div><button className="primary-button" onClick={() => setModal({ type: 'product' })}>＋ Nuevo producto</button></header><section className="metrics"><article><span>Productos activos</span><strong>{summary.totalProducts}</strong></article><article><span>Unidades en stock</span><strong>{summary.totalUnits}</strong></article><article className={summary.lowStockProducts ? 'warning' : ''}><span>Stock bajo</span><strong>{summary.lowStockProducts}</strong></article><article><span>Valor del inventario</span><strong>{money.format(summary.inventoryValue)}</strong></article></section><section className="table-card"><div className="toolbar"><div className="search"><span>⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre o SKU" /></div><label className="filter-check"><input type="checkbox" checked={lowStock} onChange={(e) => setLowStock(e.target.checked)} /> Solo stock bajo</label></div>{message && <div className="form-message">{message}</div>}{!products.length ? <div className="empty-state"><div>□</div><h2>{search || lowStock ? 'No encontramos coincidencias' : 'Tu catálogo está listo para empezar'}</h2><p>{search || lowStock ? 'Prueba cambiando la búsqueda o los filtros.' : 'Agrega tu primer producto y comienza a controlar el inventario.'}</p>{!search && !lowStock && <button className="primary-button" onClick={() => setModal({ type: 'product' })}>Crear primer producto</button>}</div> : <div className="table-scroll"><table><thead><tr><th>Producto</th><th>SKU</th><th>Precio</th><th>Stock</th><th>Estado</th><th></th></tr></thead><tbody>{products.map((product) => { const isLow = product.stock <= product.minimumStock; return <tr key={product.id}><td><div className="product-cell"><span>{product.name[0].toUpperCase()}</span><div><strong>{product.name}</strong><small>{product.description || 'Sin descripción'}</small></div></div></td><td><code>{product.sku || '—'}</code></td><td>{money.format(product.price)}</td><td><button className="stock-button" onClick={() => setModal({ type: 'stock', product })}><strong>{product.stock}</strong><small> mín. {product.minimumStock}</small></button></td><td><span className={`badge ${isLow ? 'low' : 'ok'}`}>{isLow ? 'Stock bajo' : 'Disponible'}</span></td><td><div className="row-actions"><button onClick={() => setModal({ type: 'product', product })}>Editar</button><button className="danger" onClick={() => deactivate(product)}>Desactivar</button></div></td></tr>; })}</tbody></table></div>}</section></main>{modal?.type === 'product' && <ProductModal product={modal.product} onClose={() => setModal(null)} onSaved={saved} />}{modal?.type === 'stock' && <StockModal product={modal.product} onClose={() => setModal(null)} onSaved={saved} />}</div>;
}

export default function App() {
  const [session, setSession] = useState(null); const [loading, setLoading] = useState(true);
  useEffect(() => { if (!localStorage.getItem('token')) { setLoading(false); return; } apiRequest('/auth/me').then(setSession).catch(() => localStorage.removeItem('token')).finally(() => setLoading(false)); }, []);
  if (loading) return <main className="loading-screen"><div className="brand"><span>G</span> Gestión Negocios</div><p>Cargando tu negocio…</p></main>;
  if (!session) return <AuthScreen onAuthenticated={setSession} />;
  return <Inventory session={session} onLogout={() => { localStorage.removeItem('token'); setSession(null); }} />;
}
