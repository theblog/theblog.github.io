#!/bin/zsh

TMPDIR=$1
SITEDIR=$2

cd $SITEDIR
git checkout master
# Remove all tracked files (from https://superuser.com/questions/442625/git-delete-all-tracked-files)
git ls-files -z | xargs -0 rm -f
# Remove all tracked directories that are empty
git ls-tree --name-only -d -r -z HEAD | sort -rz | xargs -0 rmdir

# Copy the files
cp $TMPDIR/site/* $SITEDIR
cp $TMPDIR/master-readme.md $SITEDIR/README.md
touch $SITEDIR/.nojekyll

echo "Second script done"