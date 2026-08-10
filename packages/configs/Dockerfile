FROM node:26-alpine AS base

WORKDIR /usr/src/app
RUN apk add --no-cache openssl

FROM base AS build

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV COREPACK_DEFAULT_TO_LATEST=0

RUN npm i -g corepack && corepack enable

# Create software user
RUN addgroup -S software -g 3624 && adduser -S software -u 3624 -G software
RUN chown -R software:software /usr/src/app
USER software

COPY --chown=software:software ./package.json ./package.json
RUN corepack install && pnpm config set trustLockfile true

COPY --chown=software:software . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  pnpm --filter "@gemini-hlsw/navigate-configs" ci --prefer-offline
RUN pnpm configs build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  pnpm deploy --filter=navigate-configs --prod pruned

FROM base AS runtime

# Create software user
RUN addgroup -S software -g 3624 && adduser -S software -u 3624 -G software
RUN chown -R software:software /usr/src/app
USER software

ENV NODE_ENV=production

# Copy built files
COPY --from=build --chown=software:software /usr/src/app/pruned /usr/src/app

ENV PORT=4000
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 CMD ["node", "/usr/src/app/tasks/healthcheck.js"]

# Start command
CMD ["node", "--enable-source-maps", "/usr/src/app/tasks/start-production.js"]
