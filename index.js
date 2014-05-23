/*jslint node: true, white: true */

'use strict';
var fs = require('fs');
var path = require('path');
var gutil = require('gulp-util');
var through = require('through2');

function testLastModifiedTime(stream, cb, sourceFile, targetPath) {
	fs.stat(targetPath, function (err, targetStat) {
		if (err) {
			// pass through if it doesn't exist
			if (err.code === 'ENOENT') {
				stream.push(sourceFile);
				return cb();
			}

			stream.emit('error', new gutil.PluginError('gulp-changed', err));
			stream.push(sourceFile);
			return cb();
		}

		if (sourceFile.stat.mtime > targetStat.mtime) {
			stream.push(sourceFile);
		}

		cb();
	});
}

module.exports = function (dest, opts) {
	opts = opts || {};
	opts.cwd = opts.cwd || process.cwd();

	if (!dest) {
		throw new gutil.PluginError('gulp-changed', '`dest` required');
	}

	return through.obj(function (file, enc, cb) {
		if (file.isNull()) {
			this.push(file);
			return cb();
		}

		var newPath = path.resolve(opts.cwd, dest, file.relative);

		if (opts.extension) {
			newPath = gutil.replaceExtension(newPath, opts.extension);
		}

		testLastModifiedTime(this, cb, file, newPath);
	});
};
