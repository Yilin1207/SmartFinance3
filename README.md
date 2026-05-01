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

## Useful Scripts

```bash
npm run dev
npm run check
```

## GitHub Notes

Do not commit `.env` or `node_modules`. Commit `package-lock.json` together with `package.json` so other developers get the same dependency versions.
