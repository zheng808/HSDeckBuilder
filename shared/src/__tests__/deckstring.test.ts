import { describe, expect, it } from 'vitest';
import { decodeDeckstring, encodeDeckstring, extractDeckstring } from '../deckstring.js';
import { DEFAULT_HERO_DBF_ID } from '../constants.js';

describe('deckstring', () => {
  const cards = [
    { dbfId: 69501, count: 2 },
    { dbfId: 503, count: 1 },
    { dbfId: 179, count: 2 },
    { dbfId: 315, count: 1 },
  ];

  it('round-trips a standard mage deck', () => {
    const code = encodeDeckstring({ format: 'STANDARD', heroClass: 'MAGE', cards });
    expect(code.startsWith('AAE')).toBe(true); // every real deck code starts this way
    const decoded = decodeDeckstring(code);
    expect(decoded.format).toBe('STANDARD');
    expect(decoded.heroDbfId).toBe(DEFAULT_HERO_DBF_ID.MAGE);
    expect(decoded.heroClass).toBe('MAGE');
    expect(decoded.cards).toEqual([
      { dbfId: 315, count: 1 },
      { dbfId: 503, count: 1 },
      { dbfId: 179, count: 2 },
      { dbfId: 69501, count: 2 },
    ]);
  });

  it('encodes wild format and preserves it', () => {
    const decoded = decodeDeckstring(
      encodeDeckstring({ format: 'WILD', heroClass: 'HUNTER', cards }),
    );
    expect(decoded.format).toBe('WILD');
    expect(decoded.heroClass).toBe('HUNTER');
  });

  it('handles large varints (dbfIds above 16383)', () => {
    const big = [
      { dbfId: 134936, count: 1 },
      { dbfId: 128090, count: 2 },
    ];
    expect(
      decodeDeckstring(encodeDeckstring({ format: 'STANDARD', heroClass: 'PRIEST', cards: big }))
        .cards,
    ).toEqual([
      { dbfId: 134936, count: 1 },
      { dbfId: 128090, count: 2 },
    ]);
  });

  it('rejects garbage', () => {
    expect(() => decodeDeckstring('')).toThrow();
    expect(() => decodeDeckstring('not a deck code!!')).toThrow();
    expect(() => decodeDeckstring('AQID')).toThrow();
  });

  it('extracts the code from game-client text', () => {
    const text = [
      '### Frost Mage',
      '# Class: Mage',
      '#',
      'AAECAf0EAA==',
      '#',
      '# To use this deck, copy it',
    ].join('\n');
    expect(extractDeckstring(text)).toBe('AAECAf0EAA==');
  });
});
