# Vastram Deployment Guide

This guide prepares Vastram for a real hosted environment. The app has three deployable parts:

- React frontend from `client/`
- Express API from `server/`
- MySQL database using `database/schema.sql`

## 1. Production Environment

Create production variables using [server/.env.production.example](../server/.env.production.example).

Required values:

```env
NODE_ENV=production
CLIENT_ORIGIN=https://your-frontend-domain.example
JWT_SECRET=long-random-secret
DB_HOST=your-production-mysql-host
DB_PORT=3306
DB_USER=your-production-db-user
DB_PASSWORD=your-production-db-password
DB_NAME=vastram
```

Generate a strong JWT secret:

```bash
openssl rand -hex 32
```

## 2. Database Setup

Create a MySQL 8 database, then import:

```bash
mysql -h <host> -P 3306 -u <user> -p < database/schema.sql
npm run seed
```

For production, change or remove demo passwords after first login.

## 3. Backend Deployment

Backend service settings:

```bash
npm install
npm run start --workspace server
```

Set the service root to the repository root and provide the production env variables.

Health endpoint:

```txt
/api/health
```

## 4. Frontend Deployment

Build command:

```bash
npm install
npm run build
```

Publish directory:

```txt
client/dist
```

If the frontend and backend are on different domains, set `CLIENT_ORIGIN` in the API to the frontend URL.

If the frontend host does not proxy `/api` to the backend, set a production API URL before building:

```env
VITE_API_URL=https://your-api-domain.example/api
```

## 5. Smoke Test

After deployment:

```bash
SMOKE_BASE_URL=https://your-frontend-domain.example npm run smoke
```

For API-only smoke testing, point `SMOKE_BASE_URL` at the backend host if it serves `/api/*`.

## 6. Backups

Run manual backup:

```bash
DB_HOST=127.0.0.1 DB_USER=vastram_user DB_PASSWORD='Vastram@123' DB_NAME=vastram ./scripts/backup-mysql.sh
```

For production, schedule this daily with cron or your host's scheduled jobs. Store backups outside the server where the app runs.

## 7. Pre-Launch Checklist

- Replace `JWT_SECRET`.
- Use real production database credentials.
- Use HTTPS.
- Set `CLIENT_ORIGIN` to the real frontend URL.
- Run `npm run check`.
- Run `npm run smoke`.
- Confirm admin/staff/customer workflows.
- Confirm database backup works.
- Change seeded demo passwords.
