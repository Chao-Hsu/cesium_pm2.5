FROM node:10.15.3-alpine
WORKDIR /app
ADD . /app
RUN npm i express compression fs url request yargs --save
EXPOSE 5706
CMD node server.js