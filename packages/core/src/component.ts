import kebabCase from 'lodash.kebabcase';
import { html, render, TemplateResult } from 'lit-html';
import { HooksMechanism, Frame } from './hooks';
import { cast } from './common';

type FirstParameter<T> = T extends (arg: infer T) => any ? T : never;

function createPropsProxy(element: HTMLElement) {
  return new Proxy(element, {
    set() {
      return false;
    },
    deleteProperty() {
      return false;
    },
    get(target, attribute: string) {
      if (target.hasAttribute(attribute)) {
        return target.getAttribute(attribute);
      }
      return Reflect.get(target, attribute);
    },
    ownKeys(target) {
      return target.getAttributeNames();
    },
  });
}

function record<T extends object>(fn: (props: T) => any) {
  const attrs = new Set();
  const proxy = new Proxy(
    {},
    {
      get(_, key) {
        attrs.add(key);
      },
    }
  );
  try {
    fn(cast<T>(proxy));
  } catch {}
  return Array.from(attrs) as string[];
}

type RendererContext = (typeof html) & { root: ShadowRoot };

export function createComponentFactory({
  own,
  release,
}: Pick<HooksMechanism, 'own' | 'release'>) {
  function defineAs<T extends object>(
    componentFn: (this: RendererContext, props: T) => TemplateResult,
    componentName: string = kebabCase(componentFn.name)
  ) {
    if (!componentName.match(/-/)) {
      throw new Error(
        'Component name must contain at least 2 capitalized words'
      );
    }
    const observedAttributes = record<T>(componentFn);
    const cls = class extends HTMLElement {
      private props: T;
      private pending: boolean;
      public hooks: Frame<any>[];
      private rendererContext: RendererContext;

      constructor() {
        super();
        this.pending = false;
        const values = {} as { [attribute: string]: any };
        this.props = cast<T>(createPropsProxy(this));
        this.hooks = [];
        this.attachShadow({ mode: 'open' });
        this.rendererContext = Object.assign(html, {
          root: this.shadowRoot as ShadowRoot,
        });
        Object.defineProperties(
          this,
          observedAttributes.reduce(
            (props, attribute) => {
              props[attribute] = {
                get: () => {
                  return values[attribute];
                },
                set: value => {
                  if (values[attribute] !== value) {
                    values[attribute] = value;
                    this.render();
                  }
                  return true;
                },
              };
              return props;
            },
            {} as PropertyDescriptorMap
          )
        );
      }

      static get observedAttributes() {
        return observedAttributes;
      }

      _render() {
        own(this);
        render(componentFn.call(this.rendererContext, this.props), this
          .shadowRoot as ShadowRoot);
        release();
      }

      render() {
        if (this.pending) {
          return;
        }
        this.pending = true;
        requestAnimationFrame(() => {
          this._render();
          this.pending = false;
        });
      }

      connectedCallback() {
        this.render();
      }

      attributeChangedCallback() {
        this.render();
      }

      disconnectedCallback() {
        this.hooks
          .filter(({ type }) => type === 'effect')
          .forEach(effect => {
            const { cleanup } = effect.get();
            if (typeof cleanup === 'function') {
              cleanup();
            }
          });
      }
    };
    window.customElements.define(componentName, cls);
    return componentName;
  }
  const define = cast<{ [key: string]: typeof defineAs }>(
    new Proxy(
      {},
      {
        get(_, componentName: string) {
          return (fn: FirstParameter<typeof defineAs>) =>
            defineAs(fn, kebabCase(componentName));
        },
      }
    )
  );
  return { defineAs, define };
}
