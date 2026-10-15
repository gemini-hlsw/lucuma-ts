#!/bin/bash

bold=$(tput bold)
normal=$(tput sgr0)

# Function to check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

mkdir -p ~/navigate
cd ~/navigate

echo "INSTALLING NAVIGATE"
echo 

# Download scripts
echo "Downloading scripts"
curl https://raw.githubusercontent.com/gemini-hlsw/navigate-ts/refs/heads/main/deploy/docker-compose.yml >docker-compose.yml
curl https://raw.githubusercontent.com/gemini-hlsw/navigate-ts/refs/heads/main/deploy/navigate.sh >navigate.sh
curl https://raw.githubusercontent.com/gemini-hlsw/navigate-ts/refs/heads/main/deploy/template-env >template-env
chmod +x navigate.sh
echo

# Require the creation of an .env file using the template-env, unless it exists.
if [ -e .env ]; then
  echo "Keeping existing .env"
  echo
else
  echo "# IMPORTANT!!!!" > .env
  echo "# Please modify this file (.env) using the appropriate values and save the changes." >> .env
  echo "# This values will be used to start the navigate containers cluster." >> .env
  cat template-env >> .env

  # Try to open the file with vim, vi, nano, or emacs
  if command_exists vim; then
    vim .env
  elif command_exists vi; then
    vi .env
  elif command_exists nano; then
    nano .env
  elif command_exists emacs; then
    emacs .env
  else
    echo "No suitable editor found (vim, vi, nano, or emacs)."
    exit 1
  fi
fi

# Create configuration directory - request files
mkdir -p ~/navigate/conf
echo "Navigate configuration directory created in ~/navigate/conf"
echo "Please add the configuration files needed by navigate-server to run properly"
echo "  secrets.conf - To include needed tokens and TLS configuration"
echo "  site.jks - To configure TLS certificate"
echo 

# Creating symbolic link to run navigate as a command
echo "Creating symbolic link to run navigate as a command"
mkdir -p ~/bin
ln -s ~/navigate/navigate.sh ~/bin/navigate
echo "Navigate command installed"
echo "For more information run"
echo "  >> ${bold}navigate help${normal}"