import define, { defineAs } from "../src";

describe("fuck", () => {
  it("works", () => {
    defineAs(function MyApp({ x }: { x: number }) {
      return this`<p>${x}</p>`;
    });
    define.MyFoo(function() {
      return this`<p>lolz</p>`;
    });
    expect(2).toEqual(2);
  });
});
