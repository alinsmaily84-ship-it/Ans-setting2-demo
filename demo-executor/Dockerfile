FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY *.mjs ./
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["node", "read-only-server.mjs"]
