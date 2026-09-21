# Estágio de Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src/ ./src/
RUN npm run build

# Estágio de Execução em Nuvem (AWS ECS / Docker)
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
COPY public/ ./public/
COPY schema.sql ./schema.sql

EXPOSE 3000
CMD ["node", "dist/server.js"]
