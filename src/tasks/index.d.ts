export type Task<Success, Failure> = {
  type: string,

  map: <NextSuccess>(onSuccess: (res: Success) => NextSuccess) => Task<NextSuccess, Failure>,

  bimap: <NextSuccess, NextFailure>(onSuccess: (res: Success) => NextSuccess, onError: (err: Failure) => NextFailure) =>
      Task<NextSuccess, NextFailure>,

  chain: <NextSuccess, NextFailure>(next: (res: Success) => Task<NextSuccess, NextFailure>) =>
      Task<NextSuccess, NextFailure>
};


export declare function fromCallback(fn: (arg: void, cb: () => void) => void, type: string): () => Task<void, void>;
export declare function fromCallback<Arg>(fn: (arg: Arg, cb: () => void) => void, type: string): (arg: Arg) => Task<void, void>;
export declare function fromCallback<Success, Failure>(fn: (arg: void, cb: (err: Failure | null, res: Success | null) => void) => void, type: string): () => Task<Success, Failure>;
export declare function fromCallback<Arg, Success, Failure>(fn: (arg: Arg, cb: (err: Failure | null, res: Success | null) => void) => void, type: string): (arg: Arg) => Task<Success, Failure>;

export declare function fromPromise<Arg, Success>(fn: (arg: Arg) => Promise<Success>, type: string): (arg: Arg) => Task<Success, unknown>;

export declare function withTask<State>(state: State, task: Task<any, any> | Task<any, any>[]): State;
export declare function withTasks<State>(state: State, tasks: Task<any, any>[]): State;

export declare function disableStackCapturing(): void;

export declare function all<Success, Failure>(tasks: Task<Success, Failure>[]): Task<Success[], Failure>;
