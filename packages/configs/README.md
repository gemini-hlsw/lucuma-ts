# Navigate configs

Backend api to manage configurations database using TypeScript, Graphql and Prisma.

## Launch on local development

Make sure you have installed [NodeJS](https://nodejs.org/en/) in your machine.

## Install and start

To install needed dependencies you can use PNPM. You can enable it with [corepack](https://nodejs.org/api/corepack.html) by running the following command:

```bash
$ npm install -g corepack && corepack enable
```

### Using PNPM

- Install dependencies
  ```bash
  pnpm install
  ```
- Create a env file:
  ```env
  SERVER_PORT=4000
  DATABASE_URL=postgresql://jimmy:banana@localhost:5432/configs
  ```
- Run the web app
  ```bash
  pnpm run dev
  ```

### Prisma

A postgresql database instance is needed to run this project.

The database should be named `configs` and using prisma its schema can be created using the following commands:

```bash
pnpm prisma generate
pnpm prisma migrate dev
```

#### ERD

![Database Diagram](./prisma-erd.svg)
