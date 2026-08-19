import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

function signToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      businessId: user.business_id,
      role: user.role,
      email: user.email,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' },
  );
}

router.post('/register', async (req, res) => {
  const { businessName, name, email, password } = req.body;

  if (!businessName || !name || !email || !password) {
    return res.status(400).json({ message: 'Todos los campos son obligatorios.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ message: 'La contraseña debe tener al menos 8 caracteres.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existing = await client.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existing.rowCount > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'Ya existe una cuenta con ese correo.' });
    }

    const businessResult = await client.query(
      'INSERT INTO businesses (name) VALUES ($1) RETURNING id, name',
      [businessName.trim()],
    );

    const passwordHash = await bcrypt.hash(password, 12);
    const userResult = await client.query(
      `INSERT INTO users (business_id, name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, 'owner')
       RETURNING id, business_id, name, email, role, created_at`,
      [businessResult.rows[0].id, name.trim(), normalizedEmail, passwordHash],
    );

    await client.query('COMMIT');

    const user = userResult.rows[0];
    const token = signToken(user);

    return res.status(201).json({
      token,
      user,
      business: businessResult.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    return res.status(500).json({ message: 'No se pudo crear la cuenta.' });
  } finally {
    client.release();
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Correo y contraseña son obligatorios.' });
  }

  try {
    const result = await pool.query(
      `SELECT u.id, u.business_id, u.name, u.email, u.password_hash, u.role,
              b.name AS business_name
       FROM users u
       JOIN businesses b ON b.id = u.business_id
       WHERE u.email = $1`,
      [email.trim().toLowerCase()],
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ message: 'Credenciales incorrectas.' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ message: 'Credenciales incorrectas.' });
    }

    const token = signToken(user);

    return res.json({
      token,
      user: {
        id: user.id,
        businessId: user.business_id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      business: {
        id: user.business_id,
        name: user.business_name,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo iniciar sesión.' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.business_id, u.name, u.email, u.role, u.created_at,
              b.name AS business_name
       FROM users u
       JOIN businesses b ON b.id = u.business_id
       WHERE u.id = $1 AND u.business_id = $2`,
      [req.auth.userId, req.auth.businessId],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    const user = result.rows[0];
    return res.json({
      user: {
        id: user.id,
        businessId: user.business_id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.created_at,
      },
      business: {
        id: user.business_id,
        name: user.business_name,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo obtener la sesión.' });
  }
});

export default router;
