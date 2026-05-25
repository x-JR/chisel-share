FROM node:26-slim

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code (including textures/)
COPY . .

# NEXT_PUBLIC_* vars are baked into the client bundle at build time
ARG NEXT_PUBLIC_SITE_URL=https://chisel.tekkie.com.au
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL

# Build Next.js
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/app
ENV DB_HOST=
ENV DB_PORT=3306
ENV DB_USER=
ENV DB_PASSWORD=
ENV DB_NAME=
ENV ADMIN_TOKEN=

EXPOSE 3000

CMD ["npm", "start"]
