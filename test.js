/*jslint node: true, white: true, vars: true */

'use strict';
var fs = require('fs');
var path = require('path');
var assert = require('assert');
var gulp = require('gulp');
var gutil = require('gulp-util');
var rimraf = require('rimraf');
var changed = require('./index');

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

// Simple helper function that converts specified
// gulp stream into an array (invoking specified
// callback "cb" after stream closes).
function streamToArray(s, cb) {
	var a = [];
	s.on("data", function (data) {
		a.push(data);
	});
	s.on("end", function () {
		cb(a);
	});
	s.on("error", function (err) {
		cb(err);
	});
}

// Define tests that will be run against
// all built-in hash algorithms.
function testHash(hashAlgorithm) {
	describe("gulp-changed with " + hashAlgorithm, function () {

		it("should not pass any files through in identical directories", function (cb) {
			var s = gulp
				.src("./testdata/identical/src/*")
				.pipe(changed("./testdata/identical/trg", { updateNeeded: changed[hashAlgorithm] }));
			streamToArray(s, function (a) {
				assert.equal(0, a.length);
				cb();
			});
		});

		it("should only pass through changed files using file extension", function (cb) {
			var s = gulp
				.src("./testdata/different/src/*")
				.pipe(changed("./testdata/different/trg", { updateNeeded: changed[hashAlgorithm] }));
			streamToArray(s, function (a) {
				assert.equal(1, a.length);
				assert.equal("b", path.basename(a[0].path));
				cb();
			});
		});

		it("should only pass through changed files using extension .coffee", function (cb) {
			var s = gulp
				.src("./testdata/different.ext/src/*")
				.pipe(changed("./testdata/different.ext/trg", { updateNeeded: changed[hashAlgorithm], extension: '.coffee' }));
			streamToArray(s, function (a) {
				assert.equal(1, a.length);
				assert.equal("b.typescript", path.basename(a[0].path));
				cb();
			});
		});

	});
}

describe("gulp-changed with compareLastModifiedTime", function () {
	test();
	test({ extension: '.coffee' });
});

testHash("compareMd5Digest");
testHash("compareSha1Digest");
