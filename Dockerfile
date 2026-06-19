FROM node:22-slim

ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
# bust build cache when static assets change
ARG ASSETS_REV=6

EXPOSE 3000
CMD ["npm", "start"]
