FROM node:18-alpine AS builder

# Build argument for API URL (can be overridden at build time)
ARG VUE_APP_API_URL=http://localhost:8080
ENV VUE_APP_API_URL=$VUE_APP_API_URL

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]