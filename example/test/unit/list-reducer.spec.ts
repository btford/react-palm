import test from 'ava';
import {
  drainTasksForTesting,
  succeedTaskInTest,
  errorTaskInTest
} from '../../../src/tasks';

import {XHR_TASK} from '../../tasks/xhr';
import {listReducer, CHANGE_INPUT, ADD_ITEM, ADD_ITEM_EAGER} from '../../list';

test('Eagerly adding an item', (t) => {
  const newItem = '123';
  const state = listReducer(undefined, CHANGE_INPUT(newItem));
  t.is(state.inputValue, newItem);

  const addItemState = listReducer(state, ADD_ITEM_EAGER());
  t.true(addItemState.isLoading);
  t.deepEqual(addItemState.items, ['hi', '123']);

  const tasks = drainTasksForTesting();

  t.is(tasks.length, 1);

  const xhrTask = tasks[0];

  t.deepEqual(xhrTask.payload, {
    url: '/api/add-item',
    json: {item: newItem}
  });
  t.is(xhrTask.type, 'XHR_TASK');

  const successState = listReducer(addItemState, succeedTaskInTest(xhrTask));
  t.false(successState.isLoading);
  t.is(successState.error, '');

  const errorMsg = 'It broke!';
  const rollbackState = listReducer(addItemState, errorTaskInTest(xhrTask, errorMsg));
  t.false(rollbackState.isLoading);
  t.is(rollbackState.error, errorMsg);
  t.deepEqual(rollbackState.items, ['hi']);
});

test('Pessimistically adding an item', (t) => {
  const newItem = '123';
  const state = listReducer(undefined, CHANGE_INPUT(newItem));
  t.is(state.inputValue, newItem);

  const addItemState = listReducer(state, ADD_ITEM());
  t.true(addItemState.isLoading);
  t.deepEqual(addItemState.items, ['hi']);

  const tasks = drainTasksForTesting();

  t.is(tasks.length, 1);

  const xhrTask = tasks[0];

  t.deepEqual(xhrTask.payload, {
    url: '/api/add-item',
    json: {item: newItem}
  });
  t.is(xhrTask.type, 'XHR_TASK');

  const successState = listReducer(addItemState, succeedTaskInTest(xhrTask));
  t.false(successState.isLoading);
  t.is(successState.error, '');
  t.deepEqual(successState.items, ['hi', '123']);

  const errorMsg = 'It broke!';
  const rollbackState = listReducer(addItemState, errorTaskInTest(xhrTask, errorMsg));
  t.false(rollbackState.isLoading);
  t.is(rollbackState.error, errorMsg);
  t.deepEqual(rollbackState.items, ['hi']);
});
