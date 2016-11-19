import {makeSubscriptionType, Subscription} from '../subscriptions';
import {history} from './history';

export const HISTORY_SUBSCRIPTION = (action) =>
  ({type: HISTORY_SUBSCRIPTION, params: {}, action});

const subToListener = new Map() as Map<Subscription, Function>;

const MAKE_ASYNC_PROMISE = Promise.resolve(null);

makeSubscriptionType(HISTORY_SUBSCRIPTION, (dispatch, added, removed) => {
  added.forEach((subscription) => {
    const listener = (event) => dispatch(subscription.action(event));
    const unlisten = history.listen((event) =>
      MAKE_ASYNC_PROMISE.then(() => listener(event)));

    subToListener.set(subscription, unlisten);
  });

  removed.forEach(subscription => {
    const unlisten = subToListener.get(subscription);
    subToListener.delete(subscription);
    unlisten();
  });
});
