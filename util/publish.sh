#!/bin/zsh

ROOTDIR=$(pwd)

# Build the site
gulp

# Move to a tmp dir and checkout master there to prevent corrupting untracked directories here
TMPDIR=$(dirname $(mktemp -u))
cd $TMPDIR
git clone --depth 1 --branch master git@github.com:theblog/theblog.github.io.git theblog.github.io
cd theblog.github.io

# Copy the files
cp -r $ROOTDIR/_site/* .
cp $ROOTDIR/util/master-readme.md README.md
touch .nojekyll

# Publish
git add .
git commit -m "Gulped"
git push
echo "Published"

cd $ROOTDIR