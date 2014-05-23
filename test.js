'use strict';
var fs = require('fs');
var path = require('path');
var assert = require('assert');
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

test('tmp');
test(__dirname + '/tmp');
test('tmp', { extension: '.coffee' });
