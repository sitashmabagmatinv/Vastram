# Vastram

Vastram is a single-boutique full-stack web app for bespoke tailoring operations in Kathmandu. It implements the project report stack and scope: React 18, Node.js 20, Express 4, MySQL 8, JWT authentication, and role-based access control.

## Modules

- Admin, staff, and customer authentication with JWT/RBAC.
- Digital customer measurement profiles.
- Visual order lifecycle tracking.
- Fabric inventory with low-stock alerts.
- Clothes catalog with customer order requests for in-stock boutique pieces.
- Mobile-first, icon-led interface inspired by Zellerfeld-style commerce layouts using original Vastram content.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a MySQL database and load the schema:

```bash
mysql -u root -p < database/schema.sql
```

3. Configure the server:

```bash
cp server/.env.example server/.env
```

4. Seed demo data:

```bash
npm run seed
```

5. Run the API and client in two terminals:

```bash
npm run dev
```

During local development the React app calls `/api/*` and Vite proxies those requests to `http://127.0.0.1:4000`, so registration and login work from both `http://localhost:5173` and the Vite network URL.

Default seeded accounts:

- Admin: `admin@vastram.local` / `Admin@123`
- Staff: `staff@vastram.local` / `Staff@123`
- Customer: `customer@vastram.local` / `Customer@123`

## Production Prep

- Copy `server/.env.production.example` into your hosting provider's environment variables.
- Replace `JWT_SECRET` with a strong private value.
- Set `CLIENT_ORIGIN` to the deployed frontend URL.
- Import `database/schema.sql` into production MySQL.
- Run `npm run check` before deployment.
- Run `npm run smoke` after deployment.

Full deployment notes are in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
