// @flow

import {Task, taskCreator} from 'react-palm/tasks';
import type {Task$TaskInstance} from 'react-palm/tasks';

type OddNumRejection = {
  badNews: string
};

const evenIsGoodButOddIsBad = (number: number) => number % 2 == 0 ?
  Promise.resolve({congrats: 'nice. you passed an even number'}) :
  Promise.reject({badNews: 'ah sorry kid. you gotta pass an even number.'});

const coolTask :
  (number) => Task$TaskInstance<{congrats: string}, OddNumRejection> = taskCreator((payload: number, success, error) =>
  evenIsGoodButOddIsBad(payload).then(
    success,
    error
  ), 'WOW');

const greatTask : (string) =>
  Task$TaskInstance<string, string> =
    taskCreator((payload: string, success, error) =>
      payload.length > 2 ? success(payload) : error(payload),
    'YAY');

coolTask(3).map(x => x.congrats).map(x => x.toUpperCase());
coolTask(3).bimap(x => x.congrats, z => z.badNews);

greatTask('Balt').map(b => b);

// Task.all should preserve the types of success and error handlers
Task.all([
  coolTask(1),
  greatTask('Balt')
])
.map(a =>
  a[0].congrats + ' ' + a[1])
.bimap(
  s => s.toUpperCase(),
  ([err1, err2]) => 'errors: ' + err1.badNews + ' ' + err2
);
