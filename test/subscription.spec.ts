import test from 'ava';
import {spy} from 'sinon';
import {createStore, applyMiddleware} from 'redux';

import {makeSubscriptionMiddleware, makeSubscriptionType} from '../src/subscriptions';

test('Middleware only calls schedulers when subscriptions change', (t) => {
  let fakeState = {};

  function MY_SUB(params, action) {
    return {type: MY_SUB, params, action};
  }

  const MY_ACTION = spy();
  const myScheduler = spy();

  makeSubscriptionType(MY_SUB, myScheduler);

  const sub = MY_SUB(123, MY_ACTION);
  let subs = [sub];
  const subscribe = (_) => subs;
  const subMiddleware = makeSubscriptionMiddleware(subscribe);
  const store = createStore(() => fakeState, applyMiddleware(subMiddleware));

  let {args} = myScheduler.firstCall;

  t.is(args.length, 3, 'Scheduler called with three args');

  // we cannot know the identity of the dispatch function because of middleware
  // asserting that the first arg is in fact a function is good enough
  t.is(typeof args[0], 'function', 'Scheduler called with dispatch fn as first arg');
  t.deepEqual(args[1], [sub]);
  t.deepEqual(args[2], []);

  store.dispatch({type: 'DUMMY'});

  // because our subscriptions are the same, we should not call the scheduler again
  t.true(myScheduler.calledOnce);

  // however, if subscriptions change, the scheduler should be called again
  subs = [];
  store.dispatch({type: 'DUMMY'});
  t.true(myScheduler.calledTwice);

  // This time, we should see no subs added (arg[1]) and the existing sub removed (arg[2])
  args = myScheduler.secondCall.args;
  t.is(typeof args[0], 'function', 'Scheduler called with dispatch fn as first arg');
  t.deepEqual(args[1], []);
  t.deepEqual(args[2], [sub]);
});
