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

_Type_: `string` (required)

The destination directory. Same as you put into `gulp.dest()`.

This is needed to be able to compare the current files with the destination files.

#### options

##### cwd

_Type_: `string`

_Default_: `process.cwd()`

The working directory the folder is relative to.

##### extension

_Type_: `string`

_Default_: do not change extension

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

##### updateNeeded

_Type_: `function`

_Default_: `changed.compareLastModifiedTime`

Function that determines whether specified target file "changed" relative to the specified source file.

Built-in comparers are:

- `changed.compareLastModifiedTime`
- `changed.compareMd5Digest`
- `changed.compareSha1Digest`

Example:

```
gulp.task('jade', function () {
	gulp.src('./src/**/*.jade')
		.pipe(changed('./app/', { updateNeeded: changed.compareSha1Digest }))
		.pipe(jade())
		.pipe(gulp.dest('./app/'))
});
```

## License

[MIT](http://opensource.org/licenses/MIT) © [Sindre Sorhus](http://sindresorhus.com)
