// @flow
import {taskCreator_, type Task} from './core';

/**
 * # Legacy APIs
 *
 * These are provided as a stop-gap to avoid breaking changes.
 * They are currently re-exported by default, but that will
 * probaby change in the future.
 */

/**
 * ## `taskCreator`
 *
 * Given a function: `(arg, successCb, errorCb) => any`
 * Returns a task creator function: `(arg) => Task`.
 *
 * This API is a bit cumbersome.
 * You probably want to use `Task.fromCallback` or `Task.fromPromise` instead,
 * which do the same thing but with less boilerplate.
 */
export function taskCreator<Arg, +Inbound, +ErrorT>(
  fn: (Arg, (Inbound) => mixed, (ErrorT) => mixed) => mixed,
  label: string
): Arg => Task<Arg, Inbound, ErrorT> {
  const creator = (outbound: Arg) =>
    taskCreator_(
      (success, error) => fn(outbound, success, error),
      outbound,
      label
    );

  creator.type = label;

  return creator;
}
