import * as React from 'react';
import {createStore, applyMiddleware} from 'redux';
import {Provider, connect} from 'react-redux';

import {makeSubscriptionMiddleware} from '../subscriptions';
import {taskMiddleware} from '../tasks';

import ChildRoute from '../routing/child-route';

export function makeStore({subscribe, reducer}) {
  return createStore(
    reducer,
    applyMiddleware(
      taskMiddleware,
      makeSubscriptionMiddleware(subscribe)
    )
  );
}

export function connectApp({store, App}) {
  const RootRoute = (props: {routing}) => {
    const {routes} = props.routing;
    return (<ChildRoute {...props} routes={routes} />);
  };

  const ConnectedApp = connect(
    state => state,
    dispatch => ({dispatch})
  )(RootRoute);

  return (
    <Provider store={store}>
      <App><ConnectedApp /></App>
    </Provider>
  );
}

export function bootstrap({subscribe, reducer, App}) {
  const store = makeStore({subscribe, reducer});
  const app = connectApp({store, App});
  return {app, store};
}
