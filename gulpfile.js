'use strict';

/**
 * Basic concept follows https://www.justinmccandless.com/post/a-tutorial-for-getting-started-with-gulp/
 */
const gulp = require('gulp');

// Include plug-ins
const eslint = require('gulp-eslint');
const babel = require('gulp-babel');
const uglify = require('gulp-uglify');
const imagemin = require('gulp-imagemin');
const htmlmin = require('gulp-htmlmin');
const minifyCSS = require('gulp-minify-css');
const minifyInline = require('gulp-minify-inline');
const spawn = require('child_process').spawn;

// Build directory
const buildDir = '_site/';

// Paths to be used in gulp.src
const sourcePaths = {
    javascripts: ['js/**/*.js', '!js/lib/**/*.js'],
    images: ['images/**/*.png', 'images/**/*.jpg', 'images/**/*.jpeg', 'images/**/*.gif'],
    html: ['**/*.html'],
    css: ['css/**/*.css']
};

function waitForCommand(command, gulpCallBack) {
    command.on('exit', function (code) {
        gulpCallBack(code === 0 ? null : 'ERROR: command exited with code: ' + code);
    });
}

// Delete the build directory
gulp.task('jekyll-clean', function (gulpCallBack) {
    let command = spawn('jekyll', ['clean'], {stdio: 'inherit'});
    waitForCommand(command, gulpCallBack);
});

// Let Jekyll build the raw site
gulp.task('jekyll-build', ['jekyll-clean'], function (gulpCallBack) {
    let command = spawn('jekyll', ['build'], {stdio: 'inherit'});
    waitForCommand(command, gulpCallBack);
});

// Let Jekyll serve the raw site
gulp.task('jekyll-serve', ['jekyll-clean'], function (gulpCallBack) {
    let command = spawn('jekyll', ['serve'], {stdio: 'inherit'});
    waitForCommand(command, gulpCallBack);
});

// Transpile the javascript files to ES5.
gulp.task('_javascripts', ['jekyll-build'], function () {
    return gulp.src(sourcePaths.javascripts, {base: buildDir, cwd: buildDir})
        .pipe(babel({
            presets: ['es2015']
        }))
        .pipe(uglify())
        .pipe(gulp.dest(buildDir));
});

// Minify the images
gulp.task('_images', ['jekyll-build'], function () {
    return gulp.src(sourcePaths.images, {base: buildDir, cwd: buildDir})
        .pipe(imagemin())
        .pipe(gulp.dest(buildDir));
});

// Minify html
gulp.task('_html', ['jekyll-build'], function () {
    return gulp.src(sourcePaths.html, {base: buildDir, cwd: buildDir})
        .pipe(htmlmin({
            collapseWhitespace: true,
            removeComments: true
        }))
        .pipe(minifyInline())
        .pipe(gulp.dest(buildDir));
});

// Minify css
gulp.task('_css', ['jekyll-build'], function () {
    return gulp.src(sourcePaths.css, {base: buildDir, cwd: buildDir})
        .pipe(minifyCSS())
        .pipe(gulp.dest(buildDir));
});

// Default task producing a ready-to-ship frontend in the build folder
gulp.task('default', ['jekyll-build', '_javascripts', '_images', '_html', '_css']);

// Check code style on JS
gulp.task('eslint', function () {
    gulp.src(sourcePaths.javascripts, {cwd: 'src/'})
        .pipe(eslint())
        .pipe(eslint.format());
});
