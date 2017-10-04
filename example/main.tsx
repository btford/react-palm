import React, {render} from '../src/react';
import {createStore, applyMiddleware} from 'redux';
import {connect, Provider} from 'react-redux';
import {taskMiddleware} from '../src/tasks';

import {ListComponent, listReducer} from './list';

const store = createStore(
  listReducer,
  applyMiddleware(taskMiddleware as any)
);

const ConnectedApp = connect(
  state => state,
  dispatch => ({dispatch})
)(ListComponent) as any;

render(
  <Provider store={store}>
    <ConnectedApp />
  </Provider>,
  window.document.getElementById('app-container'),
  action => store.dispatch(action)
);
