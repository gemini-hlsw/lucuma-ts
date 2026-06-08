# Base image with Node.js and pnpm and a custom user
FROM node:24-alpine AS base

# Create app directory
WORKDIR /usr/src/app
RUN apk add --no-cache openssl

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

# Create volume for DB initialization
RUN mkdir /usr/src/app/dbinit

# Create software user
RUN addgroup -S software -g 3624 && adduser -S software -u 3624 -G software
RUN chown -R software:software /usr/src/app
USER software

# Add pnpm
COPY --chown=software:software ./package.json ./package.json
ENV COREPACK_DEFAULT_TO_LATEST=0
RUN corepack install

FROM base AS build
COPY --chown=software:software . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm --filter "@gemini-hlsw/navigate-configs" ci --prefer-offline
RUN pnpm configs build
RUN pnpm deploy --filter=navigate-configs --prod pruned
# Add pnpm to packageManager field
RUN PNPM_VERSION="$(pnpm -v)" && cd pruned && npm pkg set packageManager="pnpm@$PNPM_VERSION"

# Final image
FROM base
ENV NODE_ENV=production
# ENV COREPACK_ENABLE_NETWORK=0

# Copy built files
COPY --from=build --chown=software:software /usr/src/app/pruned /usr/src/app
RUN pnpm prisma generate

ENV PORT=4000
EXPOSE 4000

HEALTHCHECK --start-period=2s CMD ["./tasks/healthcheck.js"]

# Start command
CMD ["pnpm", "production"]
