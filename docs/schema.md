# Database Schema

PostgreSQL, managed with Prisma. `prisma/schema.prisma` implements this design.

## Conventions

- Table and column names are `snake_case`; tables are plural. Prisma models are `PascalCase` singular and map to them with `@@map` / `@map`.
- Every table has two ids: `id bigserial` (auto-increment primary key from Prisma's `autoincrement()`, used by foreign keys and joins) and `uid text default generate_uid()` (a unique 10-character random id from `0-9a-zA-Z`, the only id exposed by the API). `generate_uid()` is a Postgres function created in the `init` migration.
- Timestamps are `timestamp(3)` (no time zone). Prisma always stores them in UTC.
- Fixed value sets are Postgres enums, named in `PascalCase` like their Prisma enums (no `@@map` on enums). Values that grow over time are `text`.
- No soft deletes.

## ER diagram

```mermaid
erDiagram
    roles ||--o{ users : "assigned to"
    users ||--o| employees : "has profile"
    teams ||--o{ employees : "has members"

    roles {
        bigint id PK
        text uid UK
        text name UK
    }
    users {
        bigint id PK
        text uid UK
        text user_name UK
        text email UK
        text password_hash
        bigint role_id FK
    }
    teams {
        bigint id PK
        text uid UK
        text name UK
        Department department
    }
    employees {
        bigint id PK
        text uid UK
        bigint user_id FK
        bigint team_id FK
        text full_name
        int salary
        EmploymentType employment_type
    }
```

## Tables

### `roles`

One row per role. Created by the seed (`yarn db:seed`) with `USER` and `SUPER_ADMIN`; code refers to them through the `ROLE` constant (`src/common/constants/roles.ts`).

| Column             | Type           | Null | Notes                                            |
| ------------------ | -------------- | ---- | ------------------------------------------------ |
| `id`               | `bigint`       | no   | PK, auto-increment (`bigserial`)                 |
| `uid`              | `text`         | no   | Unique, default `generate_uid()` (10 characters) |
| `name`             | `text`         | no   | Unique, e.g. `USER`, `SUPER_ADMIN`               |
| `role_permissions` | `jsonb`        | yes  | Not used yet; always empty                       |
| `created_at`       | `timestamp(3)` | no   | Default `now()`                                  |
| `updated_at`       | `timestamp(3)` | no   | Updated by Prisma                                |

### `users`

| Column          | Type           | Null | Notes                                                                |
| --------------- | -------------- | ---- | -------------------------------------------------------------------- |
| `id`            | `bigint`       | no   | PK, auto-increment (`bigserial`)                                     |
| `uid`           | `text`         | no   | Unique, default `generate_uid()` (10 characters)                     |
| `user_name`     | `text`         | no   | Unique, stored lowercase. 3 to 30 characters: `a-z`, `0-9`, `_`, `-` |
| `email`         | `text`         | no   | Unique, stored lowercase                                             |
| `password_hash` | `text`         | no   | Argon2 hash                                                          |
| `role_id`       | `bigint`       | no   | FK → `roles.id`, on delete restrict. New users get the `USER` role   |
| `is_active`     | `boolean`      | no   | Default `true`                                                       |
| `created_at`    | `timestamp(3)` | no   | Default `now()`                                                      |
| `updated_at`    | `timestamp(3)` | no   | Updated by Prisma                                                    |

### `teams`

Example data for the employees feature, created by the seed. The team dropdown on the employee form reads them through `GET /teams`.

| Column       | Type           | Null | Notes                                            |
| ------------ | -------------- | ---- | ------------------------------------------------ |
| `id`         | `bigint`       | no   | PK, auto-increment (`bigserial`)                 |
| `uid`        | `text`         | no   | Unique, default `generate_uid()` (10 characters) |
| `name`       | `text`         | no   | Unique                                           |
| `department` | `Department`   | no   | `ENGINEERING`, `DESIGN` or `SALES`. Indexed      |
| `created_at` | `timestamp(3)` | no   | Default `now()`                                  |
| `updated_at` | `timestamp(3)` | no   | Updated by Prisma                                |

### `employees`

An employee is a profile on a user account: creating an employee also creates the login.

| Column            | Type             | Null | Notes                                                           |
| ----------------- | ---------------- | ---- | --------------------------------------------------------------- |
| `id`              | `bigint`         | no   | PK, auto-increment (`bigserial`)                                |
| `uid`             | `text`           | no   | Unique, default `generate_uid()` (10 characters)                |
| `user_id`         | `bigint`         | no   | Unique, FK → `users.id`, on delete cascade                      |
| `team_id`         | `bigint`         | no   | FK → `teams.id`, on delete restrict. Indexed                    |
| `full_name`       | `text`           | no   | 3 to 60 characters                                              |
| `bio`             | `text`           | yes  | Up to 300 characters                                            |
| `salary`          | `integer`        | no   | Whole number, per month                                         |
| `skills`          | `text[]`         | no   | Up to 10 items                                                  |
| `employment_type` | `EmploymentType` | no   | `FULL_TIME`, `PART_TIME` or `CONTRACT`                          |
| `join_date`       | `date`           | no   | Not in the future                                               |
| `is_remote`       | `boolean`        | no   | Default `false`                                                 |
| `created_at`      | `timestamp(3)`   | no   | Default `now()`                                                 |
| `updated_at`      | `timestamp(3)`   | no   | Updated by Prisma                                               |

## Design decisions

- **Two ids per row.** The integer `id` keeps primary keys, foreign keys and indexes small and fast. The random `uid` is what the API exposes, so URLs like `/users/:uid` can't be guessed or counted. The integer `id` never leaves the backend.
- **Roles live in their own table.** Each user has exactly one role through `users.role_id`; many users share a role. New roles are added as rows, without a schema change. A role in use can't be deleted (`on delete restrict`). Permissions are not modelled yet.

- **Employees are profiles on users.** The login (user name, email, password hash) stays in `users`, so there is one place for credentials and no email stored twice. Deleting the user removes the profile (`on delete cascade`), and the API deletes an employee by deleting their user.
- **The department comes from the team.** `teams.department` is the only place it is stored, so an employee can't have a department that disagrees with their team. The API takes a `teamUid`, and the department filter reads through the team.

## Adding a table

1. Add the model to `prisma/schema.prisma`, following the conventions above (`id`, `uid` with `@default(dbgenerated("generate_uid()"))`, `@@map` to a plural `snake_case` table).
2. Create the migration with `yarn migrate:dev --create-only --name <name>`, review the SQL, then apply it with `yarn migrate:dev`.
3. Document the table here.
