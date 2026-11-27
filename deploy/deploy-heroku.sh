#!/usr/bin/env bash

set -e

# Check if Heroku CLI is installed
if ! command -v heroku &> /dev/null; then
    echo "Heroku CLI is not installed. Please install it first."
    exit 1
fi
# Check if HEROKU_API_KEY is set
if [ -z "$HEROKU_API_KEY" ]; then 
    echo "HEROKU_API_KEY is not set. Please set it in your environment."
    exit 1
fi
# Check if HEROKU_APP_NAME is set
if [ -z "$HEROKU_APP_NAME" ]; then
    echo "HEROKU_APP_NAME is not set. Please set it in your environment."
    exit 1
fi
# Check if REGISTRY_IMAGE is set
if [ -z "$REGISTRY_IMAGE" ]; then
    echo "REGISTRY_IMAGE is not set. Please set it in your environment."
    exit 1
fi

# Check if skopeo is installed
if ! command -v skopeo &> /dev/null; then
    echo "skopeo is not installed. Please install it first."
    exit 1
fi

# BuildKit publishes the image with OCI media types, but the Heroku registry
# only accepts Docker v2 schema 2 manifests ("error from registry: unsupported").
# `docker pull` + `docker push` only converted the manifest on the legacy image
# store; with the containerd image store (default since Docker 29) it pushes the
# OCI manifest as-is. skopeo copies registry-to-registry and converts the format.
echo "Copying the Docker image to Heroku..."
skopeo copy --format v2s2 \
    --dest-creds "_:$HEROKU_API_KEY" \
    "docker://$REGISTRY_IMAGE" \
    "docker://registry.heroku.com/$HEROKU_APP_NAME/web"

echo "Releasing the Docker image on Heroku..."
heroku container:release web -a $HEROKU_APP_NAME -v
