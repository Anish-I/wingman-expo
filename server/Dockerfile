# Wingman API — multi-stage: compile TS -> JS in a build stage, then ship a
# slim runtime image that runs plain Node with only production dependencies.

# ---- build stage: full deps (incl. typescript/tsx) + compile to dist/ ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- runtime stage: prod deps only + compiled output ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
# Compiled JS and the Supabase CA cert (read at runtime, relative to cwd).
COPY --from=build /app/dist ./dist
COPY certs ./certs

# The server reads PORT from env and listens on 0.0.0.0. Default 3002.
ENV PORT=3002
EXPOSE 3002

CMD ["npm", "run", "start"]
