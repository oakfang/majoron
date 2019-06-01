import define from "../src";

describe("fuck", () => {
  it("works", () => {
    define(function MyApp({ x }: { x: number }) {
      return this`<p>${x}</p>`;
    });
    expect(2).toEqual(2);
  });
});
