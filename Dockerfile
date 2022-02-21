FROM node
WORKDIR /build
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=UTC

# may need psql for setting up the database schema (psql < database/schema.psql)
RUN apt update && apt upgrade -y
RUN apt install -y postgresql

ADD . .
RUN npm install

ENTRYPOINT node app.mjs
