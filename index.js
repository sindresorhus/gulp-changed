'use strict';
const fs = require('fs');
const path = require('path');
const replaceExt = require('replace-ext');
const PluginError = require('plugin-error');
const through = require('through2');
const pify = require('pify');

const readFile = pify(fs.readFile);
const stat = pify(fs.stat);

// Ignore missing file error
function fsOperationFailed(stream, sourceFile, err) {
	if (err.code !== 'ENOENT') {
		stream.emit('error', new PluginError('gulp-changed', err, {
			fileName: sourceFile.path
		}));
	}

	stream.push(sourceFile);
}

// Only push through files changed more recently than the destination files
function compareLastModifiedTime(stream, sourceFile, targetPath) {
	return stat(targetPath)
		.then(targetStat => {
			if (sourceFile.stat && sourceFile.stat.mtime > targetStat.mtime) {
				stream.push(sourceFile);
			}
		});
}

// Only push through files with different contents than the destination files
function compareContents(stream, sourceFile, targetPath) {
	return readFile(targetPath)
		.then(targetData => {
			if (sourceFile.isNull() || !sourceFile.contents.equals(targetData)) {
				stream.push(sourceFile);
			}
		});
}

module.exports = (dest, opts) => {
	opts = Object.assign({
		cwd: process.cwd(),
		hasChanged: compareLastModifiedTime
	}, opts);

	if (!dest) {
		throw new PluginError('gulp-changed', '`dest` required');
	}

	if (opts.transformPath !== undefined && typeof opts.transformPath !== 'function') {
		throw new PluginError('gulp-changed', '`opts.transformPath` needs to be a function');
	}

	return through.obj(function (file, enc, cb) {
		const dest2 = typeof dest === 'function' ? dest(file) : dest;
		let newPath = path.resolve(opts.cwd, dest2, file.relative);

		if (opts.extension) {
			newPath = replaceExt(newPath, opts.extension);
		}

		if (opts.transformPath) {
			newPath = opts.transformPath(newPath);

			if (typeof newPath !== 'string') {
				throw new PluginError('gulp-changed', '`opts.transformPath` needs to return a string');
			}
		}

		opts
			.hasChanged(this, file, newPath)
			.catch(err => fsOperationFailed(this, file, err))
			.then(() => cb());
	});
};

module.exports.compareLastModifiedTime = compareLastModifiedTime;
module.exports.compareContents = compareContents;
module.exports.compareSha1Digest = compareContents;
