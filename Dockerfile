FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build
EXPOSE 3000
# NOTE: no seed step yet. Plan 6 (seed loader) will update this CMD to
# `migrate deploy && seed && next start` once the seed script exists.
CMD ["sh", "-c", "npx prisma migrate deploy && npx next start -p 3000"]
