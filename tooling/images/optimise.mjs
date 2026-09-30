#!/usr/bin/env node
/**
 * Image optimisation for the frontends.
 *
 * Exists because the alternative was worse. The landing page's source images
 * arrived at 9.9 MB — a 2,093px logo displayed at 40px, and four PNG
 * photographs averaging 2.3 MB each. Optimising them by hand meant reaching
 * into `node_modules/.pnpm/sharp@…/` by path, because sharp was only present
 * as a transitive dependency of Next.js. That path changes whenever Next
 * changes its dependency, and a one-off command leaves no record of what was
 * done or why.
 *
 * So this is a declared dependency and a repeatable script.
 *
 * **It does not run in CI and is not part of `pnpm verify`.** Optimising
 * images is a deliberate act with a judgement in it — how much quality a given
 * photograph can lose behind a given scrim — not something to apply
 * automatically to whatever lands in a directory. Committing the optimised
 * result is what makes the build reproducible; re-deriving it on every build
 * would make image weight depend on a library version.
 *
 * Usage:
 *   node tooling/images/optimise.mjs --check          report only
 *   node tooling/images/optimise.mjs <file> [options]
 *
 * Options:
 *   --width=N       resize to N wide, never enlarging
 *   --height=N      resize to N tall (with --width, crops to fill)
 *   --quality=N     JPEG quality, default 72
 *   --to=jpg|png    output format, default: keep
 *   --out=PATH      write here instead of beside the source
 */

import { readdir, stat, unlink } from 'node:fs/promises';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import sharp from 'sharp';

/**
 * Directories scanned by `--check`.
 *
 * Only what ships to a browser. `docs/` holds reference images that are read
 * by people, not downloaded by readers, so their weight is not a performance
 * question.
 */
const SERVED = ['apps/web/public', 'apps/zedek/public', 'apps/backoffice/public'];

/**
 * Weight above which a served image is worth questioning.
 *
 * Not a hard limit. A full-bleed hero photograph legitimately costs more than
 * an icon, so this flags rather than fails — the judgement stays with a person.
 */
const LARGE_KB = 200;

/**
 * Pixel width above which an image is larger than any display can use.
 *
 * 2x a 1,920px viewport. Beyond this the extra pixels are decoded and thrown
 * away, which costs memory and time on exactly the mobile devices §31 targets.
 */
const MAX_USEFUL_WIDTH = 3_840;

const KB = (bytes) => Math.round(bytes / 1024);

const IMAGE = /\.(png|jpe?g|webp|avif)$/i;

async function* walk(dir) {
  let entries;

  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    // A frontend without a public directory is not an error.
    return;
  }

  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (IMAGE.test(entry.name)) yield path;
  }
}

/** Report on every served image without changing anything. */
async function check() {
  let total = 0;
  let flagged = 0;
  const rows = [];

  for (const dir of SERVED) {
    for await (const path of walk(dir)) {
      const { size } = await stat(path);
      const { width, height } = await sharp(path).metadata();
      total += size;

      const notes = [];
      if (KB(size) > LARGE_KB) notes.push(`>${LARGE_KB}KB`);
      if ((width ?? 0) > MAX_USEFUL_WIDTH) notes.push(`${width}px wide`);
      if (extname(path).toLowerCase() === '.png' && KB(size) > LARGE_KB) {
        // A large PNG is usually a photograph in the wrong format. PNG is
        // lossless, so a photograph costs several times what the same image
        // costs as a JPEG with no visible difference behind a scrim.
        notes.push('PNG — try JPEG?');
      }

      if (notes.length > 0) flagged += 1;
      rows.push({ path, size, width, height, notes });
    }
  }

  rows.sort((a, b) => b.size - a.size);

  for (const row of rows) {
    const flag = row.notes.length > 0 ? `  ← ${row.notes.join(', ')}` : '';
    console.log(
      `${String(KB(row.size)).padStart(6)} KB  ${String(row.width ?? '?').padStart(5)}x${String(
        row.height ?? '?',
      ).padEnd(5)}  ${row.path}${flag}`,
    );
  }

  console.log(`\n${rows.length} image(s), ${KB(total)} KB total, ${flagged} worth a look.`);

  // Always exits 0. This reports; it does not gate.
  return 0;
}

