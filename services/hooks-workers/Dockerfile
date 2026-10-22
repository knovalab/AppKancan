FROM node:22-alpine

WORKDIR /app

ENV PORT=3020
ENV NODE_ENV=production

# Copy dependency specifications
COPY package*.json ./

# Install production dependencies
RUN npm install --omit=dev && npm cache clean --force

# Copy source code
COPY . .

EXPOSE 3020

CMD ["node", "src/server.ts"]
