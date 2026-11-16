# lucuma-ts

This repository is a [monorepo](https://monorepo.tools/) for projects written in TypeScript supporting libs and apps of GPP. It contains the following projects:

### apps

- [navigate-ui](./packages/ui): Web UI used to configure the telescope and its subsystems Navigate UI, written in React.
- [navigate-configs](./packages/configs): Backend api to manage configurations database using TypeScript, Graphql and Prisma.
- [resource-ui](./packages/resource): Web UI for Resource, written in React.
- [admin-ui](./packages/admin-ui): Web UI for the GPP Admin views (Programs, Users, Proposals, Change Requests, Calls for Proposals), written in React.

### libs

- [common-ui](./packages/common-ui/): Shared code between `navigate-ui` and `resource-ui`
- [e2e](./packages/e2e): end-to-end tests for navigate. Running `navigate-ui`, `navigate-configs` and a [navigate-server](https://github.com/gemini-hlsw/lucuma-apps/blob/main/navigate/README.md) docker image

# Running a docker Navigate instance (Production and Staging)

The scripts that install and run a Navigate cluster on the staging and production servers (`install.sh`, the `navigate` command, `docker-compose.yml`) live in [lucuma-deploy](https://github.com/gemini-hlsw/lucuma-deploy/tree/main/servers/navigate), together with the promotion and rollback scripts. See the [README](https://github.com/gemini-hlsw/lucuma-deploy/blob/main/servers/navigate/README.md) there to install or update a server.

## Getting started

Open the VS Code workspace in the root of the repository. You can use the command line or the GUI.

```bash
$ code workspace.code-workspace
```

To install needed dependencies you can use PNPM. You can enable it with [corepack](https://nodejs.org/api/corepack.html) by running the following command:

```bash
$ npm install -g corepack && corepack enable
```

We are now using FontAwesome Pro which requires a license. To build the app locally request a TOKEN
from the admins and you need to setup the registry access like:

```bash
$ pnpm config set "//npm.fontawesome.com/:_authToken" "$FONTAWESOME_NPM_AUTH_TOKEN"
```

```bash
$ pnpm install

$ pnpm ui dev

$ pnpm configs build
$ pnpm configs dev
```

## Publishing

The project is automatically published by [Github actions](./.github/workflows/node.js.yml) when a new tag is pushed. Two docker images are published:

- `noirlab/gpp-nav-configs`: the docker image for navigate-configs.
- `noirlab/gpp-nav`: an extra layer on top of `noirlab/gpp-nav-server`, which adds the UI static files to `/navigate-ui`, so the backend can serve these files.
