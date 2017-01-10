<p align="right">
  <a href="https://npmjs.org/package/react-palm">
    <img src="https://img.shields.io/npm/v/react-palm.svg?style=flat-square" alt="version" />
  </a>
  <a href="https://travis-ci.org/btford/react-palm">
    <img src="https://img.shields.io/travis/btford/react-palm/master.svg?style=flat-square" alt="build" />
  </a>
  <a href="https://npmjs.org/package/react-palm">
    <img src="https://img.shields.io/npm/dm/react-palm.svg?style=flat-square" alt="downloads" />
  </a>
</p>

<h1 align="center">react-palm</h1>
<h5 align="center">A cohesive strategy for managing state, handling side effects, and testing React Apps.</h5>

<p align="center">:warning: This is very work in progress, please don't bother me about it, thanks. :warning:</p>

    npm install react-palm -S

### Setup

Add the `taskMiddleware` to your store, or the tasks handlers won't get called.

```javascript
import { createStore, applyMiddleware, compose } from 'redux'
import { taskMiddleware } from 'react-palm'

import reducer from './reducer'

// using createStore
const store = createStore(reducer, applyMiddleWare(taskMiddleware))

// using enhancers
const initialState = {}
const middlewares = [taskMiddleware]
const enhancers = [
  applyMiddleware(...middlewares)
]

const store = createStore(reducer, initialState, compose(...enhancers))
```

If you're using the redux-devtools extension, you might want to have readable actions types,
since it doesn't handle `Symbol` objects pretty well by default.

```javascript
__REDUX_DEVTOOLS_EXTENSION__({
  serializeAction: (key, value) => {
    if (typeof value === 'function' && typeof value.toString() === 'symbol') {
      return value.toString().toString()
    }
    return value
  }
})
```

### Usage

Here is a sample of what a delay task which triggers an action after a
specified amount of time would look like.

```javascript
import { makeTaskType } from 'react-palm'

const DELAY = ({ action, time }) => ({ type: DELAY, action, time })

makeTaskType(DELAY, ({time, success}) =>
  new Promise(resolve => setTimeout(resolve, time))
    .then(() => success())
)
```

The usage of thus task in the reducer could be something like this.

```javascript
import { withTask } from 'react-palm'
import { handleActions, createAction } from 'react-palm/actions'

import DELAY from './tasks/delay'

export const incrementWithDelay = createAction('DELAY_INCREMENT')
const increment = createAction('INCREMENT')

handleActions({
  INCREMENT: state => ++state,
  DELAY_INCREMENT: state => withTask(state, DELAY(increment(), 1E3))
}, 0)
```

With this implementation, dispatching `incrementWithDelay` will increase our
counter state after exactly one second. Notice the first argument to `withTask`
simply pass the `state` again, but you may want to use it to update your state
before the task is executed, to change the loading status of your app in the
context of an api call for instance.

#### Routing

Here is an example router with two root routes and one child route for the user.

```javascript
import { u, createRouter } from 'react-palm'

const { routes, handlers, INITIAL_STATE } = createRouter({
  home: { url: u`/`, component: Home },
  user: { url: u`/users/${{uid: Number}}`, component: User, childRoutes: {
    post: { url: u`/posts/${{pid: Number}}`, component: Post },
    chat: { url: u`/chat/${{cid: Number}}`, redirectTo: (routes, params) => routes.user(params) }
  }}
})
```

You should now be able to use the history api by dispatching the `HISTORY_PUSH`
action with the pathname as payload.

A Link path could be constructed like this.

```javascript
const path = routes.user({ uid: 4 }).post({ pid: 2 })
console.log(path === '/users/4/posts/2') // true
```

#### Testing

`react-palm` has been designed with testing in mind. Since you probably don't want
to create api calls in a testing environment, we provide a `drainTasksForTesting`
utility that will remove all the tasks from the queue and return them.

You can now assert over these to make sure they are of the good type and using a
valid payload.

```javascript
import { drainTasksForTesting } from 'react-palm'

import reducer, { incrementWithDelay } from './reducer'
import DELAY from './tasks/delay'

test('The delay task should be valid', t => {
  const state = reducer(42, incrementWithDelay())
  const tasks = drainTasksForTesting()

  t.is(state, 42)
  t.is(tasks.length, 1)
  t.is(tasks[0].type, DELAY)
  t.is(tasks[0].action.type, 'INCREMENT')

  const newState = reducer(state, task.action)
  t.is(newState, 43)
})
```

You can also have a look to the [example](./example) directory for a complete
use-case.

### FAQ

##### Strategy? Framework? Library?

It's very unlikely that you'll create a cohesive architecture if you piecemeal add requirements to
an existing design.

`react-palm` takes a "subtractive" approach; we start with a full set of concerns and make sure
that they work well together before breaking them up.
This means that as your app grows, you won't have to rethink everything.

##### Should I use this?

Ideally, you should use Elm. This architecture is the closest thing to Elm I've managed to
make within the constraints of JavaScript and React.

[Choo](https://github.com/yoshuawuyts/choo) looks good too.
