'use strict';
const {promisify} = require('util');
const fs = require('fs');
const path = require('path');
const replaceExt = require('replace-ext');
const PluginError = require('plugin-error');
const through = require('through2');

const readFile = promisify(fs.readFile);
const stat = promisify(fs.stat);

// Ignore missing file error
function fsOperationFailed(stream, sourceFile, error) {
	if (error.code !== 'ENOENT') {
		stream.emit('error', new PluginError('gulp-changed', error, {
			fileName: sourceFile.path
		}));
	}

	stream.push(sourceFile);
}

// Only push through files changed more recently than the destination files
async function compareLastModifiedTime(stream, sourceFile, targetPath) {
	// TODO: Use the `stat` `bigint` option when targeting Node.js 10 and Gulp supports it
	const targetStat = await stat(targetPath);

	if (sourceFile.stat && Math.floor(sourceFile.stat.mtimeMs) > Math.floor(targetStat.mtimeMs)) {
		stream.push(sourceFile);
	}
}

// Only push through files with different contents than the destination files
async function compareContents(stream, sourceFile, targetPath) {
	const targetData = await readFile(targetPath);

	if (sourceFile.isNull() || !sourceFile.contents.equals(targetData)) {
		stream.push(sourceFile);
	}
}

module.exports = (destination, options) => {
	options = {
		cwd: process.cwd(),
		hasChanged: compareLastModifiedTime,
		...options
	};

	if (!destination) {
		throw new PluginError('gulp-changed', '`dest` required');
	}

	if (options.transformPath !== undefined && typeof options.transformPath !== 'function') {
		throw new PluginError('gulp-changed', '`options.transformPath` needs to be a function');
	}

	return through.obj(function (file, encoding, callback) {
		const dest2 = typeof destination === 'function' ? destination(file) : destination;
		let newPath = path.resolve(options.cwd, dest2, file.relative);

		if (options.extension) {
			newPath = replaceExt(newPath, options.extension);
		}

		if (options.transformPath) {
			newPath = options.transformPath(newPath);

			if (typeof newPath !== 'string') {
				throw new PluginError('gulp-changed', '`options.transformPath` needs to return a string');
			}
		}

		(async () => {
			try {
				await options.hasChanged(this, file, newPath);
			} catch (error) {
				fsOperationFailed(this, file, error);
			}

			callback();
		})();
	});
};

module.exports.compareLastModifiedTime = compareLastModifiedTime;
module.exports.compareContents = compareContents;

