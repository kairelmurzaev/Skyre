FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json ./
COPY index.html style.css app.js core.js workers.js routing.js logistics.js scene.js ./
COPY server/ ./server/
ENV PORT=3000 DATABASE_PATH=/data/skyre.db NODE_ENV=production
RUN mkdir -p /data && chown -R node:node /data /app
USER node
EXPOSE 3000
CMD ["node", "server/index.js"]
