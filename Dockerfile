FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build
EXPOSE 3000
# Full idempotent boot sequence (runtime-environment.md §3): migrate → seed →
# serve. runSeed() resets-then-rebuilds its fixed-caseNumber demo case on every
# invocation, so re-running the seed on every container boot converges (no
# duplicate accumulation) even though the db volume persists across restarts.
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx src/data/seed.ts && npx next start -p 3000"]
