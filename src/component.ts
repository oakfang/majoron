import kebabCase from "lodash.kebabcase";
import debounce from "lodash.debounce";
import { html, render, TemplateResult } from "lit-html";
import { HooksMechanism, Frame } from "./hooks";
import { cast } from "./common";

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
    }
  });
}

function record<T extends object>(fn: (props: T) => any) {
  const attrs = new Set();
  const proxy = new Proxy(
    {},
    {
      get(_, key) {
        attrs.add(key);
      }
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
  release
}: Pick<HooksMechanism, "own" | "release">) {
  function createComponent<T extends object>(
    componentFn: (this: RendererContext, props: T) => TemplateResult,
    componentName: string = kebabCase(componentFn.name)
  ) {
    if (!componentName.match(/-/)) {
      throw new Error(
        "Component name must contain at least 2 capitalized words"
      );
    }
    const observedAttributes = record<T>(componentFn);
    const cls = class extends HTMLElement {
      private props: T;
      public hooks: Frame<any>[];
      private rendererContext: RendererContext;

      constructor() {
        super();
        const values = {} as { [attribute: string]: any };
        this.props = cast<T>(createPropsProxy(this));
        this.hooks = [];
        this.attachShadow({ mode: "open" });
        this.rendererContext = Object.assign(html, {
          root: this.shadowRoot as ShadowRoot
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
                  values[attribute] = value;
                  this.render();
                  return true;
                }
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

      render = debounce(() => {
        own(this);
        render(componentFn.call(this.rendererContext, this.props), this
          .shadowRoot as ShadowRoot);
        release();
      }, 16);

      connectedCallback() {
        this.render();
      }

      attributeChangedCallback() {
        this.render();
      }

      disconnectedCallback() {
        this.hooks
          .filter(({ type }) => type === "effect")
          .forEach(effect => {
            const { cleanup } = effect.get();
            if (typeof cleanup === "function") {
              cleanup();
            }
          });
      }
    };
    window.customElements.define(componentName, cls);
  }
  return cast<
    typeof createComponent & { [key: string]: typeof createComponent }
  >(
    new Proxy(createComponent, {
      get(component, componentName: string) {
        return (fn: FirstParameter<typeof createComponent>) =>
          component(fn, kebabCase(componentName));
      }
    })
  );
}
