FROM node:20-alpine AS builder
WORKDIR /app

# NEXT_PUBLIC_API_URL is OPTIONAL: unset (default) = same-origin mode, the
# browser calls this server and Next proxies /api/v1/* to API_INTERNAL_URL.
# Set it only to call the API directly from the browser (bypasses proxy).
ARG NEXT_PUBLIC_API_URL=""
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
# Runtime target for the same-origin proxy (server-side, not baked in).
ENV API_INTERNAL_URL=http://localhost:8000

COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/next.config.js ./next.config.js

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["npm", "start", "--", "--port", "3000", "--hostname", "0.0.0.0"]
