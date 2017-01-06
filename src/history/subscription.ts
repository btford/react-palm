import {makeSubscriptionType, Subscription} from '../subscriptions';
import {getHistory} from '../bootstrap';

export const HISTORY_SUBSCRIPTION = (action) =>
  ({type: HISTORY_SUBSCRIPTION, params: {}, action});

const subToListener = new Map() as Map<Subscription, Function>;

const MAKE_ASYNC_PROMISE = Promise.resolve(null);

makeSubscriptionType(HISTORY_SUBSCRIPTION, (dispatch, added, removed) => {
  added.forEach((subscription) => {
    const listener = event => dispatch(subscription.action(event));
    const unlisten = getHistory().listen(event => {
      return MAKE_ASYNC_PROMISE
        .then(() => listener(`${event.pathname}${event.search}${event.hash}`));
    });

    subToListener.set(subscription, unlisten);
  });

  removed.forEach(subscription => {
    const unlisten = subToListener.get(subscription);
    subToListener.delete(subscription);
    unlisten();
  });
});
