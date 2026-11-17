import { expect, test } from 'bun:test';
import { render, renderJson, renderMarkdown, renderTable } from './output.ts';

const t = {
  header: ['', 'Name'],
  rows: [
    ['Space', 'abc'],
    ['Tab', '1'],
  ],
};

test('renderTable draws a box with centred headers and a rule between rows', () => {
  expect(renderTable(t)).toBe(
    [
      '┌───────┬──────┐',
      '│       │ Name │',
      '├───────┼──────┤',
      '│ Space │ abc  │',
      '├───────┼──────┤',
      '│ Tab   │ 1    │',
      '└───────┴──────┘',
    ].join('\n'),
  );
});

test('renderTable centres a header wider than its column and left-aligns the body', () => {
  expect(renderTable({ header: ['', 'Version'], rows: [['Tab', '1']] })).toBe(
    ['┌─────┬─────────┐', '│     │ Version │', '├─────┼─────────┤', '│ Tab │ 1       │', '└─────┴─────────┘'].join(
      '\n',
    ),
  );
});

test('renderTable centres a header narrower than its column', () => {
  expect(renderTable({ header: ['ID'], rows: [['abcdef']] }).split('\n')[1]).toBe('│   ID   │');
});

test('renderMarkdown pads columns', () => {
  expect(renderMarkdown(t)).toBe(
    ['|       | Name |', '| ----- | ---- |', '| Space | abc  |', '| Tab   | 1    |'].join('\n'),
  );
});

test('renderJson indents by two spaces', () => {
  expect(renderJson({ a: 1 })).toBe('{\n  "a": 1\n}');
});

test('render picks the output for each format', () => {
  const out = { plain: () => 'plain text', json: { a: 1 }, rows: () => t };
  expect(render('plain', out)).toBe('plain text');
  expect(render('json', out)).toBe(renderJson({ a: 1 }));
  expect(render('table', out)).toBe(renderTable(t));
  expect(render('markdown', out)).toBe(renderMarkdown(t));
});

test('renderMarkdown escapes pipes and flattens line breaks so cells stay in their columns', () => {
  expect(renderMarkdown({ header: ['A'], rows: [['a|b'], ['c\nd']] })).toBe(
    ['| A    |', '| ---- |', '| a\\|b |', '| c d  |'].join('\n'),
  );
});
