#!/usr/bin/env sh
cd $(git rev-parse --show-toplevel)

# note: requires to be logged in with a github account that has write access
# to this peppermint docker image
#
# assuming CR_PAT contains a valid login token, calling the following command
# before executing this script will work:
#   echo $CR_PAT | docker login.ghcr.io -u <your github username> --password-stdin

VERSION=1.1

docker build -t peppermint . || exit 1

docker tag que-pasa ghcr.io/tzconnectberlin/peppermint:latest || exit 1
docker tag que-pasa ghcr.io/tzconnectberlin/peppermint:$VERSION || exit 1

docker push ghcr.io/tzconnectberlin/peppermint:latest || exit 1
docker push ghcr.io/tzconnectberlin/peppermint:$VERSION
