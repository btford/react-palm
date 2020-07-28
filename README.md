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

    yarn add react-palm

### What is a Task?

`Task`s can be understood in terms of their relationship to `Promise`s. A `Promise` represents a future value, but for which the computation has already begun. A `Task` represents a future computation, or future side effect. It's like a function that you haven't run yet. `Task`s are lazy, where `Promise`s are eager.

Why? By capturing side effects this way, we can easily test them without having to build up a large suite of mocks. Code written this way is easy to test.

// Promise -> new Promise( () => window.fetch('example.com') )
// Promise -> new Promise( () => Math.random() )
// Promise -> new Promise( () => localStorage )

// Task -> () => new Promise( ... )

### Task Redux Middleware

`Task`s easily adapt to redux using the provided middleware. This allows you to build a state machine from `Action`s and `Task`s. Make side effects a responsibility of the reducer while keeping the reducer pure.

### Why does it matter?
By capturing side effects this way, we can easily test them without having to build up a large suite of mocks. 
The computation (when you call task.run()) might include a side-effect, but as long as the task is just sitting there, it's pure.
Keeps reducer pure. At the same time owns the entire flow of doing XHR.



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


### Usage

#### Task.fromPromise
Here is a sample of what a delay task which triggers an action after a
specified amount of time would look like.

```javascript
import Task from 'react-palm/tasks';

export const DELAY = Task.fromPromise((time) =>
  new Promise(resolve => window.setTimeout(resolve, time)), 
  
  'DELAY'
);
```

You can use the task in your reducer like this:

```javascript
import { withTask } from 'react-palm'
import { handleActions, createAction } from 'react-palm/actions'

import { DELAY } from './tasks/delay'

export const incrementWithDelay = createAction('DELAY_INCREMENT')
const increment = createAction('INCREMENT')

handleActions({
  DELAY_INCREMENT: state =>
    withTask(state, DELAY(1000).map(increment)),

  INCREMENT: state => state + 1
}, 0)
```

Dispatching `incrementWithDelay` will wait one second, then increment our counter state.

The call to `.map` tells us to wrap the result of the task in an `INCREMENT` action.

In the above example, we directly pass `state` as the first argument to `withTask`.
Whatever you pass as the first argument will become the updated state, so you
can update your state before the task is executed if you want. This might be useful
to update a loading spinner, for instance.

#### Task.fromCallback

#### Task.chain

#### Task.all

#### bimap


#### Testing

We designed `react-palm` with testing in mind. Since you probably don't want
to create API calls in a testing environment, we provide a `drainTasksForTesting`
utility that will remove all the tasks from the queue and return them.

You can now assert that they have the expected type and payload.

```javascript
import { drainTasksForTesting, succeedTaskInTest, errorTaskInTest } from 'react-palm'

import reducer, { incrementWithDelay } from './reducer'
import DELAY from './tasks/delay'

test('The delay task should be valid', t => {
  const state = reducer(42, incrementWithDelay())
  const tasks = drainTasksForTesting()

  t.is(state, 42)
  t.is(tasks.length, 1)
  t.is(tasks[0].type, DELAY)
  t.is(tasks[0].action.type, 'INCREMENT')

 
 // test success
 const successState = reducer(newState, succeedTaskInTest(task1, mockSuccessResult));
 t.deepEqual(successState, expectedState, ‘State should be updated when task succeed');

 // test LOAD_FILE_TASK error
 const errorState = reducer(nextState, errorTaskInTest(task1, mockErrorResult));
 t.deepEqual(errorState, expectedErrorState, ‘State should be updated when task errored);

 t.is(newState, 43)
})
```

You can also have a look to the [example](./example) directory for a complete
use-case.

### FAQ

##### Strategy? Framework? Library?

It's unlikely that you'll create a cohesive architecture if you piecemeal add requirements to
an existing design.

`react-palm` takes a "subtractive" approach; we start with a full set of concerns and make sure
that they work well together before breaking them up.
This means that as your app grows, you won't have to rethink everything.

##### Should I use this?

Ideally, you should use Elm or PureScript. This architecture is the closest thing to Elm I've managed to
make within the constraints of JavaScript, React, and Redux. I created it as a stop-gap for
specific applications that I work on. It contains trade-offs that may not be generally useful.

- [Elm](http://elm-lang.org), a friendly, functional, compile-to-JS language.
  - [The Elm Architecture (TEA)](https://guide.elm-lang.org/architecture/)
- [PureScript](http://www.purescript.org/), a feature-rich, functional compile-to-JS language.
- [Choo](https://github.com/yoshuawuyts/choo), a small, Elm-like framework for JavaScript.
- [redux-loop](https://github.com/redux-loop/redux-loop) a library that provides a very literal translation of commands and tasks from Elm to Redux.

### Developing

```
yarn
```

#### Publishing (to npm)

1. Update the version in `package.json` manually or via [`npm version`](https://docs.npmjs.com/getting-started/publishing-npm-packages#how-to-update-the-version-number).

2. Commit and push.

3. Create tags for the new version. Either:
  - use the [GitHub GUI](https://github.com/btford/react-palm/releases/new) to create and push new tags
  - or go [the old-fashioned route](https://git-scm.com/book/en/v2/Git-Basics-Tagging)

4. Publish:

Run `build` and publish from the resulting `dist` folder to ensure built artifacts are included in the published package:

```
yarn build
cd dist
npm publish
```
