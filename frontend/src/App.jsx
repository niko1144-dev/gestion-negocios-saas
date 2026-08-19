import { useEffect, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

function App() {
  const [status, setStatus] = useState('Comprobando API...');
  const [mode, setMode] = useState('register');
  const [message, setMessage] = useState('');
  const [session, setSession] = useState(null);
  const [form, setForm] = useState({
    businessName: '',
    name: '',
    email: '',
    password: '',
  });

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'API no disponible');
        setStatus(`API ${data.api} · Base de datos ${data.database}`);
      })
      .catch(() => setStatus('API no disponible o PostgreSQL sin configurar'));

    const token = localStorage.getItem('token');
    if (token) loadSession(token);
  }, []);

  async function loadSession(token) {
    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setSession(data);
    } catch {
      localStorage.removeItem('token');
      setSession(null);
    }
  }

  function updateField(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('Procesando...');

    const endpoint = mode === 'register' ? 'register' : 'login';
    const payload = mode === 'register'
      ? form
      : { email: form.email, password: form.password };

    try {
      const response = await fetch(`${API_URL}/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'No se pudo completar la solicitud.');

      localStorage.setItem('token', data.token);
      setSession({ user: data.user, business: data.business });
      setMessage('');
    } catch (error) {
      setMessage(error.message);
    }
  }

  function logout() {
    localStorage.removeItem('token');
    setSession(null);
    setMessage('');
  }

  return (
    <main className="page-shell">
      <section className="hero-card">
        <span className="eyebrow">MVP SaaS</span>
        <h1>Gestión Negocios</h1>
        <p>
          Plataforma multiempresa para administrar inventario, clientes, ventas,
          gastos y reportes desde un solo lugar.
        </p>
        <div className="status-box">{status}</div>

        {session ? (
          <div className="session-card">
            <h2>Sesión iniciada</h2>
            <p><strong>{session.user.name}</strong> · {session.user.email}</p>
            <p>Negocio: <strong>{session.business.name}</strong></p>
            <p>Rol: {session.user.role}</p>
            <button type="button" onClick={logout}>Cerrar sesión</button>
          </div>
        ) : (
          <div className="auth-card">
            <div className="auth-tabs">
              <button
                type="button"
                className={mode === 'register' ? 'active' : ''}
                onClick={() => { setMode('register'); setMessage(''); }}
              >
                Crear cuenta
              </button>
              <button
                type="button"
                className={mode === 'login' ? 'active' : ''}
                onClick={() => { setMode('login'); setMessage(''); }}
              >
                Iniciar sesión
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {mode === 'register' && (
                <>
                  <label>
                    Nombre del negocio
                    <input name="businessName" value={form.businessName} onChange={updateField} required />
                  </label>
                  <label>
                    Tu nombre
                    <input name="name" value={form.name} onChange={updateField} required />
                  </label>
                </>
              )}
              <label>
                Correo electrónico
                <input name="email" type="email" value={form.email} onChange={updateField} required />
              </label>
              <label>
                Contraseña
                <input name="password" type="password" minLength="8" value={form.password} onChange={updateField} required />
              </label>
              <button type="submit">
                {mode === 'register' ? 'Crear negocio' : 'Entrar'}
              </button>
              {message && <div className="form-message">{message}</div>}
            </form>
          </div>
        )}
      </section>
    </main>
  );
}

export default App;
