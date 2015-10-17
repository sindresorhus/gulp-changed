'use strict';
var fs = require('fs');
var path = require('path');
var assert = require('assert');
var concatStream = require('concat-stream');
var gulp = require('gulp');
var gutil = require('gulp-util');
var rimraf = require('rimraf');
var changed = require('./');

function test(dest, opts) {
	var desc = 'should only pass through changed files';
	var extension = '.js';

	if (opts && opts.extension) {
		desc += ' using extension ' + opts.extension;
		extension = opts.extension;
	} else if (/^\//.test(dest)) {
		desc += ' with a absolute path';
	} else {
		desc += ' using file extension';
	}

	it(desc, function (cb) {
		var stream = changed(dest, opts);
		var files = [];

		if (typeof dest === 'function') {
			dest = 'tmp';
		}

		try {
			fs.mkdirSync(dest);
			fs.writeFileSync(path.join(dest, 'foo' + extension), '');
		} catch (err) {}

		stream.on('data', function (file) {
			files.push(file);
			fs.writeFileSync(path.join(dest, file.relative), file);
		});

		stream.on('end', function () {
			assert.equal(files.length, 1);
			assert.equal(files[0].relative, 'bar.js');
			rimraf.sync(dest);
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

describe('compareLastModifiedTime', function () {
	describe('using relative dest', function () {
		test('tmp');
		test('tmp', {extension: '.coffee'});
	});

	describe('using absolute dest', function () {
		var absTmp = path.resolve(__dirname, 'tmp');
		test(absTmp);
		test(absTmp, {extension: '.coffee'});
	});

	describe('dest can be a function', function () {
		test(function (file) {
			return 'tmp';
		});
	});
});

describe('compareSha1Digest', function () {
	it('should not pass any files through in identical directories', function (cb) {
		gulp.src('fixture/identical/src/*')
			.pipe(changed('fixture/identical/trg', {hasChanged: changed.compareSha1Digest}))
			.pipe(concatStream(function (buf) {
				assert.equal(0, buf.length);
				cb();
			}));
	});

	it('should only pass through changed files using file extension', function (cb) {
		gulp.src('fixture/different/src/*')
			.pipe(changed('fixture/different/trg', {hasChanged: changed.compareSha1Digest}))
			.pipe(concatStream(function (buf) {
				assert.equal(1, buf.length);
				assert.equal('b', path.basename(buf[0].path));
				cb();
			}));
	});

	it('should only pass through changed files using extension .coffee', function (cb) {
		gulp.src('fixture/different.ext/src/*')
			.pipe(changed('fixture/different.ext/trg', {
				hasChanged: changed.compareSha1Digest,
				extension: '.coffee'
			}))
			.pipe(concatStream(function (buf) {
				assert.equal(1, buf.length);
				assert.equal('b.typescript', path.basename(buf[0].path));
				cb();
			}));
	});
});

describe('in-place file check', function () {
	beforeEach(function () {
		Object.keys(changed.shas).forEach(function (key) {
			delete changed.shas[key];
		});
	});

	it('passes all files on start', function (cb) {
		gulp.src('fixture/different/src/*')
			.pipe(changed())
			.pipe(concatStream(function (buf) {
				assert.equal(2, buf.length);
				assert.equal('a', path.basename(buf[0].path));
				assert.equal('b', path.basename(buf[1].path));
				cb();
			}));
	});

	it('should only pass through files when they change', function (cb) {
		changed.shas[path.join(__dirname, 'fixture/different/src/a')] = 'not matching sha';
		changed.shas[path.join(__dirname, 'fixture/different/src/b')] = 'e9d71f5ee7c92d6dc9e92ffdad17b8bd49418f98';

		gulp.src('fixture/different/src/*')
			.pipe(changed())
			.pipe(concatStream(function (buf) {
				assert.equal(1, buf.length);
				assert.equal('a', path.basename(buf[0].path));
				cb();
			}));
	});
});
