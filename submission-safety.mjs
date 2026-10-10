const canonical = value => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

export function createSubmissionLedger() {
  const records = new Map();

  return {
    claim(kind, payload) {
      const key = `${kind}:${canonical(payload)}`;
      const previous = records.get(key);
      if (previous && previous.status !== 'rejected') {
        return {allowed: false, record: previous};
      }

      const record = {key, kind, status: 'pending', attempts: (previous?.attempts || 0) + 1};
      records.set(key, record);
      return {allowed: true, record};
    },

    settle(record, status) {
      if (!['accepted', 'uncertain', 'rejected'].includes(status)) {
        throw new TypeError(`Unsupported submission status: ${status}`);
      }
      if (records.get(record.key) !== record) return false;
      record.status = status;
      return true;
    }
  };
}

export function duplicateSubmissionMessage(status, subject) {
  if (status === 'pending') return `This ${subject} is already processing.`;
  if (status === 'accepted') return `This ${subject} was already accepted. Check its status before sending it again.`;
  if (status === 'uncertain') return `The previous ${subject} has an uncertain outcome. Verify it with the provider before retrying.`;
  return `This ${subject} was already submitted.`;
}
