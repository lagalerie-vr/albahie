# Single-container image: Next.js app + authoritative bidding WebSocket server
# in ONE process (server.ts), serving HTTP and wss://…/auction-ws on one port.
#
# Build (the NEXT_PUBLIC_* values are inlined into the browser bundle, so they
# must be passed at build time — they are public, not secrets):
#
#   docker build -t albahie \
#     --build-arg NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co \
#     --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... \
#     --build-arg NEXT_PUBLIC_LIVEKIT_URL=wss://xxx.livekit.cloud \
#     --build-arg NEXT_PUBLIC_SITE_URL=https://your-domain .
#
# Run (server-side secrets come from the env file at runtime):
#
#   docker run -d -p 3000:3000 --env-file .env.runtime --name albahie albahie
FROM node:22-slim

WORKDIR /app

# Install all deps (incl. tsx for the runtime server, and the build toolchain).
COPY package.json package-lock.json ./
RUN npm ci

# Public client vars — inlined into the browser bundle at build time.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_LIVEKIT_URL
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_LIVEKIT_URL=$NEXT_PUBLIC_LIVEKIT_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_TELEMETRY_DISABLED=1

COPY . .
RUN npm run build

ENV NODE_ENV=production
# Hosts inject PORT; 3000 is the default. The client auto-uses /auction-ws.
EXPOSE 3000

CMD ["npm", "run", "start"]
