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
if [ "$#" -lt 1 ] || [ "$#" -gt 3 ]; then
    echo "ERROR: You must provide one of the following arguments: start, stop, update <tag> [--force], version or help."
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
        TAG=""
        FORCE=false
        for arg in "${@:2}"; do
            case "$arg" in
                --force) FORCE=true ;;
                *)
                    if [ -n "$TAG" ]; then
                        echo "ERROR: Unexpected argument [$arg]"
                        exit 1
                    fi
                    TAG="$arg"
                    ;;
            esac
        done
        if [ -z "$TAG" ]; then
            echo "Usage: navigate update <tag> [--force]"
            echo "  <tag> is the lucuma-ts release tag, such as v0.16.16"
            exit 1
        fi
        if [ "$TAG" = "latest" ] && [ "$FORCE" != true ]; then
            # This server cannot reach github.com, so the promoted tag must be looked up elsewhere
            SITE=$(grep -E '^SITE=' "$NAVIGATE_DIR/.env" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"'"'"' ')
            case "${SITE%-*}" in
                staging|production) ENVIRONMENT="${SITE%-*}" ;;
                *) ENVIRONMENT="<staging|production>" ;;
            esac
            echo "You shouldn't deploy 'latest' on staging and production servers. This may break compatibility with other systems."
            echo
            echo "If you have a REALLY REALLY good reason to deploy 'latest', rerun with --force."
            echo
            echo "Otherwise, use the version provided in Slack in the latest promotion."
            echo "If you can't find it there, run this on a machine with access to github.com:"
            echo
            echo "    curl -s 'https://api.github.com/repos/gemini-hlsw/lucuma-ts/deployments?environment=navigate-$ENVIRONMENT&task=deploy&per_page=1' | grep -m1 docker_tag"
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
        echo "Possible argument options are 'start', 'stop', 'update <tag> [--force]', 'version' and 'help'"
        echo -e "  ${bold}start${normal}: Will start Navigate containers"
        echo -e "  ${bold}stop${normal}: Will stop Navigate containers"
        echo -e "  ${bold}update <tag> [--force]${normal}: Will pull the given release tag for the navigate images, record it in deployed-version and recreate the containers (tag is the lucuma-ts release tag, e.g. v0.16.16). Deploying 'latest' requires --force"
        echo -e "  ${bold}version${normal}: Will show the currently deployed tag"
        echo -e "  ${bold}help${normal}: Will show this message"
        ;;
    *)
        echo "Error: Invalid argument, use 'help' command for instructions."
        exit 1
        ;;
esac
