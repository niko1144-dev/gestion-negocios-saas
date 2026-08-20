# Gestión Negocios SaaS

Sistema web SaaS para la gestión de pequeños negocios.

## Objetivo

Construir una plataforma multiempresa que permita administrar productos, inventario, clientes, ventas, gastos y reportes desde una interfaz web responsive.

## MVP

- Registro e inicio de sesión
- Gestión de negocios y usuarios
- Productos e inventario
- Clientes
- Ventas
- Gastos
- Dashboard con indicadores
- Alertas de stock
- Reportes

## Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Base de datos: PostgreSQL
- Autenticación: JWT

## Ejecutar en local

### 1. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Antes de iniciar, crea una base PostgreSQL llamada `gestion_negocios` o modifica `DATABASE_URL` en `backend/.env`.

Aplica el esquema inicial y sus nuevas tablas sobre la base configurada:

```bash
psql "$DATABASE_URL" -f src/db/schema.sql
```

La API queda disponible en `http://localhost:4000/api` y el health check en `http://localhost:4000/api/health`.

### 2. Frontend

En otra terminal:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

El frontend queda disponible normalmente en `http://localhost:5173`.

## Módulos disponibles

- Registro, inicio de sesión y recuperación de sesión mediante JWT
- Separación multiempresa basada en el `business_id` del usuario autenticado
- Catálogo de productos con SKU, precios, costos y stock mínimo
- Entradas, salidas y ajustes de inventario con historial auditable
- Búsqueda de productos, alertas de stock bajo y resumen valorizado

## Pruebas

```bash
cd backend
npm test

cd ../frontend
npm run build
```
