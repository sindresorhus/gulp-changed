'use strict';
var fs = require('fs');
var path = require('path');
var gutil = require('gulp-util');
var through = require('through2');

module.exports = function (dest, opts) {
	opts = opts || {};

	if (!dest) {
		throw new gutil.PluginError('gulp-changed', '`dest` required');
	}

	return through.obj(function (file, enc, cb) {
		if (file.isNull()) {
			this.push(file);
			return cb();
		}

		var newPath = path.join(dest, file.relative);

		if (opts.extension) {
			newPath = gutil.replaceExtension(newPath, opts.extension);
		}

		fs.stat(newPath, function (err, stats) {
			if (err) {
				// pass through if it doesn't exist
				if (err.code === 'ENOENT') {
					this.push(file);
					return cb();
				}

				this.emit('error', new gutil.PluginError('gulp-changed', err));
				this.push(file);
				return cb();
			}

			if (file.stat.mtime > stats.mtime) {
				this.push(file);
			}

			cb();
		}.bind(this));
	});
};
