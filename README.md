# SmartFinance

SmartFinance is a Node.js and Express website with authentication, PostgreSQL storage, contact requests, newsletter subscriptions, and a portfolio workspace.

## Tech Stack

- Node.js
- Express
- PostgreSQL
- Plain HTML, CSS and JavaScript

## Project Structure

```text
.
+-- db/                 # PostgreSQL connection and SQL schema
+-- img/                # Static images served from /img
+-- public/             # Frontend pages, CSS and browser scripts
+-- server.js           # Main Express server and API routes
+-- package.json        # npm scripts and dependencies
+-- .env.example        # Example local environment variables
+-- vercel.json         # Vercel deployment config
+-- .gitignore          # Files excluded from Git
```

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create your local environment file:

```bash
cp .env.example .env
```

3. Update `.env` with your PostgreSQL username, password and database name.

4. Start the server:

```bash
npm start
```

The site will run at `http://localhost:3000`.

## Database

The server creates the required tables automatically on startup. You can also inspect the schema in `db/init.sql`.

For Vercel, use a hosted PostgreSQL database such as Supabase, Neon or Vercel Postgres. Add its connection string in the Vercel project settings as `DATABASE_URL`.

For Supabase, use the pooler connection string from Project Settings > Database > Connection string. It should look similar to `postgresql://postgres.project-ref:password@aws-0-region.pooler.supabase.com:6543/postgres?sslmode=require`.

Without `DATABASE_URL`, Vercel can still load static pages, but auth, portfolio, contacts and newsletter API requests will return a database unavailable response.

### Supabase + Vercel checklist

1. Create a Supabase project at `https://supabase.com`.
2. Open the project dashboard and go to `Connect` or `Project Settings > Database`.
3. Copy the pooled PostgreSQL connection string. For Vercel/serverless, prefer the transaction pooler URL on port `6543`.
4. Replace `[YOUR-PASSWORD]` in that URL with the database password you created for the Supabase project.
5. In Vercel, open your project, then `Settings > Environment Variables`.
6. Add `DATABASE_URL` with the Supabase connection string. Select `Production` and `Preview` if you use both.
7. Optional: add `DB_POOL_MAX` with value `5`.
8. Redeploy the Vercel project. Environment variable changes only affect new deployments.
9. Open `/register.html` and create an account. The app will create its PostgreSQL tables automatically on the first API request.

## Useful Scripts

```bash
npm run dev
npm run check
```

## GitHub Notes

Do not commit `.env` or `node_modules`. Commit `package-lock.json` together with `package.json` so other developers get the same dependency versions.
