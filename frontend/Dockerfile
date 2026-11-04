FROM node:24-alpine

WORKDIR /app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Default backend URL for Docker container network
ENV BACKEND_INTERNAL_URL=http://backend:4321

# Install locked dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Copy application code and build
COPY . .
RUN pnpm build

ENV NODE_ENV=production
ENV PORT=1234
EXPOSE 1234

CMD ["pnpm", "start"]
