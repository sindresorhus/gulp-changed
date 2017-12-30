import path from 'path';
import fs from 'fs';
import touch from 'touch';
import makeDir from 'make-dir';
import test from 'ava';
import gulp from 'gulp';
import Vinyl from 'vinyl';
import del from 'del';
import getStream from 'get-stream';
import figures from 'figures';
import chalk from 'chalk';
import changed from '.';

const pointer = chalk.gray.dim(figures.pointerSmall);

const macro = (t, opts) => {
	return new Promise(async resolve => {
		let dest = opts.dest;
		const extension = opts.extension || '.js';
		const stream = changed(dest, opts);
		const files = [];

		if (typeof dest === 'function') {
			dest = dest();
		}

		await makeDir(dest);
		await touch(path.join(dest, `foo${extension}`));

		stream.on('data', file => {
			files.push(file);
			fs.writeFileSync(path.join(dest, file.relative), file);
		});

		stream.on('end', () => {
			t.is(files.length, 1);
			t.is(files[0].relative, 'bar.js');
			del.sync(dest);
			return resolve();
		});

		stream.write(new Vinyl({
			cwd: __dirname,
			base: __dirname,
			path: 'foo.js',
			contents: Buffer.from(''),
			stat: {
				mtime: fs.statSync(path.join(dest, 'foo' + extension))
			}
		}));

		stream.write(new Vinyl({
			base: __dirname,
			path: 'bar.js',
			contents: Buffer.from(''),
			stat: {
				mtime: new Date()
			}
		}));

		stream.end();
	});
};

macro.title = (providedTitle, opts) => {
	let desc = 'should only pass through changed files';

	if (opts && opts.extension) {
		desc += ' using extension ' + opts.extension;
	} else if (opts.absolute) {
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
		.pipe(changed('fixture/identical/trg', {hasChanged: changed.compareContents}));

	const files = await getStream.array(stream);
	t.is(files.length, 0);
});

test(`compareContents ${pointer} should only pass through changed files using file extension`, async t => {
	const stream = gulp.src('fixture/different/src/*')
		.pipe(changed('fixture/different/trg', {hasChanged: changed.compareContents}));

	const files = await getStream.array(stream);
	t.is(files.length, 1);
	t.is(path.basename(files[0].path), 'b');
});

test(`compareContents ${pointer} should only pass through changed files using transformPath`, async t => {
	const stream = gulp.src('fixture/different.transformPath/src/*')
		.pipe(changed('fixture/different.transformPath/trg', {
			hasChanged: changed.compareContents,
			transformPath: newPath => {
				const pathParsed = path.parse(newPath);
				return path.join(pathParsed.dir, 'c', pathParsed.base);
			}
		}));

	const files = await getStream.array(stream);
	t.is(files.length, 1);
	t.is(path.basename(files[0].path), 'b');
});

test(`compareContents ${pointer} should only pass through changed files using extension .coffee`, async t => {
	const stream = gulp.src('fixture/different.ext/src/*')
		.pipe(changed('fixture/different.ext/trg', {
			hasChanged: changed.compareContents,
			extension: '.coffee'
		}));

	const files = await getStream.array(stream);
	t.is(files.length, 1);
	t.is(path.basename(files[0].path), 'b.typescript');
});

test(`compareSha1Digest ${pointer} should be an alias for compareContents`, t => {
	t.is(changed.compareContents, changed.compareSha1Digest);
});
