/*jslint node: true, white: true, vars: true */

'use strict';
var fs = require('fs');
var path = require('path');
var gutil = require('gulp-util');
var crypto = require('crypto');
var through = require('through2');

// Propagate "fs.*" operation errors to
// the specified stream unless the error
// was caused by a missing file.
function fsOperationFailed(stream, sourceFile, err) {
	if (err) {
		if (err.code !== 'ENOENT') {
			stream.emit('error', new gutil.PluginError('gulp-changed', err));
		}

		stream.push(sourceFile);
	}

	return err;
}

// Only queue sourceFile in the specified
// stream if target is older than source.
function compareLastModifiedTime(stream, cb, sourceFile, targetPath) {
	fs.stat(targetPath, function (err, targetStat) {
		if (!fsOperationFailed(stream, sourceFile, err)) {
			if (sourceFile.stat.mtime > targetStat.mtime) {
				stream.push(sourceFile);
			}
		}

		cb();
	});
}

// Only queue sourceFile in the specified
// stream if target has different SHA1 digest
// than source (ignores timestamps).
function compareSha1Digest(stream, cb, sourceFile, targetPath) {
	fs.readFile(targetPath, function (err, targetData) {
		if (!fsOperationFailed(err, stream)) {
			var sourceDigest = crypto.createHash("sha1").update(sourceFile.file).digest("hex");
			var targetDigest = crypto.createHash("sha1").update(targetData).digest("hex");
			if (sourceDigest !== targetDigest) {
				stream.push(sourceFile);
			}
		}

		cb();
	});
}

module.exports = function (dest, opts) {
	opts = opts || {};
	opts.cwd = opts.cwd || process.cwd();
	opts.updateNeeded = opts.updateNeeded || compareLastModifiedTime;

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

		opts.updateNeeded(this, cb, file, newPath);
	});
};

module.exports.compareLastModifiedTime = compareLastModifiedTime;
module.exports.compareSha1Digest = compareSha1Digest;
