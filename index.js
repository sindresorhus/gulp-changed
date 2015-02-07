'use strict';

var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var gulp = require('gulp');
var gutil = require('gulp-util');
var through = require('through2');

/**
 * Name of this gulp plugin.
 *
 * @type {string}
 */
var pluginName = 'gulp-changed';

/**
 * Evaluate error returned by node's file system methods, missing file error is ignored and the source file is pushed.
 *
 * @param {Stream} stream - Through stream object.
 * @param {File} sourceFile - Vinyl file object.
 * @param {null|Error} err - Possibly thrown error.
 * @return {null|Error} The `err` argument.
 */
function fsOperationFailed(stream, sourceFile, err) {
	if (err) {
		if (err.code !== 'ENOENT') {
			stream.emit('error', new gutil.PluginError(pluginName, err, {
				fileName: sourceFile.path
			}));
		}

		stream.push(sourceFile);
	}

	return err;
}

/**
 * Get the sha1 hex digest of a buffer.
 *
 * @param {Buffer} buf - The buffer to get the sha1 hex digest for.
 * @return {string} The sha1 hex digest of the buffer.
 */
function sha1(buf) {
	return crypto.createHash('sha1').update(buf).digest('hex');
}

/**
 * Compare last modified time of source and target.
 *
 * @param {Stream} stream - Through stream object.
 * @param {File} sourceFile - Vinyl file object.
 * @param {string} targetPath - Path of the target.
 * @param {Function} cb - Done callback which receives `true` as the first argument if the file should be pushed,
 *   otherwise `false`.
 * @return {undefined}
 */
function doCompareLastModifiedTime(stream, sourceFile, targetPath, cb) {
	fs.stat(targetPath, function (err, targetStat) {
		cb(!fsOperationFailed(stream, sourceFile, err) && sourceFile.stat.mtime > targetStat.mtime);
	});
}

/**
 * Compare last modified time of a source to many target files and only push through files which changed.
 *
 * @param {File} sourceFile - Vinyl file object.
 * @param {Array|string} pattern - Glob pattern to match.
 * @param {Function} cb - Done callback which receives `true` as the first argument if the file should be pushed,
 *   otherwise `false`.
 * @return {undefined}
 */
function doCompareLastModifiedTimeOfManyToOne(sourceFile, pattern, cb) {
	gulp.src(pattern)
		.on('end', cb.bind(null, false))
		.pipe(through.obj(function (file, enc, cb) {
			if (file.isNull()) {
				cb(null, file);
				return;
			}

			// We use an error to end the stream without emitting an end event.
			if (sourceFile.stat.mtime > file.stat.mtime) {
				this.emit('error', new gutil.PluginError(pluginName, file.path + ' has changed ...'));
			}
		}))
		.on('error', cb.bind(null, true));
}

/**
 * Push source on stream and call the callback, optionally cache the state.
 *
 * @param {Stream} stream - Through stream object.
 * @param {File} sourceFile - Vinyl file object.
 * @param {Function} cb - Done callback.
 * @param {*} [cache] - The caching object.
 * @param {null|string} [key] - The caching key.
 * @param {boolean} really - Flag indicating if the source file should be pushed on the stream or not.
 * @return {undefined}
 */
function doPush(stream, sourceFile, cb, cache, key, really) {
	if (typeof cache === 'boolean') {
		really = cache;
	} else if (key) {
		cache[key] = really;
	}

	if (really === true) {
		stream.push(sourceFile);
	}

	cb();
}

/**
 * Compare last modified time of source and target and only push through files which changed.
 *
 * @param {Stream} stream - Through stream object.
 * @param {Function} cb - Done callback.
 * @param {File} sourceFile - Vinyl file object.
 * @param {string} targetPath - Path of the target.
 * @param {Array|boolean|null|string} [pattern] - Glob pattern to match.
 * @return {undefined}
 */
