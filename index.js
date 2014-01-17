'use strict';
var fs = require('fs');
var path = require('path');
var gutil = require('gulp-util');
var through = require('through2');

module.exports = function (dest) {
	var files = [];

	if (!dest) {
		throw new gutil.PluginError('gulp-changed', '`dest` required');
	}

	return through.obj(function (file, enc, cb) {
		if (file.isNull()) {
			this.push(file);
			return cb();
		}

		if (file.isStream()) {
			this.emit('error', new gutil.PluginError('gulp-changed', 'Streaming not supported'));
			return cb();
		}

		fs.stat(path.join(dest, file.relative), function (err, stats) {
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
