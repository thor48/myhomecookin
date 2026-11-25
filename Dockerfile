# syntax=docker/dockerfile:1
# Small production image for Unraid (or any Docker host).

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* values are baked in at build time.
ARG NEXT_PUBLIC_SITE_NAME="My Home Cookin'"
ARG NEXT_PUBLIC_SITE_SHORT_NAME="Home Cookin'"
ENV NEXT_PUBLIC_SITE_NAME=$NEXT_PUBLIC_SITE_NAME \
    NEXT_PUBLIC_SITE_SHORT_NAME=$NEXT_PUBLIC_SITE_SHORT_NAME
# Identifies this release so pages left open from an older one reload
# (see deploymentId in next.config.ts). The workflow passes the commit.
ARG DEPLOYMENT_ID=""
ENV DEPLOYMENT_ID=$DEPLOYMENT_ID
# A fixed server-actions key keeps action IDs the same from release to
# release, so pages left open across a deploy keep working. Passed as a build
# secret (not a build arg) so it isn't in the image's build history. Without
# it, Next makes a new key (and new IDs) every build.
RUN --mount=type=secret,id=actions_key,required=false \
    if [ -s /run/secrets/actions_key ]; then \
      export NEXT_SERVER_ACTIONS_ENCRYPTION_KEY="$(cat /run/secrets/actions_key)"; \
    fi; \
    npm run build

FROM node:24-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
USER app
EXPOSE 3000
# MEALIE_URL is read at runtime — set it on the container.
CMD ["node", "server.js"]
