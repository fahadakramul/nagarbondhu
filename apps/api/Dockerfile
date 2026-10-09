FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/api/package*.json ./apps/api/

RUN npm ci --include=dev --workspace=@nagarbondhu/shared --workspace=@nagarbondhu/api

COPY packages/shared/ ./packages/shared/
COPY apps/api/ ./apps/api/

RUN npm --prefix packages/shared run build
RUN npm --prefix apps/api run build

FROM node:20-alpine AS runner

WORKDIR /app

COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/api/package*.json ./apps/api/

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/public ./apps/api/public

EXPOSE 5000

CMD ["npm", "--prefix", "apps/api", "run", "start:render"]
