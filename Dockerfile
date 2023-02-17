FROM node:18-alpine
WORKDIR /build

# may need psql for setting up the database schema (psql < database/schema.psql)
RUN apk add postgresql-client

ADD . .
RUN npm install

ENTRYPOINT ./entry_point.sh