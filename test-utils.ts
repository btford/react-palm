export function makeForkUtil(reducer, createStore) {

  // this lets us more eligantly handle tests with dependant setups
  const FORK_RESET_STATE = Symbol('FORK_RESET_STATE');
  const augmentedReducer = (state, action) => {
    if (action.type === FORK_RESET_STATE) {
      return action.state;
    }
    return reducer(state, action);
  };

  const store = createStore(augmentedReducer);

  const fork = (firstFn, ...restFns) => {
    const state = store.getState();
    firstFn();
    restFns.forEach((fn) => {
      store.dispatch({type: FORK_RESET_STATE, state});
      fn();
    });
  };

  return {store, fork};
}
