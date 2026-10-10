import test from 'node:test';
import assert from 'node:assert/strict';
import {createSubmissionLedger, duplicateSubmissionMessage} from './submission-safety.mjs';

test('blocks identical in-flight, accepted, and uncertain submissions', () => {
  const ledger = createSubmissionLedger();
  const first = ledger.claim('callback', {phone: '+353871234567', service: 'Check-up'});
  assert.equal(first.allowed, true);
  assert.equal(ledger.claim('callback', {service: 'Check-up', phone: '+353871234567'}).allowed, false);

  ledger.settle(first.record, 'uncertain');
  const duplicate = ledger.claim('callback', {phone: '+353871234567', service: 'Check-up'});
  assert.equal(duplicate.allowed, false);
  assert.match(duplicateSubmissionMessage(duplicate.record.status, 'callback request'), /[Vv]erify it with the provider/);

  ledger.settle(first.record, 'accepted');
  assert.equal(ledger.claim('callback', {phone: '+353871234567', service: 'Check-up'}).allowed, false);
});

test('permits retry after a definitive rejection and counts attempts', () => {
  const ledger = createSubmissionLedger();
  const first = ledger.claim('booking', {slot: '2030-01-02T10:00'});
  ledger.settle(first.record, 'rejected');
  const retry = ledger.claim('booking', {slot: '2030-01-02T10:00'});
  assert.equal(retry.allowed, true);
  assert.equal(retry.record.attempts, 2);
});

test('keeps different patient requests independent', () => {
  const ledger = createSubmissionLedger();
  const first = ledger.claim('booking', {slot: '2030-01-02T10:00', email: 'one@example.com'});
  const second = ledger.claim('booking', {slot: '2030-01-02T10:00', email: 'two@example.com'});
  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
});
