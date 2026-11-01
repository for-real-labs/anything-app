FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY *.mjs ./
ENV NODE_ENV=production
CMD ["node","index.mjs"]
