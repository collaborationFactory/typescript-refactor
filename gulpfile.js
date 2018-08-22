var gulp = require('gulp'),
    tsc = require('gulp-typescript'),
    sourcemaps = require('gulp-sourcemaps'),
    del = require('del'),
    tsProject = tsc.createProject('tsconfig.json'),
    path = require('path');

// or requiring in ES5
var merge = require('merge2');

/**
 * Compile TypeScript and include references to library and app .d.ts files.
 */
gulp.task('compile-ts', function () {
    var tsResult = tsProject.src()
        .pipe(sourcemaps.init())
        .pipe(tsProject());

    return merge([
        tsResult.dts.pipe(gulp.dest('dist')),
        tsResult.js
            .pipe(sourcemaps.write('.', {
                // Return relative source map root directories per file.
                includeContent: false,
                sourceRoot: function (file) {
                    var sourceFile = path.join(file.cwd, file.sourceMap.file);
                    return "../" + path.relative(path.dirname(sourceFile), __dirname);
                }
            }))
            .pipe(gulp.dest('dist'))
    ]);
});

gulp.task('clean-ts', function (cb) {
    var typeScriptGenFiles = [
        './dist/**/*.*'    // path to all JS files auto gen'd by editor
    ];

    // delete the files
    return del(typeScriptGenFiles, cb);
});

gulp.task('default', ['clean-ts', 'compile-ts']);
