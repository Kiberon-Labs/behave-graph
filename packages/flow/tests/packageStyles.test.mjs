import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';

test('public CSS entry includes every emitted plugin stylesheet', async () => {
  const dist = new URL('../dist/', import.meta.url);
  const entry = await readFile(new URL('entry.css', dist), 'utf8');
  const styles = (await readdir(dist)).filter(
    (file) => file.endsWith('.css') && file !== 'entry.css'
  );
  assert.ok(styles.length > 1, 'Expect core CSS and lazy plugin CSS');
  for (const file of styles) {
    assert.ok(entry.includes('./' + file), file + ' is missing from entry.css');
    assert.equal(
      entry.split('./' + file).length - 1,
      1,
      file + ' is imported more than once'
    );
  }
  const contents = await Promise.all(
    styles.map((file) => readFile(new URL(file, dist), 'utf8'))
  );
  assert.ok(
    contents.some(
      (css) => css.includes('_header') && css.includes('padding:1rem')
    ),
    'Documentation panel padding must be present in the published CSS'
  );
});
