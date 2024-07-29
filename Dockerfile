FROM node:20.16.0

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm config set registry https://mirrors.tencent.com/npm/

RUN npm install

COPY . ./

CMD ["node", "index.js"]