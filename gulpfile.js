'use strict';

/**
 * Basic concept follows https://www.justinmccandless.com/post/a-tutorial-for-getting-started-with-gulp/
 * TODO: Plug-ins to consider: gulp-changed, gulp-minify-html (see
 * https://www.sitepoint.com/introduction-gulp-js/)
 */
const gulp = require('gulp');

// Include plug-ins
const eslint = require('gulp-eslint');
const clean = require('gulp-clean');
const babel = require('gulp-babel');
const uglify = require('gulp-uglify');
const concat = require('gulp-concat');
const imagemin = require('gulp-imagemin');
const rename = require('gulp-rename');

// Base for specifying paths in gulp.src and gulp.dest
const distDir = '_dist/';

// Paths to be used in gulp.src
const sourcePaths = {
    javascripts: ['js/**/*.js', '!js/lib/**/*.js'],
    images: ['images/**/*.png', 'images/**/*.jpg', 'images/**/*.jpeg', 'images/**/*.gif']
};

// Delete the dist directory
gulp.task('_clean', function () {
    return gulp.src(distDir)
        .pipe(clean());
});

// Copy all files
gulp.task('_copy', ['_clean'], function () {
    return gulp.src(['src/**/*']).pipe(gulp.dest(distDir));
});

// Transpile the javascript files to ES5.
gulp.task('_javascripts', ['_copy'], function () {
    return gulp.src(sourcePaths.javascripts, {base: distDir, cwd: distDir})
        .pipe(babel({
            presets: ['es2015']
        }))
        .pipe(uglify())
        .pipe(gulp.dest(distDir));
});

// Minify the images
gulp.task('_images', ['_copy'], function () {
    return gulp.src(sourcePaths.images, {base: distDir, cwd: distDir})
        .pipe(imagemin())
        .pipe(gulp.dest(distDir));
});

// Default task producing a ready-to-ship frontend in the dist folder
gulp.task('default', ['_javascripts', '_images']);

// Check code style on JS
gulp.task('eslint', function () {
    gulp.src(sourcePaths.javascripts, {cwd: bases.frontend})
        .pipe(eslint())
        .pipe(eslint.format());
});

// Run Jekyll
gulp.task('jekyll', ['default'], function (gulpCallBack) {
    let spawn = require('child_process').spawn;
    let jekyll = spawn('jekyll', ['serve'], {stdio: 'inherit'});

    jekyll.on('exit', function (code) {
        gulpCallBack(code === 0 ? null : 'ERROR: Jekyll process exited with code: ' + code);
    });
});