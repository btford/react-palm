// @flow
export * from './tasks/test-utils';

const FORK_RESET_STATE = '__REACT_PALM__FORK_RESET_STATE';

const augmentedReducer = reducer => (state, action) => {
  if (action.type === FORK_RESET_STATE) {
    return action.state;
  }
  return reducer(state, action);
};

export function makeForkUtil(reducer, createStore) {
  // this lets us more eligantly handle tests with dependant setups
  const store = createStore(augmentedReducer(reducer));

  const fork = (title: string, testFn: Function) => {
    const state = store.getState();
    testFn();
    store.dispatch({type: FORK_RESET_STATE, state});
  };

  return {store, fork};
}
