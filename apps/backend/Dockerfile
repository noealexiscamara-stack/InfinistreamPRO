# Build context MUST be the monorepo root, not apps/backend — the backend
# depends on the @infiny-stream/types workspace package, and npm workspaces
# needs the whole tree to resolve it. Build with:
#   docker build -f apps/backend/Dockerfile -t infiny-stream-backend .
# (docker-compose.yml at the repo root already sets this up correctly.)

# ---- deps + build ----
FROM node:20-slim AS builder
WORKDIR /repo

# Copy every workspace's package.json first (not the source) so Docker can
# cache `npm ci` across builds as long as no dependency changed.
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/config/package.json packages/config/package.json

# Installs only apps/backend's dependency subtree (its own deps + the local
# @infiny-stream/types workspace) — skips React Native/Expo entirely, which
# keeps this image small and the install fast. Verified against this repo's
# package-lock.json: ~700 packages instead of ~1250 for a full install.
RUN npm ci --workspace=apps/backend --include-workspace-root=true

# Now bring in the actual source for what got installed above.
COPY apps/backend apps/backend
COPY packages/types packages/types

RUN npm run build --workspace=apps/backend

# ---- runtime ----
FROM node:20-slim AS runtime
WORKDIR /repo
ENV NODE_ENV=production

COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/package.json ./package.json
COPY --from=builder /repo/apps/backend/package.json ./apps/backend/package.json
COPY --from=builder /repo/apps/backend/dist ./apps/backend/dist
COPY --from=builder /repo/packages/types ./packages/types

EXPOSE 3000
CMD ["node", "apps/backend/dist/main.js"]
