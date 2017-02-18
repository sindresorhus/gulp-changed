'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const gutil = require('gulp-util');
const through = require('through2');

// Ignore missing file error
function fsOperationFailed(stream, sourceFile, err) {
	if (err) {
		if (err.code !== 'ENOENT') {
			stream.emit('error', new gutil.PluginError('gulp-changed', err, {
				fileName: sourceFile.path
			}));
		}

		stream.push(sourceFile);
	}

	return err;
}

const sha1 = buf => crypto.createHash('sha1').update(buf).digest('hex');

// Only push through files changed more recently than the destination files
function compareLastModifiedTime(stream, cb, sourceFile, targetPath) {
	fs.stat(targetPath, (err, targetStat) => {
		if (!fsOperationFailed(stream, sourceFile, err)) {
			if (sourceFile.stat && sourceFile.stat.mtime > targetStat.mtime) {
				stream.push(sourceFile);
			}
		}

		cb();
	});
}

// Only push through files with different SHA1 than the destination files
function compareSha1Digest(stream, cb, sourceFile, targetPath) {
	fs.readFile(targetPath, (err, targetData) => {
		if (sourceFile.isNull()) {
			cb(null, sourceFile);
			return;
		}

		if (!fsOperationFailed(stream, sourceFile, err)) {
			const sourceDigest = sha1(sourceFile.contents);
			const targetDigest = sha1(targetData);

			if (sourceDigest !== targetDigest) {
				stream.push(sourceFile);
			}
		}

		cb();
	});
}

module.exports = (dest, opts) => {
	opts = Object.assign({
		cwd: process.cwd(),
		hasChanged: compareLastModifiedTime
	}, opts);

	if (!dest) {
		throw new gutil.PluginError('gulp-changed', '`dest` required');
	}

	if (opts.transformPath !== undefined && typeof opts.transformPath !== 'function') {
		throw new gutil.PluginError('gulp-changed', '`opts.transformPath` needs to be a function');
	}

	return through.obj(function (file, enc, cb) {
		const dest2 = typeof dest === 'function' ? dest(file) : dest;
		let newPath = path.resolve(opts.cwd, dest2, file.relative);

		if (opts.extension) {
			newPath = gutil.replaceExtension(newPath, opts.extension);
		}

		if (opts.transformPath) {
			newPath = opts.transformPath(newPath);

			if (typeof newPath !== 'string') {
				throw new gutil.PluginError('gulp-changed', '`opts.transformPath` needs to return a string');
			}
		}

		opts.hasChanged(this, cb, file, newPath);
	});
};

module.exports.compareLastModifiedTime = compareLastModifiedTime;
module.exports.compareSha1Digest = compareSha1Digest;
