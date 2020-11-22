'use strict';

/**
 * Basic concept follows https://www.justinmccandless.com/post/a-tutorial-for-getting-started-with-gulp/
 */
const gulp = require('gulp');

// Include plug-ins
const eslint = require('gulp-eslint');
const uglify = require('gulp-uglify-es').default;
const imagemin = require('gulp-imagemin');
const htmlmin = require('gulp-htmlmin');
const minifyCSS = require('gulp-minify-css');
const minifyInline = require('gulp-minify-inline');
const spawn = require('child_process').spawn;

// Build directory
const buildDir = '_site/';

// Paths to be used in gulp.src
const sourcePaths = {
    javascripts: ['js/**/*.js'],
    images: ['images/**/*.png', 'images/**/*.jpg', 'images/**/*.jpeg', 'images/**/*.gif'],
    html: ['**/*.html'],
    css: ['css/**/*.css']
};

function waitForCommand(command, gulpCallback) {
    command.on('exit', function (code) {
        gulpCallback(code === 0 ? null : 'ERROR: command exited with code: ' + code);
    });
}

// Delete the build directory
gulp.task('_jekyll-clean', function (gulpCallback) {
    let command = spawn('jekyll', ['clean'], {stdio: 'inherit'});
    waitForCommand(command, gulpCallback);
});

// Let Jekyll build the raw site
gulp.task('_jekyll-build', ['_jekyll-clean'], function (gulpCallback) {
    let command = spawn('jekyll', ['build'], {stdio: 'inherit'});
    waitForCommand(command, gulpCallback);
});

// Minify JavaScript
gulp.task('_javascripts', ['_jekyll-build'], function () {
    return gulp.src(sourcePaths.javascripts, {base: buildDir, cwd: buildDir})
        .pipe(uglify())
        .pipe(gulp.dest(buildDir));
});

// Minify the images
gulp.task('_images', ['_jekyll-build'], function () {
    return gulp.src(sourcePaths.images, {base: buildDir, cwd: buildDir})
        .pipe(imagemin())
        .pipe(gulp.dest(buildDir));
});

// Minify html
gulp.task('_html', ['_jekyll-build'], function () {
    return gulp.src(sourcePaths.html, {base: buildDir, cwd: buildDir})
        .pipe(htmlmin({
            collapseWhitespace: false,
            removeComments: true
        }))
        .pipe(minifyInline())
        .pipe(gulp.dest(buildDir));
});

// Minify css
gulp.task('_css', ['_jekyll-build'], function () {
    return gulp.src(sourcePaths.css, {base: buildDir, cwd: buildDir})
        .pipe(minifyCSS())
        .pipe(gulp.dest(buildDir));
});

// Default task producing a ready-to-ship frontend in the build folder
gulp.task('default', ['_jekyll-build', '_javascripts', '_images', '_html', '_css']);

// Check code style on JS
gulp.task('eslint', function () {
    gulp.src(sourcePaths.javascripts, {cwd: 'src/'})
        .pipe(eslint())
        .pipe(eslint.format());
});
