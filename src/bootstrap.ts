let _history = null;

export const getHistory = () => {

  if (!_history) {
    throw new Error('You have to bootstrap first.');
  }

  return _history;

};

export const bootstrap = history => {
  _history = history;
};
