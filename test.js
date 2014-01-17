'use strict';
var fs = require('fs');
var path = require('path');
var assert = require('assert');
var gutil = require('gulp-util');
var rimraf = require('rimraf');
var changed = require('./index');

it('should only pass through changed files', function (cb) {
	var stream = changed('tmp');
	var files = [];

	try {
		fs.mkdirSync('tmp');
		fs.writeFileSync(path.join('tmp', 'foo.js'), '');
	} catch (err) {}

	stream.on('data', function (file) {
		files.push(file);
		fs.writeFileSync(path.join('tmp', file.relative), file);
	});

	stream.on('end', function () {
		assert.equal(files.length, 1);
		assert.equal(files[0].relative, 'bar.js');
		rimraf.sync('tmp');
		cb();
	});

	stream.write(new gutil.File({
		cwd: __dirname,
		base: __dirname,
		path: 'foo.js',
		contents: new Buffer(''),
		stat: {
			mtime: fs.statSync(path.join('tmp', 'foo.js'))
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
