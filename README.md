# NestJS Starter Pack

[![CI](https://github.com/Apu-Emdad/nestjs-starter-pack/actions/workflows/ci.yml/badge.svg)](https://github.com/Apu-Emdad/nestjs-starter-pack/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A NestJS API starter with authentication, users and roles already built, so a new project starts with features instead of boilerplate. It runs with one command in Docker and comes with tests and CI.

## Features

- **Auth:** register and log in with username or email. Short-lived JWT access tokens, and rotating refresh tokens in an `httpOnly` cookie, tracked in Redis. Reusing an old refresh token revokes all of that user's sessions.
- **Roles:** `USER` and `SUPER_ADMIN`, with `@Public()` and `@Roles()` decorators and global guards. Every route needs a login unless it is marked public.
- **User management:** list, search, filter, deactivate and delete users (super admin only).
- **One response shape:** every response, success or error, is `{ status, message, data?, error?, context? }`. A global filter turns every thrown error into that shape and logs unexpected ones.
- **Safe ids:** each row has an internal integer `id` and a random 10-character `uid`. Only the `uid` leaves the API.
- **Validated config:** `.env` is checked on startup; the app exits with a list of the missing or invalid variables.
- **API docs:** Swagger UI at `/docs`, with saved login and pinned tags.
- **Docker:** a multi-stage Dockerfile and a Compose file that starts PostgreSQL, Redis, runs migrations and the seed, then starts the API.
- **Quality:** unit and end-to-end tests with Vitest, oxlint, Prettier and a GitHub Actions workflow.

## Tech stack

| Area             | Tools                                            |
| ---------------- | ------------------------------------------------ |
| Runtime          | Node.js 24, TypeScript                           |
| Framework        | NestJS 12                                        |
| Database         | PostgreSQL 18, Prisma 7                          |
| Cache and tokens | Redis 8                                          |
| Auth             | JWT, Argon2 password hashing                     |
| Testing          | Vitest, Supertest                                |
| Tooling          | Yarn 4, oxlint, Prettier, GitHub Actions, Docker |

## Quick start

You only need [Docker](https://docs.docker.com/get-docker/).

```bash
git clone https://github.com/Apu-Emdad/nestjs-starter-pack.git my-api
cd my-api
cp .env.example .env
docker compose up --build
```

This starts PostgreSQL, Redis and the API, applies the database migrations and creates the first super admin from `.env`. Press Ctrl+C to stop everything.

|                    | URL                            |
| ------------------ | ------------------------------ |
| API                | `http://localhost:3000`        |
| API docs (Swagger) | `http://localhost:3000/docs`   |
| Health check       | `http://localhost:3000/health` |

Log in at `POST /auth/login` with the super admin from `.env` (`SUPER_ADMIN_USER_NAME`, `SUPER_ADMIN_PASSWORD`). Change the secrets and the super admin password in `.env` before using it anywhere other than your own machine.

## Using this template

Click **Use this template** on GitHub, or clone it as above. Then rename the project:

| What                   | Where                                                               |
| ---------------------- | ------------------------------------------------------------------- |
| Package name           | `name` and `description` in `package.json`                          |
| Compose project        | `name` and every `container_name` / `image` in `docker-compose.yml` |
| Database name and user | `POSTGRES_*` and `DATABASE_URL` in `.env.example`                   |
| API docs title         | `setTitle` and `setDescription` in `src/main.ts`                    |
| Docs and license       | This README, `docs/`, and the copyright line in `LICENSE`           |

Run `yarn install` afterwards so `yarn.lock` picks up the new package name.

## Development

To run the API on your machine with hot reload, you need Node.js 24 and Corepack for Yarn 4. The full guide is in [docs/local-setup.md](docs/local-setup.md).

```bash
nvm use
yarn install
cp .env.example .env
docker compose up -d --wait postgres redis
yarn migrate:deploy
yarn db:seed
yarn dev
```

### Scripts

| Command               | What it does                                           |
| --------------------- | ------------------------------------------------------ |
| `yarn dev`            | Start the API in watch mode                            |
| `yarn build`          | Generate the Prisma client and compile to `dist/`      |
| `yarn lint`           | Run oxlint                                             |
| `yarn typecheck`      | Type-check the whole project                           |
| `yarn test`           | Run unit tests                                         |
| `yarn test:e2e`       | Run end-to-end tests                                   |
| `yarn test:cov`       | Run unit tests with coverage                           |
| `yarn migrate:dev`    | Create and apply a migration after changing the schema |
| `yarn migrate:deploy` | Apply pending migrations                               |
| `yarn db:seed`        | Create the first super admin                           |

## API

| Endpoint                       | Access         | What it does                                      |
| ------------------------------ | -------------- | ------------------------------------------------- |
| `POST /auth/register`          | Public         | Create a `USER` account and log in                |
| `POST /auth/login`             | Public         | Log in with username or email                     |
| `POST /auth/refresh`           | Refresh cookie | Get a new access token; rotates the refresh token |
| `POST /auth/logout`            | Refresh cookie | Revoke the refresh token and clear the cookie     |
| `GET /auth/me`                 | Logged in      | The current user                                  |
| `GET /users`                   | Super admin    | List users, with search, role and status filters  |
| `GET /users/:uid`              | Super admin    | One user                                          |
| `PATCH /users/deactivate/:uid` | Super admin    | Deactivate a user and revoke their sessions       |
| `DELETE /users/:uid`           | Super admin    | Delete a user and revoke their sessions           |
| `GET /health`                  | Public         | Health check                                      |

Full request and response details are in Swagger at `/docs`.

## Project structure

```
src/
  common/       decorators, error filter and logger, Result interface, constants
  config/       environment validation
  health/       health check
  modules/
    auth/       register, login, refresh tokens, guards
    users/      user management
  prisma/       Prisma client as a Nest service
  redis/        Redis client as a Nest service
  swagger/      Swagger UI tweaks
prisma/
  schema.prisma database schema (roles, users)
  migrations/   SQL migrations
  seed.ts       creates the first super admin
test/           end-to-end tests
```

## Documentation

- [Local setup](docs/local-setup.md): running the project, services and ports
- [Database schema](docs/schema.md): tables, conventions and how to add a table

## License

[MIT](LICENSE) © Emdadul Haque Apu
