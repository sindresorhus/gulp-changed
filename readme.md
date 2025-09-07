# gulp-changed

> Only pass through changed files

No more wasting precious time on processing unchanged files.

By default it's only able to detect whether files in the stream changed. If you require something more advanced like knowing if imports/dependencies changed, create a custom comparator, or use [another plugin](https://github.com/gulpjs/gulp#incremental-builds).

## Install

```sh
npm install --save-dev gulp-changed
```

## Usage

```js
import gulp from 'gulp';
import changed from 'gulp-changed';
import ngAnnotate from 'gulp-ng-annotate'; // Just as an example

const SOURCE = 'src/*.js';
const DESTINATION = 'dist';

exports.default = () => (
	gulp.src(SOURCE)
		.pipe(changed(DESTINATION))
		// `ngAnnotate` will only get the files that
		// changed since the last time it was run
		.pipe(ngAnnotate())
		.pipe(gulp.dest(DESTINATION))
);
```

## API

### changed(destination, options?)

#### destination

Type: `string | Function`

Destination directory. Same as you put into `gulp.dest()`.

This is needed to be able to compare the current files with the destination files.

Can also be a function returning a destination directory path.

#### options

Type: `object`

##### cwd

Type: `string`\
Default: `process.cwd()`

Working directory the folder is relative to.

##### extension

Type: `string`

Extension of the destination files.

Useful if it differs from the original, like in the example below:

```js
export const jade = () => (
	gulp.src('src/**/*.jade')
		.pipe(changed('app', {extension: '.html'}))
		.pipe(jade())
		.pipe(gulp.dest('app'))
);
```

##### hasChanged

Type: `Function`\
Default: `compareLastModifiedTime`

Function that determines whether the source file is different from the destination file.

###### Built-in comparators

Named imports:

- `compareLastModifiedTime` - Compare modification times (default)
- `compareContents` - Compare file contents (only useful for files that are copied without transformation)

###### Example

```js
import {compareContents} from 'gulp-changed';

// compareContents only works when files are copied without transformation
export const images = () => (
	gulp.src('src/images/**/*')
		.pipe(changed('dist/images', {hasChanged: compareContents}))
		.pipe(gulp.dest('dist/images'))
);
```

You can also specify a custom comparator function, which will receive the following arguments:

- `sourceFile` *([Vinyl file object](https://github.com/wearefractal/vinyl#file))*
- `destinationPath` *(string)* - The destination for `sourceFile` as an absolute path

The function is expected to return `sourceFile | Promise<sourceFile>` if it passes some comparison or `undefined | Promise<undefined>`. [Examples.](https://github.com/sindresorhus/gulp-changed/blob/4e59a0105c8c10c56f9f8cd153c696e005afa64f/index.js#L7-L28)

##### transformPath

Type: `Function`

Function to transform the path to the destination file. Should return the absolute path to the (renamed) destination file.

Useful if you rename your file later on, like in the below example:

```js
export const marked = () => (
	gulp.src('src/content/about.md')
		.pipe(changed('dist', {
			transformPath: newPath => path.join(path.dirname(newPath), path.basename(newPath, '.md'), 'index.html')
		}))
		.pipe(marked())
		.pipe(rename(newPath => path.join(path.dirname(newPath), path.basename(newPath, '.md'), 'index.html')))
		.pipe(gulp.dest('dist'))
);
```

## In-place change monitoring

If you're looking to process source files in-place without any build output (formatting, linting, etc), have a look at [gulp-changed-in-place](https://github.com/alexgorbatchev/gulp-changed-in-place).
