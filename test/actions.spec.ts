import test from 'ava';
import {spy, stub} from 'sinon';
import {handleActions, laxHandleActions, createAction} from '../actions';

const MY_ACTION = createAction();

test('handleActions works', (t) => {
  const reducer = handleActions({
    [MY_ACTION.toString()]: (state, {items}) => items
  }, {});

  const payload = {hi: 'there'};

  t.deepEqual(reducer({old: 'value'}, MY_ACTION({items: payload})), payload);
});

test('handleActions reducer throws when a handler returns undefined', (t) => {
  // TODO: provide a builder API for TS so you don't have to do this `toString` hack
  const reducer = handleActions({
    [MY_ACTION.toString()]: (state, {items}) => undefined
  }, {});

  t.throws(() => reducer({}, MY_ACTION()));
});

test('handleActions reducer throws when called with an unknown action type', (t) => {
  const UNKNOWN_ACTION = createAction();

  // TODO: provide a builder API for TS so you don't have to do this `toString` hack
  const reducer = handleActions({
    [MY_ACTION.toString()]: (state, {items}) => items
  }, {});

  t.throws(() => reducer({}, UNKNOWN_ACTION()));
});

test('handleActions reducer throws when called with an action creator', (t) => {
  // TODO: provide a builder API for TS so you don't have to do this `toString` hack
  const reducer = handleActions({
    [MY_ACTION.toString()]: (state, {items}) => items
  }, {});

  t.throws(() => reducer({}, MY_ACTION));
});

test('handleActions reducer throws when called without a payload', (t) => {
  // TODO: provide a builder API for TS so you don't have to do this `toString` hack
  const reducer = handleActions({
    [MY_ACTION.toString()]: (state, {items}) => items
  }, {});

  t.throws(() => reducer({}, {type: MY_ACTION}));
});

test('handleActions reducer passes extra params to handler', (t) => {
  const handler = stub();
  handler.returns({});

  // TODO: provide a builder API for TS so you don't have to do this `toString` hack
  const reducer = handleActions({
    [MY_ACTION.toString()]: handler
  }, {});

  reducer({}, MY_ACTION(123), 'extra1', {extra: 2});

  t.deepEqual(handler.firstCall.args, [{}, 123, 'extra1', {extra: 2}]);
});


test('laxHandleActions works', (t) => {
  const reducer = laxHandleActions({
    [MY_ACTION.toString()]: (state, {items}) => items
  }, {});

  const payload = {hi: 'there'};

  t.deepEqual(reducer({old: 'value'}, MY_ACTION({items: payload})), payload);
});

test('laxHandleActions reducer allows a handler to return undefined', (t) => {
  // TODO: provide a builder API for TS so you don't have to do this `toString` hack
  const reducer = laxHandleActions({
    [MY_ACTION.toString()]: (state, {items}) => undefined
  }, {});

  t.is(reducer({}, MY_ACTION()), undefined);
});

test('laxHandleActions reducer returns initial state when called with an unknown action type', (t) => {
  const UNKNOWN_ACTION = createAction();

  // TODO: provide a builder API for TS so you don't have to do this `toString` hack
  const reducer = laxHandleActions({
    [MY_ACTION.toString()]: (state, {items}) => items
  }, {});

  const initialState = {one: 'two'};

  t.is(reducer(initialState, UNKNOWN_ACTION()), initialState);
});

test('laxHandleActions reducer passes entire action when called without a payload', (t) => {
  // TODO: provide a builder API for TS so you don't have to do this `toString` hack
  const reducer = laxHandleActions({
    [MY_ACTION.toString()]: (state, action) => action
  }, {});

  const action = {type: MY_ACTION};

  t.is(reducer({}, action), action);
});

test('laxHandleActions reducer passes extra params to handler', (t) => {
  const handler = spy();
  // TODO: provide a builder API for TS so you don't have to do this `toString` hack
  const reducer = laxHandleActions({
    [MY_ACTION.toString()]: handler
  }, {});

  reducer({}, MY_ACTION(123), 'extra1', {extra: 2});

  t.deepEqual(handler.firstCall.args, [{}, 123, 'extra1', {extra: 2}]);
});
