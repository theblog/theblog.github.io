#!/bin/zsh

WORKDIR=$(pwd)

# From: https://unix.stackexchange.com/questions/155046/determine-if-git-working-directory-is-clean-from-a-script
if ! (output=$(git status --porcelain) && [ -z "$output" ]); then
    # Uncommitted changes
    echo "Exiting due to uncommitted changes"
    exit 1
fi

# Build the site
# gulp

# Copy all required files into a tmp dir and continue from there to prevent the git reset on master
# from messing with the bash script executed
TMPDIR=$(dirname $(mktemp -u))
cp -r _site $TMPDIR
cp -r util $TMPDIR

$TMPDIR/util/publish_master_stage.sh $TMPDIR $WORKDIR
echo "First script done"