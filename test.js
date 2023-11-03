import {Buffer} from 'node:buffer';
import path from 'node:path';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import {fileURLToPath} from 'node:url';
import touch from 'touch';
import test from 'ava';
import gulp from 'gulp';
import Vinyl from 'vinyl';
import {deleteSync} from 'del';
import {getStreamAsArray} from 'get-stream';
import figures from 'figures';
import chalk from 'chalk';
import changed, {compareContents} from './index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pointer = chalk.gray.dim(figures.pointerSmall);

const macro = async (t, options) =>
	// TODO: Use the `p-event` package here instead of the promise constructor
	// eslint-disable-next-line no-async-promise-executor
	new Promise(async (resolve, reject) => {
		let {dest} = options;
		const extension = options.extension || '.js';
		const stream = changed(dest, options);
		const files = [];

		if (typeof dest === 'function') {
			dest = dest();
		}

		try {
			await fs.mkdir(dest, {recursive: true});
			await touch(path.join(dest, `foo${extension}`));
		} catch (error) {
			reject(error);
			return;
		}

		stream.on('data', file => {
			files.push(file);
			fsSync.writeFileSync(path.join(dest, file.relative), file.contents);
		});

		stream.on('end', () => {
			t.is(files.length, 1);
			t.is(files[0].relative, 'bar.js');
			deleteSync(dest);
			resolve();
		});

		stream.write(new Vinyl({
			cwd: __dirname,
			base: __dirname,
			path: 'foo.js',
			contents: Buffer.from(''),
			stat: {
				mtime: fsSync.statSync(path.join(dest, 'foo' + extension)),
			},
		}));

		stream.write(new Vinyl({
			base: __dirname,
			path: 'bar.js',
			contents: Buffer.from(''),
			stat: {
				mtime: new Date(),
			},
		}));

		stream.end();
	});

macro.title = (providedTitle, options) => {
	let desc = 'should only pass through changed files';

	if (options && options.extension) {
		desc += ' using extension ' + options.extension;
	} else if (options.absolute) {
		desc += ' with a absolute path';
	} else {
		desc += ' using file extension';
	}

	return [providedTitle, desc].join(` ${pointer} `);
};

test.serial(`compareLastModifiedTime ${pointer} using relative dest`, macro, {dest: 'tmp', absolute: true});
test.serial(`compareLastModifiedTime ${pointer} using relative dest`, macro, {dest: 'tmp', absolute: true, extension: '.coffee'});
test.serial(`compareLastModifiedTime ${pointer} dest can be a function`, macro, {dest: () => 'tmp'});

test(`compareContents ${pointer} should not pass any files through in identical directories`, async t => {
	const stream = gulp.src('fixture/identical/src/*')
		.pipe(changed('fixture/identical/trg', {hasChanged: compareContents}));

	const files = await getStreamAsArray(stream);
	t.is(files.length, 0);
});

test(`compareContents ${pointer} should only pass through changed files using file extension`, async t => {
	const stream = gulp.src('fixture/different/src/*')
		.pipe(changed('fixture/different/trg', {hasChanged: compareContents}));

	const files = await getStreamAsArray(stream);
	t.is(files.length, 1);
	t.is(path.basename(files[0].path), 'b');
});

test(`compareContents ${pointer} should only pass through changed files using transformPath`, async t => {
	const stream = gulp.src('fixture/different.transformPath/src/*')
		.pipe(changed('fixture/different.transformPath/trg', {
			hasChanged: compareContents,
			transformPath(newPath) {
				const pathParsed = path.parse(newPath);
				return path.join(pathParsed.dir, 'c', pathParsed.base);
			},
		}));

	const files = await getStreamAsArray(stream);
	t.is(files.length, 1);
	t.is(path.basename(files[0].path), 'b');
});

test(`compareContents ${pointer} should only pass through changed files using extension .coffee`, async t => {
	const stream = gulp.src('fixture/different.ext/src/*')
		.pipe(changed('fixture/different.ext/trg', {
			hasChanged: compareContents,
			extension: '.coffee',
		}));

	const files = await getStreamAsArray(stream);
	t.is(files.length, 1);
	t.is(path.basename(files[0].path), 'b.typescript');
});
