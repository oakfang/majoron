import { createHooksMechanism } from "./hooks";
import { createComponentFactory } from "./component";

const { own, release, ...hooks } = createHooksMechanism();
export const { defineAs, define } = createComponentFactory({ own, release });
export const { useState, useMemo, useCallback, useEffect } = hooks;

export default define;
