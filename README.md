# lucuma-ts

This repository is a [monorepo](https://monorepo.tools/) for projects written in TypeScript supporting libs and apps of GPP. It contains the following projects:

### apps

- [navigate-ui](./packages/ui): Web UI used to configure the telescope and its subsystems Navigate UI, written in React.
- [navigate-configs](./packages/configs): Backend api to manage configurations database using TypeScript, Graphql and Prisma.
- [resource-ui](./packages/resource): Web UI for Resource, written in React.

### libs

- [common-ui](./packages/common-ui/): Shared code between `navigate-ui` and `resource-ui`
- [e2e](./packages/e2e): end-to-end tests for navigate. Running `navigate-ui`, `navigate-configs` and a [navigate-server](https://github.com/gemini-hlsw/lucuma-apps/blob/main/navigate/README.md) docker image

# Running a docker Navigate instance (Production and Staging)

You can install a navigate cluster using the installation script provided in the deploy directory and in [this link](https://raw.githubusercontent.com/gemini-hlsw/navigate-ts/refs/heads/main/deploy/install.sh).

IMPORTANT!
A running docker service is required to install navigate, the user installing navigate should have permissions to run docker commands. Also, the docker images are hoster under `noirlab` organization, so the `nlsoftware` user should be used to pull docker images, which requires a `docker login`,

After running the install.sh script, the `navigate` command will be enabled to `start`, `stop` and `update` the cluster. For more information try the command `navigate help`.

This snippet can be used in order to run the `install.sh` script.

```bash
curl https://raw.githubusercontent.com/gemini-hlsw/navigate-ts/refs/heads/main/deploy/install.sh >install.sh
chmod +x install.sh
./install.sh
```

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
