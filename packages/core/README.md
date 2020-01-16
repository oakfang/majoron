# @majoron/core

The simple web components library you need for your shared components

## Why?

`@majoron/core` is a simple library which aims to make including web components inside your applications easier. It exposes a react-like interface, and using the created components is easy across all popular frameworks.

## How?

Defining a component is as easy as importing the `define` proxy.

```js
// index.js
import { define } from '@majoron/core';

export default define.HelloWorld(
  //define.[ClassCased name of component]
  function({ name }) {
    // mustn't use arrow function here
    return this`
      <h1> Hello, ${name ? name : 'World'}!</h1>
    `;
  }
);
```
```html
<html>
  <body>
    <script src="./index.js"></script>
    <hello-world name="foo"></hello-world>
  </body>
</html>
```
This library also provides several react-like [hooks](https://reactjs.org/docs/hooks-intro.html): `useState`, `useEffect`, `useMemo` and `useCallback`.
`@majoron/core` uses the amazing [lit-html](https://lit-html.polymer-project.org/) library under the hood. It uses the same template syntax.

## Example

```ts
// lib/x-timer.tsx
import { define, useState, useEffect } from '@majoron/core';

export default define.XTimer(function() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const tid = setInterval(() => {
      setSeconds(seconds => seconds + 1);
    }, 1000);
    return () => clearTimeout(tid);
  });
  return this`
    <p>${seconds}</p>
  `;
});
```
