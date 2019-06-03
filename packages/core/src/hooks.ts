import { cast, Pair } from "./common";

const INITIAL_RUN = Symbol("initial run marker");

type FrameType = "state" | "effect" | "memo";

export interface Frame<Value> {
  type: FrameType;
  get: () => Value;
  set: (value: Value) => void;
}

interface Component {
  hooks: Frame<any>[];
  render: () => void;
}

interface HooksMap {
  useState: ReturnType<typeof useState>;
  useEffect: ReturnType<typeof useEffect>;
  useMemo: ReturnType<typeof useMemo>;
  useCallback: ReturnType<typeof useCallback>;
}

type GetHook = <T>(
  frameType: FrameType,
  value: T
) => { frame: Frame<T>; ref: Component };

function makeFrame<T>(type: FrameType, value: T): Frame<T> {
  let current = value;
  return {
    type,
    get() {
      return current;
    },
    set(value: T) {
      current = value;
    }
  };
}

function areArraysOneLevelEqual(a1: any[], a2: any[]) {
  if (!(Array.isArray(a1) && Array.isArray(a2))) {
    throw new Error("Arguments must be arrays");
  }
  return a1.length === a2.length && a1.every((item, idx) => item === a2[idx]);
}

function shouldReevaluate(
  currentDeps?: any[],
  previousDeps?: any[],
  forceTrue?: boolean
) {
  if (forceTrue) return true;
  if (!currentDeps || !previousDeps) return true;
  if (!currentDeps.length) return false;
  return !areArraysOneLevelEqual(currentDeps, previousDeps);
}

const useState = (getHook: GetHook) =>
  function<T>(
    initialState: T
  ): Pair<T, (value: T | ((value: T) => T)) => void> {
    const { ref, frame } = getHook<T>("state", initialState);
    const set = (value: T | ((value: T) => T)) => {
      const currentState = frame.get();
      const newState =
        typeof value === "function"
          ? (value as ((value: T) => T))(currentState)
          : (value as T);
      frame.set(newState);
      ref.render();
    };
    return [frame.get(), set] as [T, typeof set];
  };

const useMemo = (getHook: GetHook) => <T>(factory: () => T, deps?: any[]) => {
  const { frame } = getHook<{ value: T | typeof INITIAL_RUN; deps?: any[] }>(
    "memo",
    {
      value: INITIAL_RUN,
      deps
    }
  );
  const frameData = frame.get();
  if (shouldReevaluate(deps, frameData.deps, frameData.value === INITIAL_RUN)) {
    frameData.value = factory();
    frameData.deps = deps;
  }
  return frameData.value as T;
};

const useCallback = (_getHook: GetHook, hooks: HooksMap) => (
  callback: Function,
  deps?: any[]
) => hooks.useMemo(() => callback, deps);

const useEffect = (getHook: GetHook) => (
  effector: () => void | Function,
  deps?: any[]
) => {
  const { frame } = getHook<{
    cleanup: void | Function | typeof INITIAL_RUN;
    deps?: any[];
  }>("effect", { cleanup: INITIAL_RUN, deps });
  const frameData = frame.get();
  if (
    shouldReevaluate(deps, frameData.deps, frameData.cleanup === INITIAL_RUN)
  ) {
    if (frameData.cleanup && frameData.cleanup !== INITIAL_RUN) {
      frameData.cleanup();
    }
    frameData.deps = deps;
    frameData.cleanup = effector();
  }
};

export function createHooksMechanism() {
  const hooksStack = cast<Frame<any>[]>([]);
  const ctx = cast<Component[]>([]);
  const current = () => ctx[ctx.length - 1];
  const own = (ref: Component) => {
    ctx.push(ref);
    if (ref.hooks.length) {
      for (let hook of ref.hooks) {
        hooksStack.push(hook);
      }
    }
  };
  const release = () => ctx.pop();
  const getHook = <T>(frameType: FrameType, initialFrameValue: T) => {
    const ref = current();
    if (!ref) {
      throw 0;
    }
    if (!hooksStack.length) {
      const frame = makeFrame(frameType, initialFrameValue);
      hooksStack.push(frame);
      ref.hooks.push(frame);
    }
    const frame = cast<Frame<T>>(hooksStack.shift());
    return { frame, ref };
  };
  const hooks = {
    useState: useState(getHook),
    useEffect: useEffect(getHook),
    useMemo: useMemo(getHook),
    useCallback: (callback: Function, deps?: any[]) =>
      hooks.useMemo(() => callback, deps)
  };
  return { own, release, ...hooks };
}

export type HooksMechanism = ReturnType<typeof createHooksMechanism>;
