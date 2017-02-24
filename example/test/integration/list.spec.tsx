import test from 'ava';
import React, {withDispatch} from '../../../src/react';
import {mount} from 'enzyme';
import {createStore} from 'redux';
import {connect, Provider} from 'react-redux';
import {
  drainTasksForTesting,
  succeedTaskInTest,
  errorTaskInTest
} from '../../../src/tasks';
import {makeForkUtil} from '../../../src/test-utils';

import {ListComponent, listReducer} from '../../list';
import {XHR_TASK} from '../../tasks/xhr';

test('Pessimistically adding an item', withFixtures(({t, wrapper, store, fork}) => {
  const newItem = '123';
  t.deepEqual(listItems(wrapper), ['hi']);

  wrapper.find('input').simulate('change', {target: {value: newItem}});
  wrapper.find('#add-item').simulate('click');
  t.deepEqual(listItems(wrapper), ['hi']);

  const tasks = drainTasksForTesting();
  t.is(tasks.length, 1);

  const xhrTask = tasks[0];
  assertAddItemTask(t, xhrTask, newItem);

  fork(() => {
    store.dispatch(succeedTaskInTest(xhrTask));
    t.deepEqual(listItems(wrapper), ['hi', newItem]);
  }, () => {
    const errMsg = 'Not works';
    store.dispatch(errorTaskInTest(xhrTask, errMsg));
    t.deepEqual(listItems(wrapper), ['hi']);
  });
}));

test('Eagerly adding an item', withFixtures(({t, wrapper, store, fork}) => {
  const newItem = '123';

  t.deepEqual(listItems(wrapper), ['hi']);

  wrapper.find('input').simulate('change', {target: {value: newItem}});
  wrapper.find('#add-item-eager').simulate('click');
  t.deepEqual(listItems(wrapper), ['hi', newItem]);

  const tasks = drainTasksForTesting();
  t.is(tasks.length, 1);

  const xhrTask = tasks[0];
  assertAddItemTask(t, xhrTask, newItem);

  fork(() => {
    store.dispatch(succeedTaskInTest(xhrTask));
    t.deepEqual(listItems(wrapper), ['hi', newItem]);
  }, () => {
    const errMsg = 'Not works';
    store.dispatch(errorTaskInTest(xhrTask, errMsg));
    t.deepEqual(listItems(wrapper), ['hi']);
  });
}));

function assertAddItemTask(t, task, newItem) {
  t.deepEqual(task.payload, {
    url: '/api/add-item',
    json: {item: newItem}
  });
  t.is(task.type, 'XHR_TASK');
}

function withFixtures(doSpec) {
  const {store, fork} = makeForkUtil(listReducer, createStore);

  const ConnectedApp = connect(
    state => state,
    dispatch => ({dispatch})
  )(ListComponent) as any;

  const wrapper = mount(
    <Provider store={store}>
      {withDispatch(store.dispatch, <ConnectedApp />)}
    </Provider>
  );

  return function wrappedSpec(t) {
    doSpec({t, store, wrapper, fork});
  };
}

function listItems(wrapper) {
  return wrapper.find('li').map(node => node.text());
}
