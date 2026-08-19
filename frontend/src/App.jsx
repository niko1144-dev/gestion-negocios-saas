import { useEffect, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

function App() {
  const [status, setStatus] = useState('Comprobando API...');

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'API no disponible');
        setStatus(`API ${data.api} · Base de datos ${data.database}`);
      })
      .catch(() => setStatus('API no disponible o PostgreSQL sin configurar'));
  }, []);

  return (
    <main className="page-shell">
      <section className="hero-card">
        <span className="eyebrow">MVP SaaS</span>
        <h1>Gestión Negocios</h1>
        <p>
          Plataforma para administrar inventario, clientes, ventas, gastos y reportes
          desde un solo lugar.
        </p>
        <div className="status-box">{status}</div>
      </section>
    </main>
  );
}

export default App;
