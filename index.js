import process from 'node:process';
import fs from 'node:fs/promises';
import path from 'node:path';
import changeFileExtension from 'change-file-extension';
import {gulpPlugin} from 'gulp-plugin-extras';

// Only push through files changed more recently than the destination files
export async function compareLastModifiedTime(sourceFile, targetPath) {
	if (!sourceFile.stat) {
		return;
	}

	const targetStat = await fs.stat(targetPath);

	// TODO: This can be removed when Gulp supports mtime as bigint.
	// `fs.stat(targetPath, {bigint: true})`
	/*
	Precision is lost in the `mtime` when Gulp copies the file from source to target so we cannot compare the modified times directly. This has been the case since Gulp 4.

	On non-Windows systems:
	Due to an issue in libuv affecting Node.js 14.17.0 and above (https://github.com/nodejs/node/issues/38981), when Gulp copies the file to the target, its `mtime` may be behind the source file by up to 1ms. For example, if the source file has a `mtime` like `1623259049896.314`, the target file `mtime` can end up as `1623259049895.999`. To compare safely we use floor on the source and ceil on the target, which would give us `1623259049896` for both source and target in that example case.

	On Windows:
	File modification times are often rounded to the nearest second. For example, a source file with `mtime` of `1446818873134` gets copied to a target with `mtime` of `1446818873000`. Both represent the same second, but comparing at millisecond precision would incorrectly detect them as different. Therefore, we compare at second precision by dividing by 1000 and flooring both values.

	Additionally, we use the maximum of mtime and ctime to handle file replacement scenarios. When a file is replaced with an older version (e.g., restored from backup), its mtime might be older than the destination, but its ctime (change time) will be newer since it was just replaced. This ensures we detect all types of file changes.
	*/
	// Check if file was replaced with an older version
	// This happens when: mtime is older than destination (rollback), but ctime is newer (just modified)
	// Use precision-aware comparison: reverse of the "is newer" check
	const sourceIsOlderThanDest = process.platform === 'win32'
		? Math.floor(sourceFile.stat.mtimeMs / 1000) < Math.floor(targetStat.mtimeMs / 1000)
		: Math.ceil(sourceFile.stat.mtimeMs) < Math.floor(targetStat.mtimeMs);

	if (sourceIsOlderThanDest && sourceFile.stat.ctimeMs > sourceFile.stat.mtimeMs + 1000 && sourceFile.stat.ctimeMs > targetStat.mtimeMs) {
		// File was replaced with an older version (e.g., restored from backup)
		// Use direct comparison since ctime doesn't have the same precision issues as mtime
		return sourceFile;
	}

	// Standard mtime comparison with precision handling
	if (process.platform === 'win32') {
		// Compare at second precision on Windows to handle filesystem second-rounding
		if (Math.floor(sourceFile.stat.mtimeMs / 1000) > Math.floor(targetStat.mtimeMs / 1000)) {
			return sourceFile;
		}
	} else if (Math.floor(sourceFile.stat.mtimeMs) > Math.ceil(targetStat.mtimeMs)) {
		// Use millisecond precision with floor/ceil for sub-second precision issues
		return sourceFile;
	}
}

// Only push through files with different contents than the destination files
export async function compareContents(sourceFile, targetPath) {
	const targetData = await fs.readFile(targetPath);

	if (!sourceFile.contents.equals(targetData)) {
		return sourceFile;
	}
}

export default function gulpChanged(destination, options) {
	options = {
		cwd: process.cwd(),
		hasChanged: compareLastModifiedTime,
		...options,
	};

	if (!destination) {
		throw new Error('gulp-changed: `dest` required');
	}

	if (options.transformPath !== undefined && typeof options.transformPath !== 'function') {
		throw new Error('gulp-changed: `options.transformPath` needs to be a function');
	}

	return gulpPlugin('gulp-changed', async file => {
		const destination2 = typeof destination === 'function' ? destination(file) : destination;
		let newPath = path.resolve(options.cwd, destination2, file.relative);

		if (options.extension) {
			newPath = changeFileExtension(newPath, options.extension);
		}

		if (options.transformPath) {
			newPath = options.transformPath(newPath);

			if (typeof newPath !== 'string') {
				throw new TypeError('`options.transformPath` needs to return a string');
			}
		}

		try {
			return await options.hasChanged(file, newPath);
		} catch (error) {
			if (error.code !== 'ENOENT') {
				throw error;
			}

			return file;
		}
	});
}
