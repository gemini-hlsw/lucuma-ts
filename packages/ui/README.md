# Navigate website

Website developed using [React](https://reactjs.org/) + Typescript.

This tool will be used to configure the telescope and its subsystems to point and track a celestial object during an observation. Navigate is a web application with a single centralized server that communicates with the different real-time control systems of the telescope. It also will communicate with other apps in the Gemini Program Platform (GPP) ecosystem, such as Observe and Chronicle.

## Launch on local development

Make sure you have installed [NodeJS](https://nodejs.org/en/) and [ni](https://github.com/antfu/ni) in your machine.

```bash
$ corepack enable
```

We are now using FontAwesome Pro which requires a license. To build the app locally request a TOKEN
from the admins and you need to setup the registry access like:

```bash
$ pnpm config set "//npm.fontawesome.com/:_authToken" "$FONTAWESOME_NPM_AUTH_TOKEN"
```

- Install dependencies

  ```bash
  pnpm install
  ```

- Run the web app
  ```bash
  pnpm dev
  ```

## Test modules

Some project modules can be tested using vitest

- Run vitest
  ```bash
  pnpm vitest
  ```

## Navigate backend

To connect to the Navigate backend [this repository](https://github.com/gemini-hlsw/lucuma-apps) should be cloned and run. The project was developed using Scala, then a proper Scala and sbt installation should be provided.

In the repository directory run

```bash
export SITE=GN
sbt '~navigate_web_server/reStart'
```
