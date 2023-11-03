import process from 'node:process';
import fs from 'node:fs/promises';
import path from 'node:path';
import changeFileExtension from 'change-file-extension';
import {gulpPlugin} from 'gulp-plugin-extras';

// Only push through files changed more recently than the destination files
export async function compareLastModifiedTime(sourceFile, targetPath) {
	const targetStat = await fs.stat(targetPath, {bigint: true});

	if (sourceFile.stat && sourceFile.stat.mtimeMs > targetStat.mtimeMs) {
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
