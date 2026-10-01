#!/bin/bash

NAVIGATE_DIR=~/navigate
VERSION_FILE="$NAVIGATE_DIR/deployed-version"

# The deployed tag lives only in the state file written by 'update'
if [ -s "$VERSION_FILE" ]; then
    NAVIGATE_TAG=$(cat "$VERSION_FILE")
    export NAVIGATE_TAG
fi

compose() {
    docker compose -f "$NAVIGATE_DIR/docker-compose.yml" --env-file "$NAVIGATE_DIR/.env" "$@"
}

# Check if the right number of arguments was received
if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
    echo "ERROR: You must provide one of the following arguments: start, stop, update <tag>, version or help."
    exit 1
fi

bold=$(tput bold)
normal=$(tput sgr0)

# Get the argument
option="$1"

case "$option" in
    start)
        if [ -z "$NAVIGATE_TAG" ]; then
            echo "No deployed version found. Run 'navigate update <tag>' first."
            exit 1
        fi
        echo "Starting Navigate $NAVIGATE_TAG"
        compose up -d
        ;;
    stop)
        echo "Stoping Navigate"
        # Placeholder so compose can parse the file; 'down' doesn't use images
        export NAVIGATE_TAG=${NAVIGATE_TAG:-unset}
        compose down
        ;;
    update)
        TAG="$2"
        if [ -z "$TAG" ]; then
            echo "Usage: navigate update <tag>"
            echo "  <tag> is the lucuma-ts release tag, such as v0.16.16"
            exit 1
        fi
        echo "Updating Navigate to $TAG"
        if ! docker pull "noirlab/gpp-nav:$TAG"; then
            echo "ERROR: Could not pull noirlab/gpp-nav:$TAG. Nothing was changed."
            exit 1
        fi
        if ! docker pull "noirlab/gpp-nav-configs:$TAG"; then
            echo "ERROR: Could not pull noirlab/gpp-nav-configs:$TAG. Nothing was changed."
            exit 1
        fi
        # Stop with the old tag (or placeholder if there was none)
        export NAVIGATE_TAG=${NAVIGATE_TAG:-unset}
        compose down
        echo "$TAG" > "$VERSION_FILE"
        export NAVIGATE_TAG="$TAG"
        compose up -d
        ;;
    version)
        if [ -s "$VERSION_FILE" ]; then
            cat "$VERSION_FILE"
        else
            echo "No deployed version"
            exit 1
        fi
        ;;
    help)
        echo "To run Navigate you should provide a valid agument"
        echo "Possible argument options are 'start', 'stop', 'update <tag>', 'version' and 'help'"
        echo -e "  ${bold}start${normal}: Will start Navigate containers"
        echo -e "  ${bold}stop${normal}: Will stop Navigate containers"
        echo -e "  ${bold}update <tag>${normal}: Will pull the given release tag for the navigate images, record it in deployed-version and recreate the containers (tag is the lucuma-ts release tag, e.g. v0.16.16)"
        echo -e "  ${bold}version${normal}: Will show the currently deployed tag"
        echo -e "  ${bold}help${normal}: Will show this message"
        ;;
    *)
        echo "Error: Invalid argument, use 'help' command for instructions."
        exit 1
        ;;
esac
