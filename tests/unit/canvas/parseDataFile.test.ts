import { describe, it, expect } from 'vitest';
import { parseCSV, parseJSON } from '@/utils/canvas/parseDataFile';

describe('parseCSV', () => {
  it('parses simple CSV with header', () => {
    const csv = `name,color\nNike,red\nAdidas,black`;
    const { rows, columns, error } = parseCSV(csv);
    expect(error).toBeUndefined();
    expect(columns).toEqual(['name', 'color']);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ name: 'Nike', color: 'red' });
    expect(rows[1]).toEqual({ name: 'Adidas', color: 'black' });
  });

  it('trims whitespace from headers and values', () => {
    const csv = ` name , color \n Nike , red `;
    const { rows, columns } = parseCSV(csv);
    expect(columns).toEqual(['name', 'color']);
    expect(rows[0]).toEqual({ name: 'Nike', color: 'red' });
  });

  it('skips empty lines', () => {
    const csv = `name,color\nNike,red\n\nAdidas,black\n`;
    const { rows } = parseCSV(csv);
    expect(rows).toHaveLength(2);
  });

  it('handles CSV with quoted commas', () => {
    const csv = `name,tagline\nNike,"Just Do It, always"`;
    const { rows } = parseCSV(csv);
    expect(rows[0].tagline).toBe('Just Do It, always');
  });
});

describe('parseJSON', () => {
  it('parses array of objects', () => {
    const json = JSON.stringify([{ name: 'Nike', color: 'red' }, { name: 'Adidas', color: 'black' }]);
    const { rows, columns, error } = parseJSON(json);
    expect(error).toBeUndefined();
    expect(columns).toEqual(['name', 'color']);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ name: 'Nike', color: 'red' });
  });

  it('wraps a single object in an array', () => {
    const json = JSON.stringify({ name: 'Nike' });
    const { rows } = parseJSON(json);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Nike');
  });

  it('converts non-string values to strings', () => {
    const json = JSON.stringify([{ count: 42, active: true }]);
    const { rows } = parseJSON(json);
    expect(rows[0].count).toBe('42');
    expect(rows[0].active).toBe('true');
  });

  it('returns error on invalid JSON', () => {
    const { rows, error } = parseJSON('not json {');
    expect(error).toBeDefined();
    expect(rows).toHaveLength(0);
  });
});