/** Optimise one file. */
async function optimise(source, options) {
  const before = (await stat(source)).size;
  const meta = await sharp(source).metadata();

  const ext = (options.to ?? extname(source).slice(1)).toLowerCase();
  const format = ext === 'jpg' || ext === 'jpeg' ? 'jpeg' : ext;

  if (format !== 'jpeg' && format !== 'png' && format !== 'webp') {
    throw new Error(`Unsupported output format: ${format}`);
  }

  const target =
    options.out ??
    join(dirname(source), `${basename(source, extname(source))}.${format === 'jpeg' ? 'jpg' : format}`);

  let pipeline = sharp(source);

  if (options.width || options.height) {
    pipeline = pipeline.resize(options.width ?? null, options.height ?? null, {
      // Never enlarge: upscaling adds bytes and no detail.
      withoutEnlargement: true,
      // With both dimensions, crop to fill rather than letterbox. `attention`
      // keeps the visually busiest region, which for a photograph used as a
      // backdrop is the part worth keeping.
      ...(options.width && options.height ? { fit: 'cover', position: 'attention' } : {}),
    });
  }

  if (format === 'jpeg') {
    pipeline = pipeline.jpeg({
      quality: options.quality ?? 72,
      // mozjpeg is measurably smaller at the same visual quality.
      mozjpeg: true,
      // Progressive renders a usable image before the bytes finish arriving,
      // which matters on the connections §31 targets.
      progressive: true,
    });
  } else if (format === 'png') {
    // `palette` quantises to 256 colours. Right for a logo or a flat graphic,
    // wrong for a photograph — which should be a JPEG anyway.
    pipeline = pipeline.png({ compressionLevel: 9, palette: true });
  } else {
    pipeline = pipeline.webp({ quality: options.quality ?? 72 });
  }

  // Writing to the file being read truncates it mid-pipeline, so a same-path
  // rewrite goes via a temporary.
  const sameFile = resolve(target) === resolve(source);
  const written = sameFile ? `${target}.tmp` : target;

  const info = await pipeline.toFile(written);

  if (sameFile) {
    const { rename } = await import('node:fs/promises');
    await rename(written, target);
  }

  const saved = before - info.size;
  const percent = before === 0 ? 0 : Math.round((saved / before) * 100);

  console.log(`${relative(process.cwd(), source)}`);
  console.log(`  ${meta.width}x${meta.height}  ${KB(before)} KB`);
  console.log(`  ${info.width}x${info.height}  ${KB(info.size)} KB  (${percent}% smaller)`);
  if (!sameFile) console.log(`  → ${relative(process.cwd(), target)}`);

  // A "saving" that costs bytes means the source was already better. Say so
  // rather than quietly shipping the worse file.
  if (saved <= 0) {
    console.log('  Note: the result is no smaller. Keep the original.');
    if (!sameFile) await unlink(target).catch(() => undefined);
  }

  return 0;
}

function parse(argv) {
  const options = {};
  const files = [];

  for (const arg of argv) {
    if (!arg.startsWith('--')) {
      files.push(arg);
      continue;
    }

    const [name, value] = arg.slice(2).split('=');
    if (name === 'check') options.check = true;
    else if (name === 'width') options.width = Number.parseInt(value ?? '', 10);
    else if (name === 'height') options.height = Number.parseInt(value ?? '', 10);
    else if (name === 'quality') options.quality = Number.parseInt(value ?? '', 10);
    else if (name === 'to') options.to = value;
    else if (name === 'out') options.out = value;
    else throw new Error(`Unknown option: --${name}`);
  }

  return { options, files };
}

async function main() {
  const { options, files } = parse(process.argv.slice(2));

  if (options.check) return check();

  if (files.length === 0) {
    console.log(
      [
        'Optimise an image, or report on what is served.',
        '',
        '  node tooling/images/optimise.mjs --check',
        '  node tooling/images/optimise.mjs <file> [--width=N] [--height=N]',
        '                                          [--quality=N] [--to=jpg|png] [--out=PATH]',
        '',
        'Not part of pnpm verify: optimising an image is a judgement, and the',
        'optimised result is committed so the build stays reproducible.',
      ].join('\n'),
    );

    return 0;
  }

  for (const file of files) await optimise(file, options);

  return 0;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  },
);
