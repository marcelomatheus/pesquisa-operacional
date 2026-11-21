FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.js ./
COPY src ./src
COPY public ./public
RUN npm run build

FROM nginx:1.27-alpine
ARG NGINX_CONFIG=deploy/nginx.conf
ARG WEB_PORT=80
COPY ${NGINX_CONFIG} /etc/nginx/conf.d/default.conf
COPY deploy/nginx.runtime.conf /etc/nginx/nginx.conf
COPY deploy/nginx-start.sh /usr/local/bin/nginx-start.sh
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE ${WEB_PORT}
ENTRYPOINT ["/bin/sh", "/usr/local/bin/nginx-start.sh"]
CMD ["nginx", "-g", "daemon off;"]
