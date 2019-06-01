import kebabCase from "lodash.kebabcase";
import debounce from "lodash.debounce";
import { html, render, TemplateResult } from "lit-html";
import { HooksMechanism, Frame } from "./hooks";

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

function record(fn: (props: object) => any) {
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
    fn(proxy);
  } catch {}
  return Array.from(attrs) as string[];
}

export function createComponentFactory({
  own,
  release
}: Pick<HooksMechanism, "own" | "release">) {
  return function createComponent(
    componentFn: (props: object) => TemplateResult,
    componentName: string = kebabCase(componentFn.name)
  ) {
    if (!componentName.match(/-/)) {
      throw new Error(
        "Component name must contain at least 2 capitalized words"
      );
    }
    const observedAttributes = record(componentFn);
    const cls = class extends HTMLElement {
      private props: ReturnType<typeof createPropsProxy>;
      public hooks: Frame<any>[];
      private renderer: typeof componentFn;

      constructor() {
        super();
        const values = {} as { [attribute: string]: any };
        this.props = createPropsProxy(this);
        this.hooks = [];
        this.attachShadow({ mode: "open" });
        this.renderer = componentFn.bind(
          Object.assign(html, {
            root: this.shadowRoot
          })
        );
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
        render(this.renderer(this.props), this.shadowRoot as ShadowRoot);
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
  };
}
