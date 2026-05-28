FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY server.mjs ./server.mjs
COPY data/ielts_curated_words.json ./data/ielts_curated_words.json
COPY data/ielts_5000_words.json ./data/ielts_5000_words.json
EXPOSE 4174
CMD ["npm", "run", "start"]
