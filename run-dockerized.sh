#!/usr/bin/env sh

docker run \
       --network host \
       ghcr.io/tzconnectberlin/peppermint:1.1 \
       "$@"
