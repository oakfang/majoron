import React, { FunctionComponent, useEffect, useRef } from 'react';

export function fromProps<Props>(tagName: string): FunctionComponent<Props> {
  const Component: FunctionComponent<Props> = props => {
    const ref = useRef<any>();
    useEffect(() => {
      const { current } = ref;
      for (let prop in props as Props) {
        current[prop] = props[prop];
      }
    });
    return React.createElement(tagName, { ref });
  };
  Component.displayName = tagName
    .split('-')
    .map(word => word[0].toUpperCase() + word.substr(1))
    .join('');
  return Component;
}
