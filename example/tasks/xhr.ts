import {Task, taskCreator} from '../../src/tasks';

/**
 * These type defs aren't needed, but they help provide documentation
 * and improve readability.
 */
type Json = {[key: string]: any};

export type XhrTaskPayload = {
  url: string;
  json: Json;
};

export const XHR_TASK = taskCreator((payload: XhrTaskPayload, success, error) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      Math.random() > .3 ? success({}) : error('Opps');
      resolve();
    }, 500);
  });
}, 'XHR_TASK');
