/*
 * Interfaces
 */
type SubType = any;
type Action = {type: any, payload: any};
type Dispatch = (action : Action) => void;
export type Subscription = {
  type: SubType,
  params: any,
  action: (...params: any[]) => Action
};

const SUB_TYPE_TO_SCHEDULER = Symbol('SUB_TYPE_TO_SCHEDULER');

type SubScheduler = (dispatch : Dispatch, added: Subscription[], removed: Subscription[]) => void;

export function makeSubscriptionType(type: SubType, scheduler: SubScheduler): SubType {
  type[SUB_TYPE_TO_SCHEDULER] = scheduler;
  return type;
}

/*
 * You need to install this middleware for tasks to have their handlers run.
 *
 * You probably do not want to use this middleware within your test environment.
 * Instead, use `drainTasksForTesting` to retrieve and make assertions about them.
 */
export const makeSubscriptionMiddleware = (subscribeFn : (any) => Subscription[]) => store => {
  const {dispatch, getState} = store;

  // Run scheduler for initial subscriptions
  let prevSubs = subscribeFn(getState());
  binByHandler(prevSubs).forEach((subs, handler) => handler(dispatch, subs, []));

  return next => action => {
    const returnValue = next(action);
    const state = getState();

    const nextSubs = subscribeFn(state);

    const {added, removed} = compareSubs(prevSubs, nextSubs);

    const addedBin = binByHandler(added),
          removedBin = binByHandler(removed);

    const schedulers = new Set(
      Array.from(addedBin.keys())
      .concat(Array.from(removedBin.keys()))
    );

    schedulers.forEach(scheduler =>
      scheduler(dispatch,
                addedBin.get(scheduler) || [],
                removedBin.get(scheduler) || []));

    prevSubs = nextSubs;

    return returnValue;
  };
};

function compareSubs(prev : Subscription[], next : Subscription[]) {
  const prevSubs = {};
  const added = [], removed = [];

  prev.forEach(sub => {
    prevSubs[serializeSubscription(sub)] = sub;
  });

  next.forEach(sub => {
    const serialized = serializeSubscription(sub);
    if (prevSubs[serialized]) {
      delete prevSubs[serialized];
    } else {
      added.push(sub);
    }
  });

  Object.keys(prevSubs).forEach(key => removed.push(prevSubs[key]));

  return {added, removed};
}

type SubscriptionBins = Map<SubScheduler, Subscription[]>;
function binByHandler(subscriptions: Subscription[]) : SubscriptionBins {
  const bins = new Map() as SubscriptionBins;
  subscriptions.forEach(sub => {
    const handler = sub.type[SUB_TYPE_TO_SCHEDULER];
    if (bins.get(handler)) {
      bins.get(handler).push(sub);
    } else {
      bins.set(handler, [sub]);
    }
  });
  return bins;
}

// we already assume type is the same due to binning
function serializeSubscription(sub : Subscription): string {
  // TODO: revisit this
  return JSON.stringify(sub);
}
