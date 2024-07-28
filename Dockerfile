FROM node:18.17.0

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm config set registry https://mirrors.tencent.com/npm/

RUN yarn

COPY . ./

CMD ["node", "index.js"]