function compareLastModifiedTime(stream, cb, sourceFile, targetPath, pattern) {
	/**
	 * Caching key.
	 *
	 * @type {string|undefined}
	 */
	var key;

	/**
	 * Reference to this function object, we use it as the cache for already matched many-to-one results, since they are
	 * pretty heavy to compute.
	 *
	 * @type {compareLastModifiedTime}
	 */
	var self = compareLastModifiedTime;

	// Simple case, only match source to target.
	if (!pattern) {
		return doCompareLastModifiedTime(stream, sourceFile, targetPath, doPush.bind(null, stream, sourceFile, cb));
	}

	// Construct a reusable caching key based on the available data.
	key = pattern instanceof Array ? pattern.join() : pattern;

	// Check if we already know this cache key and directly return.
	if (key in self) {
		return doPush(stream, sourceFile, cb, self[key]);
	}

	// We are dealing with a target file and a pattern, check the target file first (fast).
	doCompareLastModifiedTime(stream, sourceFile, targetPath, function (push) {
		if (push === true) {
			return doPush(stream, sourceFile, cb, self, key, true);
		}

		doCompareLastModifiedTimeOfManyToOne(sourceFile, pattern, doPush.bind(null, stream, sourceFile, cb, self, key));
	});
}

/**
 * Compare sha1 hex digest of source and target and only push through files which changed.
 *
 * @param {Stream} stream - Through stream object.
 * @param {Function} cb - Done callback.
 * @param {File} sourceFile - Vinyl file object.
 * @param {string} targetPath - Path of the target.
 * @return {undefined}
 */
function compareSha1Digest(stream, cb, sourceFile, targetPath) {
	fs.readFile(targetPath, function (err, targetData) {
		if (!fsOperationFailed(stream, sourceFile, err)) {
			var sourceDigest = sha1(sourceFile.contents);
			var targetDigest = sha1(targetData);

			if (sourceDigest !== targetDigest) {
				stream.push(sourceFile);
			}
		}

		cb();
	});
}

/**
 * Invocation method of the plugin.
 *
 * @param {Function|string} dest - The destination of the file, this can be one of:
 *   1. A string which contains the same value as `gulp.dest` of this pipe receives.
 *   2. A function which will get the through file object as first argument and has to return a string like 1. of this
 *      list.
 * @param {{
 *   cwd: string
 *   extension: string
 *   hasChanged: Function
 *   pattern: Array|string
 * }} [opts] - Plugin options:
 *   - `cwd` is the current working directory to resolve paths, defaults to `process.cwd`.
 *   - `extension` can be used to replace the source's extension if the destination file has a different one.
 *   - `hasChanged` is the function to determine if a file has changed, defaults to `compareLastModified` of this plugin.
 *   - `pattern` an array or string pattern which will be passed to `gulp.src` for many-to-one matching.
 * @return {undefined}
 */
module.exports = function (dest, opts) {
	if (!dest) {
		throw new gutil.PluginError(pluginName, '`dest` required');
	}

	opts = opts || {};
	opts.cwd = opts.cwd || process.cwd();
	opts.hasChanged = opts.hasChanged || compareLastModifiedTime;

	return through.obj(function (file, enc, cb) {
		var targetPath, fileClone;

		if (file.isNull()) {
			cb(null, file);
			return;
		}

		if (typeof dest === 'function') {
			// Create a clone and allow the callback to alter the file object without altering the stream's file.
			fileClone = file.clone();
			targetPath = path.resolve(opts.cwd, dest(fileClone), fileClone.relative);
		} else {
			targetPath = path.resolve(opts.cwd, dest, file.relative);
		}

		if (opts.extension) {
			targetPath = gutil.replaceExtension(targetPath, opts.extension);
		}

		opts.hasChanged(this, cb, file, targetPath, opts.pattern);
	});
};

module.exports.compareLastModifiedTime = compareLastModifiedTime;
module.exports.compareSha1Digest = compareSha1Digest;
