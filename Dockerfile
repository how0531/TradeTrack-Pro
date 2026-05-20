# syntax=docker/dockerfile:1
# Deterministic deployment for any Docker-aware host (Zeabur / Render / etc.).
# A Dockerfile takes precedence over zbpack/buildpack auto-detection, so this
# removes every "is it static or serverful / which port" guessing layer that
# made the SPA flip between 502 and white screen on Zeabur.

# ---- Build Stage ----
# node:20 to satisfy package.json engines (vitest/jsdom need >=20). Only the
# build runs here; test/dev devDeps are unused at runtime.
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Bake the backend URL into the bundle (same value the old zbpack/zeabur
# build_command used). Overridable via --build-arg VITE_API_URL=...
ARG VITE_API_URL=https://tradetrack-pro.onrender.com
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ---- Production Stage (Nginx) ----
FROM nginx:alpine
# Use the official image's envsubst template mechanism so the listen port is
# whatever the host provides ($PORT), falling back to 80. Works both on hosts
# that route to the EXPOSEd port and hosts that inject a dynamic $PORT and
# expect the container to honour it.
ENV PORT=80
RUN printf 'server {\n\
    listen ${PORT};\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|webp|webm)$ {\n\
        expires 1y;\n\
        add_header Cache-Control "public, immutable";\n\
    }\n\
}\n' > /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
# nginx:alpine entrypoint runs envsubst on /etc/nginx/templates/*.template
# (substituting ${PORT}) into /etc/nginx/conf.d/ before starting nginx.
CMD ["nginx", "-g", "daemon off;"]
