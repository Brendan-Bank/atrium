// Copyright (c) 2026 Brendan Bank
// SPDX-License-Identifier: BSD-2-Clause

import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  brandPascal,
  defaultBrandName,
  defaultHostPkg,
  validateBrandName,
  validateBrandPrimary,
  validateHostName,
  validateHostPkg,
} from '../src/names.js';

describe('validateHostName', () => {
  it('accepts canonical names', () => {
    assert.equal(validateHostName('casa'), true);
    assert.equal(validateHostName('casa-del-leone'), true);
    assert.equal(validateHostName('booking-app-2'), true);
  });

  it('rejects empty / uppercase / leading-digit / consecutive-dash', () => {
    assert.notEqual(validateHostName(''), true);
    assert.notEqual(validateHostName('Casa'), true);
    assert.notEqual(validateHostName('1bookings'), true);
    assert.notEqual(validateHostName('casa--del'), true);
    assert.notEqual(validateHostName('casa-'), true);
    assert.notEqual(validateHostName('-casa'), true);
  });
});

describe('validateHostPkg', () => {
  it('accepts canonical Python module names', () => {
    assert.equal(validateHostPkg('casa'), true);
    assert.equal(validateHostPkg('casa_del_leone'), true);
    assert.equal(validateHostPkg('app2'), true);
  });

  it('rejects keywords, reserved names, and invalid identifiers', () => {
    assert.notEqual(validateHostPkg('class'), true);
    assert.notEqual(validateHostPkg('app'), true);
    assert.notEqual(validateHostPkg('1bookings'), true);
    assert.notEqual(validateHostPkg('Casa'), true);
    assert.notEqual(validateHostPkg('casa-del'), true);
  });
});

describe('validateBrandPrimary', () => {
  it('accepts Mantine palette names', () => {
    assert.equal(validateBrandPrimary('blue'), true);
    assert.equal(validateBrandPrimary('teal'), true);
  });
  it('rejects unknown colours', () => {
    assert.notEqual(validateBrandPrimary('chartreuse'), true);
    assert.notEqual(validateBrandPrimary(''), true);
  });
});

describe('validateBrandName', () => {
  it('accepts non-empty strings under 60 chars', () => {
    assert.equal(validateBrandName('Casa'), true);
    assert.equal(validateBrandName('Casa del Leone'), true);
  });
  it('rejects empty + over-long', () => {
    assert.notEqual(validateBrandName(''), true);
    assert.notEqual(validateBrandName('x'.repeat(70)), true);
  });
});

describe('defaultHostPkg', () => {
  it('replaces dashes with underscores', () => {
    assert.equal(defaultHostPkg('casa'), 'casa');
    assert.equal(defaultHostPkg('casa-del-leone'), 'casa_del_leone');
  });
});

describe('defaultBrandName', () => {
  it('title-cases dash-separated names', () => {
    assert.equal(defaultBrandName('casa'), 'Casa');
    assert.equal(defaultBrandName('casa-del-leone'), 'Casa Del Leone');
  });
});

describe('brandPascal', () => {
  it('PascalCases brand names', () => {
    assert.equal(brandPascal('Casa'), 'Casa');
    assert.equal(brandPascal('Casa del Leone'), 'CasaDelLeone');
    assert.equal(brandPascal('booking-app'), 'BookingApp');
  });
  it('strips punctuation', () => {
    assert.equal(brandPascal('A & B'), 'AB');
    assert.equal(brandPascal("O'Reilly"), 'OReilly');
  });
});
