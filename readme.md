# [gulp](http://gulpjs.com)-changed [![Build Status](https://travis-ci.org/sindresorhus/gulp-changed.svg?branch=master)](https://travis-ci.org/sindresorhus/gulp-changed)

> Only pass through changed files

No more wasting precious time on processing unchanged files.


## Install

```sh
$ npm install --save-dev gulp-changed
```


## Usage

```js
var gulp = require('gulp');
var changed = require('gulp-changed');
var ngmin = require('gulp-ngmin'); // just as an example

var SRC = 'src/*.js';
var DEST = 'dist';

gulp.task('default', function () {
	return gulp.src(SRC)
		.pipe(changed(DEST))
		// ngmin will only get the files that
		// changed since the last time it was run
		.pipe(ngmin())
		.pipe(gulp.dest(DEST));
});
```

## API

### changed(destination, options)

#### destination

Type: `String`

The destination directory. Same as you put into `gulp.dest()`.

This is needed to be able to compare the current files with the destination files.

#### options

##### cwd

Type: `string`  
Default: `process.cwd()`

The working directory the folder is relative to.

##### extension

Type: `string`

Extension of the destination files.

Useful if it differs from the original, like in the example below:

```js
gulp.task('jade', function () {
	gulp.src('src/**/*.jade')
		.pipe(changed('app', {extension: '.html'}))
		.pipe(jade())
		.pipe(gulp.dest('app'))
});
```

##### hasChanged

Type: `function`  
Default: `changed.compareLastModifiedTime`

Function that determines whether specified target file "changed" relative to the specified source file.

Built-in comparers are:

- `changed.compareLastModifiedTime`
- `changed.compareSha1Digest`

Example:

```js
gulp.task('jade', function () {
	gulp.src('src/**/*.jade')
		.pipe(changed('./app/', { hasChanged: changed.compareSha1Digest }))
		.pipe(jade())
		.pipe(gulp.dest('./app/'))
});
```

If defining a custom function, it will receive the following parameters from `gulp-changed`:

- stream ([through2 Stream object](https://github.com/rvagg/through2#transformfunction)) - stream object created by `gulp-changed`; should be used to queue `sourceFile` to the stream output if it passes comparison; should also be used to report errors
- cb (function) - indicates that comparison is complete (when called, no parameters)
- sourceFile ([vinyl File object](https://github.com/wearefractal/vinyl#file)) - the file that is currently being processed by `changed` (as received by through2 stream in Gulp pipeline)
- targetPath (string) - destination for `sourceFile` as an absolute path

## License

[MIT](http://opensource.org/licenses/MIT) © [Sindre Sorhus](http://sindresorhus.com)
