import {Buffer} from 'node:buffer';
import path from 'node:path';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import {fileURLToPath} from 'node:url';
import {setTimeout} from 'node:timers/promises';
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

test.serial(`compareLastModifiedTime ${pointer} detects file replacement with older file via ctime`, async t => {
	const testDir = 'tmp-replacement';
	const srcDir = path.join(testDir, 'src');
	const destDir = path.join(testDir, 'dest');

	// Clean up and create directories
	deleteSync(testDir);
	await fs.mkdir(srcDir, {recursive: true});
	await fs.mkdir(destDir, {recursive: true});

	const srcPath = path.join(srcDir, 'app.js');
	const destPath = path.join(destDir, 'app.js');

	// Create initial file and process it
	await fs.writeFile(srcPath, 'console.log("v1");');

	const stream1 = changed(destDir);
	stream1.on('data', file => {
		fsSync.writeFileSync(destPath, file.contents);
	});

	stream1.write(new Vinyl({
		cwd: testDir,
		base: srcDir,
		path: srcPath,
		contents: Buffer.from('console.log("v1");'),
		stat: await fs.stat(srcPath),
	}));
	stream1.end();
	await new Promise(resolve => {
		stream1.on('end', resolve);
	});

	// Add a small delay to ensure dest file's mtime is properly set
	await setTimeout(10);

	// Replace source with older file
	await fs.writeFile(srcPath, 'console.log("old");');
	const oldTime = Date.now() - 10_000;
	await fs.utimes(srcPath, oldTime / 1000, oldTime / 1000);

	// Verify ctime is newer than dest mtime
	const srcStat = await fs.stat(srcPath);
	const destStat = await fs.stat(destPath);
	t.true(srcStat.ctimeMs > destStat.mtimeMs, 'Source ctime should be newer than dest mtime');

	// Process replaced file - should be detected
	const stream2 = changed(destDir);
	const filesProcessed = [];
	stream2.on('data', file => filesProcessed.push(file));

	stream2.write(new Vinyl({
		cwd: testDir,
		base: srcDir,
		path: srcPath,
		contents: await fs.readFile(srcPath),
		stat: await fs.stat(srcPath),
	}));
	stream2.end();
	await new Promise(resolve => {
		stream2.on('end', resolve);
	});

	t.is(filesProcessed.length, 1, 'Replaced file with older mtime should be detected via ctime');

	// Clean up
	deleteSync(testDir);
});
