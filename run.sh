#!/bin/sh

node app.mjs 2>&1 | tee -a output.log
