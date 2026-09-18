FROM oven/bun:1-alpine AS build
WORKDIR /app

ARG VITE_API_URL=http://localhost:8099
ARG VITE_MP_PUBLIC_KEY=

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_MP_PUBLIC_KEY=$VITE_MP_PUBLIC_KEY

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . ./
RUN bun run build

FROM oven/bun:1-alpine AS runner
WORKDIR /app

COPY --from=build /app/.output ./.output
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/src ./src
COPY --from=build /app/package.json /app/vite.config.ts /app/tsconfig.json ./

EXPOSE 8010
CMD ["bunx", "vite", "preview", "--port", "8010", "--host", "0.0.0.0"]
