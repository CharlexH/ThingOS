import { describe, expect, it } from "vitest";

import { bindInputHandlers, createVolumeWheelAccumulator } from "./input";

describe("createVolumeWheelAccumulator", () => {
  it("batches wheel ticks into a single volume command", () => {
    const accumulator = createVolumeWheelAccumulator(50, 5);

    accumulator.pushTick(1);
    accumulator.pushTick(1);

    expect(accumulator.flush()).toBe(60);
  });

  it("clamps volume into the valid Spotify range", () => {
    const accumulator = createVolumeWheelAccumulator(99, 5);

    accumulator.pushTick(1);
    accumulator.pushTick(1);

    expect(accumulator.flush()).toBe(100);
  });
});

describe("bindInputHandlers", () => {
  it("turns right louder and left quieter with five-step increments", () => {
    const sent: Array<[string, number | undefined]> = [];
    const previewed: number[] = [];
    const listeners = new Map<string, (event: any) => void>();
    const timers = new Map<number, () => void>();
    let nextTimerId = 1;
    let scheduledDelay = -1;

    const fakeWindow = {
      addEventListener(type: string, listener: (event: any) => void) {
        listeners.set(type, listener);
      },
      clearTimeout(id: number) {
        timers.delete(id);
      },
      setTimeout(callback: () => void, delay: number) {
        scheduledDelay = delay;
        const id = nextTimerId++;
        timers.set(id, callback);
        return id;
      }
    } as unknown as Window;

    bindInputHandlers(
      fakeWindow,
      (action, value) => {
        sent.push([action, value]);
      },
      () => {},
      (volume) => {
        previewed.push(volume);
      },
      () => 50,
      () => false,
      () => {}
    );

    const wheel = listeners.get("wheel");
    if (!wheel) {
      throw new Error("wheel handler missing");
    }

    wheel({ deltaY: 1, preventDefault() {} });
    wheel({ deltaY: 1, preventDefault() {} });
    timers.forEach((callback) => callback());

    expect(scheduledDelay).toBe(40);
    expect(previewed).toEqual([55, 60]);
    expect(sent).toEqual([["volume", 60]]);
  });

  it("only keeps the Enter hardware shortcut for playpause", () => {
    const sent: string[] = [];
    const buttons: string[] = [];
    const listeners = new Map<string, (event: any) => void>();

    const fakeWindow = {
      addEventListener(type: string, listener: (event: any) => void) {
        listeners.set(type, listener);
      },
      clearTimeout() {},
      setTimeout() {
        return 1;
      }
    } as unknown as Window;

    bindInputHandlers(
      fakeWindow,
      (action) => {
        sent.push(action);
      },
      (button) => {
        buttons.push(button);
      },
      () => {},
      () => 50,
      () => false,
      () => {}
    );

    const keydown = listeners.get("keydown");
    if (!keydown) {
      throw new Error("keydown handler missing");
    }

    keydown({ key: "Enter", preventDefault() {} });
    keydown({ key: "1", preventDefault() {} });
    keydown({ key: "2", preventDefault() {} });
    keydown({ key: "3", preventDefault() {} });
    keydown({ key: "4", preventDefault() {} });

    expect(sent).toEqual(["playpause"]);
    expect(buttons).toEqual(["preset1", "preset2", "preset3", "preset4"]);
  });

  it("prevents default browser handling for mapped hardware keys", () => {
    const listeners = new Map<string, (event: any) => void>();
    const prevented: string[] = [];

    const fakeWindow = {
      addEventListener(type: string, listener: (event: any) => void) {
        listeners.set(type, listener);
      },
      clearTimeout() {},
      setTimeout() {
        return 1;
      }
    } as unknown as Window;

    bindInputHandlers(
      fakeWindow,
      () => {},
      () => {},
      () => {},
      () => 50,
      () => false,
      () => {}
    );

    const keydown = listeners.get("keydown");
    if (!keydown) {
      throw new Error("keydown handler missing");
    }

    keydown({
      key: "Enter",
      preventDefault() {
        prevented.push("Enter");
      }
    });
    keydown({
      key: "2",
      preventDefault() {
        prevented.push("2");
      }
    });
    keydown({
      key: "4",
      preventDefault() {
        prevented.push("4");
      }
    });
    keydown({
      key: "x",
      preventDefault() {
        prevented.push("x");
      }
    });

    expect(prevented).toEqual(["Enter", "2", "4"]);
  });

  it("uses the wheel to scroll settings instead of adjusting volume", () => {
    const sent: Array<[string, number | undefined]> = [];
    const scrolled: number[] = [];
    const listeners = new Map<string, (event: any) => void>();

    const fakeWindow = {
      addEventListener(type: string, listener: (event: any) => void) {
        listeners.set(type, listener);
      },
      clearTimeout() {},
      setTimeout() {
        return 1;
      }
    } as unknown as Window;

    bindInputHandlers(
      fakeWindow,
      (action, value) => {
        sent.push([action, value]);
      },
      () => {},
      () => {},
      () => 50,
      () => true,
      (delta) => {
        scrolled.push(delta);
      }
    );

    const wheel = listeners.get("wheel");
    if (!wheel) {
      throw new Error("wheel handler missing");
    }

    wheel({ deltaY: 32, preventDefault() {} });

    expect(sent).toEqual([]);
    expect(scrolled).toEqual([32]);
  });
});
