
FROM node:18-alpine

WORKDIR /app

EXPOSE 3004

ENV NODE_ENV=production

COPY package.json .

RUN npm install --omit=dev

COPY . .

CMD [ "npm", "start" ]