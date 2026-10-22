FROM node:22-alpine

WORKDIR /app

# Copy dependency specifications
COPY package*.json ./

# Install production dependencies
RUN npm install --omit=dev && npm cache clean --force

# Copy source code
COPY . .

ENV PORT=3020 \
    NODE_ENV=production

EXPOSE 3020

CMD ["node", "src/server.ts"]

