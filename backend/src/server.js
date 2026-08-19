import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { checkDatabaseConnection } from './config/db.js';
import authRoutes from './routes/auth.routes.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

app.get('/api/health', async (_req, res) => {
  try {
    await checkDatabaseConnection();
    res.json({ status: 'ok', api: 'online', database: 'connected' });
  } catch (error) {
    res.status(503).json({
      status: 'degraded',
      api: 'online',
      database: 'disconnected',
      message: error.message,
    });
  }
});

app.get('/api', (_req, res) => {
  res.json({
    name: 'Gestion Negocios SaaS API',
    version: '0.2.0',
  });
});

app.use('/api/auth', authRoutes);

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
