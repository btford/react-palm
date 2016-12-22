# Task Example app

This is a very minimal todo list app. It's meant to show how to use tasks.
Because of this, it avoids using too many external libraries.

The `test` folder shows how you would write tests to verify the behavior of the app.
It includes both unit and integration tests.

You'll notice that both tests are very similar. This is meant to show mechanically how to write
the tests. Developing a testing strategy (what do I unit test? what do I integration test?) depends
more on your problem domain than on these techniques.

This is example also shows a recommended file and directory layout.
Components, state, and reducers are collocated in the same file.
For larger apps, you could instead create a directory and a single file for each of these.
