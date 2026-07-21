FROM dhi.io/node:26-alpine-dev AS build
WORKDIR /usr/src/app
RUN apk add --no-cache openssl

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV COREPACK_DEFAULT_TO_LATEST=0

RUN corepack enable
COPY ./package.json ./package.json
RUN corepack install && pnpm config set trustLockfile true

COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  pnpm --filter "@gemini-hlsw/navigate-configs" ci --prefer-offline
RUN pnpm configs build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  pnpm deploy --filter=navigate-configs --prod pruned

FROM dhi.io/node:26-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /usr/src/app

# Copy openssl for Prisma
COPY --from=build /usr/lib/libssl.so.3 /usr/lib/libcrypto.so.3 /usr/lib/

# Copy built files
COPY --from=build --chown=1000:1000 /usr/src/app/pruned /usr/src/app

ENV PORT=4000
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 CMD ["node", "./tasks/healthcheck.js"]

# Start command
CMD ["node", "--enable-source-maps", "./tasks/start-production.js"]
