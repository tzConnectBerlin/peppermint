#!/bin/sh

set -e

echo "$PEPPERMINT_CONFIG" > config.json

psql -d "${DB_PROTOCOL}://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_DATABASE}" < database/schema.sql

tokill=$$

no_ctrlc()
{
    echo "Killed the nodejs PID=$tokill"
    kill -2 $tokill
    while kill -0 $tokill; do
        sleep 1
    done
    exit
}

trap no_ctrlc SIGINT SIGTERM SIGKILL

node app.mjs &
tokill=$!
wait
