import process from 'node:process';
import fs from 'node:fs/promises';
import path from 'node:path';
import changeFileExtension from 'change-file-extension';
import {gulpPlugin} from 'gulp-plugin-extras';

// Only push through files changed more recently than the destination files
export async function compareLastModifiedTime(sourceFile, targetPath) {
	const targetStat = await fs.stat(targetPath);

	// TODO: This can be removed when Gulp supports mtime as bigint.
	// `fs.stat(targetPath, {bigint: true})`
	/*
	Precision is lost in the `mtime` when Gulp copies the file from source to target so we cannot compare the modified times directly. This has been the case since Gulp 4. Now, due to an issue in libuv affecting Node.js 14.17.0 and above (including 16.x: https://github.com/nodejs/node/issues/38981) when Gulp copies the file to the target, its `mtime` may be behind the source file by up to 1ms. For example, if the source file has a `mtime` like `1623259049896.314`, the target file `mtime` can end up as `1623259049895.999`. So to compare safely we use floor on the source and ceil on the target, which would give us `1623259049896` for both source and target in that example case.
	*/
	if (sourceFile.stat && Math.floor(sourceFile.stat.mtimeMs) > Math.ceil(targetStat.mtimeMs)) {
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
