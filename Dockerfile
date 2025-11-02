FROM node:18-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --production=false --silent
COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/dist ./dist
RUN npm ci --production --silent
ENV NODE_ENV=production
EXPOSE 5174
CMD ["node", "dist/index.js"]
