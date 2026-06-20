# ---- Backend : Express + PostgreSQL ----
FROM node:20-alpine

WORKDIR /app

# Dépendances d'abord (cache Docker optimal)
COPY package*.json ./
RUN npm ci --omit=dev

# Code applicatif (node_modules / .env exclus via .dockerignore)
COPY . .

ENV NODE_ENV=production \
    PORT=3001

EXPOSE 3001

# Healthcheck : l'API doit répondre sur /api/health
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

# Le serveur initialise le schéma + bootstrap admin/examens au démarrage
CMD ["node", "server.js"]
