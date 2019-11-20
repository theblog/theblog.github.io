#!/bin/zsh

# From: https://unix.stackexchange.com/questions/155046/determine-if-git-working-directory-is-clean-from-a-script
if ! (output=$(git status --porcelain) && [ -z "$output" ]); then
    # Uncommitted changes
    echo "Exiting due to uncommitted changes"
    exit 1
fi

# Build the site
# gulp

# Copy all required files into a tmp dir and continue from there
tmpdir=$(dirname $(mktemp -u))
cp -r _site $tmpdir
cp -r util $tmpdir

$tmpdir/util/_publish.sh
echo "First script done"