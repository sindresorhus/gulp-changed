'use strict';
/* eslint-env mocha */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const gulp = require('gulp');
const gutil = require('gulp-util');
const del = require('del');
const getStream = require('get-stream');
const changed = require('.');

function test(dest, opts) {
	let desc = 'should only pass through changed files';
	let extension = '.js';

	if (opts && opts.extension) {
		desc += ' using extension ' + opts.extension;
		extension = opts.extension;
	} else if (/^\//.test(dest)) {
		desc += ' with a absolute path';
	} else {
		desc += ' using file extension';
	}

	it(desc, cb => {
		const stream = changed(dest, opts);
		const files = [];

		if (typeof dest === 'function') {
			dest = 'tmp';
		}

		try {
			fs.mkdirSync(dest);
			fs.writeFileSync(path.join(dest, `foo${extension}`), '');
		} catch (err) {}

		stream.on('data', file => {
			files.push(file);
			fs.writeFileSync(path.join(dest, file.relative), file);
		});

		stream.on('end', () => {
			assert.equal(files.length, 1);
			assert.equal(files[0].relative, 'bar.js');
			del.sync(dest);
			cb();
		});

		stream.write(new gutil.File({
			cwd: __dirname,
			base: __dirname,
			path: 'foo.js',
			contents: new Buffer(''),
			stat: {
				mtime: fs.statSync(path.join(dest, 'foo' + extension))
			}
		}));

		stream.write(new gutil.File({
			base: __dirname,
			path: 'bar.js',
			contents: new Buffer(''),
			stat: {
				mtime: new Date()
			}
		}));

		stream.end();
	});
}

describe('compareLastModifiedTime', () => {
	describe('using relative dest', () => {
		test('tmp');
		test('tmp', {extension: '.coffee'});
	});

	describe('using absolute dest', () => {
		const absTmp = path.resolve(__dirname, 'tmp');
		test(absTmp);
		test(absTmp, {extension: '.coffee'});
	});

	describe('dest can be a function', () => {
		test(() => 'tmp');
	});
});

describe('compareSha1Digest', () => {
	it('should not pass any files through in identical directories', () => {
		const stream = gulp.src('fixture/identical/src/*')
			.pipe(changed('fixture/identical/trg', {hasChanged: changed.compareSha1Digest}));

		return getStream.array(stream).then(files => {
			assert.equal(files.length, 0);
		});
	});

	it('should only pass through changed files using file extension', () => {
		const stream = gulp.src('fixture/different/src/*')
			.pipe(changed('fixture/different/trg', {hasChanged: changed.compareSha1Digest}));

		return getStream.array(stream).then(files => {
			assert.equal(files.length, 1);
			assert.equal(path.basename(files[0].path), 'b');
		});
	});

	it('should only pass through changed files using transformPath', () => {
		const stream = gulp.src('fixture/different.transformPath/src/*')
			.pipe(changed('fixture/different.transformPath/trg', {
				hasChanged: changed.compareSha1Digest,
				transformPath: newPath => {
					const pathParsed = path.parse(newPath);
					return path.join(pathParsed.dir, 'c', pathParsed.base);
				}}));

		return getStream.array(stream).then(files => {
			assert.equal(files.length, 1);
			assert.equal(path.basename(files[0].path), 'b');
		});
	});

	it('should only pass through changed files using extension .coffee', () => {
		const stream = gulp.src('fixture/different.ext/src/*')
			.pipe(changed('fixture/different.ext/trg', {
				hasChanged: changed.compareSha1Digest,
				extension: '.coffee'
			}));

		return getStream.array(stream).then(files => {
			assert.equal(files.length, 1);
			assert.equal(path.basename(files[0].path), 'b.typescript');
		});
	});
});
