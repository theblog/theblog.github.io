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
const cleanCSS = require('gulp-clean-css');
const rename = require('gulp-rename');
const gulpMerge = require('gulp-merge');

// Bases for specifying paths in gulp.src and gulp.dest
const distDir = '_dist/';

// Paths to be used in gulp.src
const sourcePaths = {
    javascripts: ['js/**/*.js', '!js/lib/**/*.js', '!js/posts/**/*.js'],
    postJavascripts: ['js/posts/**/*.js'],
    stylesheets: ['stylesheets/**/*.css', '!stylesheets/posts/**/*.css', '!stylesheets/about.css'],
    templates: ['templates/**/*.html'],
    images: ['images/**/*.png', 'images/**/*.jpg', 'images/**/*.jpeg', 'images/**/*.gif'],
    all: ['**/*', '!**/README.md']
};

// Files that shall not directly be copied
const excludeLists = [sourcePaths.javascripts, sourcePaths.postJavascripts, sourcePaths.stylesheets,
    sourcePaths.images, sourcePaths.templates];
const excludeExceptions = ['javascripts/lib/**/*.js', 'stylesheets/posts/**/*.css',
    'stylesheets/about.css'];

// Delete the dist directory
gulp.task('_clean', function () {
    return gulp.src(distDir)
        .pipe(clean());
});

// Copy all files
gulp.task('_copy', ['_clean'], function () {
    return gulp.src(['src/**/*', 'index.html']).pipe(gulp.dest(distDir));
});

// Transpile the javascript files to ES5. Then, minify them.
gulp.task('_javascripts', ['_copy'], function () {
    const polyfill = './node_modules/babel-polyfill/dist/polyfill.min.js';
    return gulp.src(distDir+'js/**/*.js')
        .pipe(babel())
        .pipe(uglify())
        .pipe(gulp.dest(distDir+'js'));
});

// Transpile the post's javascript files to ES5. Then, minify them.
gulp.task('_postJavascripts', ['_clean'], function () {
    return gulp.src(sourcePaths.postJavascripts, {base: bases.frontend, cwd: bases.frontend})
        .pipe(babel())
        .pipe(uglify())
        .pipe(gulp.dest(bases.dist));
});

// Minify the stylesheets
gulp.task('_stylesheets', ['_clean'], function () {
    return gulp.src(sourcePaths.stylesheets, {base: bases.frontend, cwd: bases.frontend})
        .pipe(cleanCSS({compatibility: 'ie8'}))
        // .pipe(rename({suffix: '.min'}))
        .pipe(gulp.dest(bases.dist));
});

// Minify the images
gulp.task('_images', ['_clean'], function () {
    return gulp.src(sourcePaths.images, {base: bases.frontend, cwd: bases.frontend})
        .pipe(imagemin())
        .pipe(gulp.dest(bases.dist));
});

// Copy the templates
gulp.task('_templates', ['_clean'], function () {
    return gulp.src(sourcePaths.templates, {base: bases.frontend, cwd: bases.frontend})
        .pipe(gulp.dest(bases.dist));
});

// Copy the rest
gulp.task('_rest:all', ['_clean'], function () {
    // Copy all files except JS, CSS, images and templates
    let files = Array.from(sourcePaths.all);
    // Exlude all files from the exclude lists by adding them to files with an '!'
    excludeLists.forEach(list => {
        list.forEach(path => files.push('!' + path));
    });

    return gulp.src(files, {base: bases.frontend, cwd: bases.frontend})
        .pipe(gulp.dest(bases.dist));
});

// Copy the excluded files from the exclude lists (for example javascripts/lib/**/*.js)
gulp.task('_rest:excludeExceptions', ['_clean'], function () {
    return gulp.src(excludeExceptions, {base: bases.frontend, cwd: bases.frontend})
        .pipe(gulp.dest(bases.dist));
});

gulp.task('_rest', ['_rest:all', '_rest:excludeExceptions']);

// Default task producing a ready-to-ship frontend in the dist folder
gulp.task('default', ['_javascripts', '_postJavascripts', '_stylesheets', '_images', '_templates',
    '_rest']);

// Transpile the javascript files to ES5.
gulp.task('babel', ['_copy'], function () {
    return gulp.src(sourcePaths.javascripts, {base: bases.frontend, cwd: bases.frontend})
        .pipe(babel())
        .pipe(gulp.dest(bases.dist));
});

// Watch the public directory in order to move changes directly to dist. Also, apply babel.
gulp.task('babel-watch', ['babel'], function () {
    gulp.watch(['public/**/*'], ['babel']);
});

// Check code style on JS
gulp.task('eslint', function () {
    gulp.src(sourcePaths.javascripts, {cwd: bases.frontend})
        .pipe(eslint())
        .pipe(eslint.format());
});

// Run Jekyll
gulp.task('jekyll', ['_javascripts'], function (gulpCallBack) {
    let spawn = require('child_process').spawn;
    let jekyll = spawn('jekyll', ['build'], {stdio: 'inherit'});

    jekyll.on('exit', function (code) {
        gulpCallBack(code === 0 ? null : 'ERROR: Jekyll process exited with code: ' + code);
    });
});