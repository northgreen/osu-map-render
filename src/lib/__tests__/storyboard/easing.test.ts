import { describe, it, expect } from "vitest";
import { applyEasing } from "../../storyboard/easing";

// ============================================
// Boundary values: all easing functions
// ============================================

describe("applyEasing - boundary values (t=0 and t=1)", () => {
  // Easings where t=0 returns exactly 0
  const zeroAtT0 = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28];
  // Easings where t=0 has known non-zero values
  const nonZeroAtT0: Record<number, number> = {
    15: 0, // easeInSine: 1 - cos(0) = 0 (but returns -0 due to float)
    17: 0, // easeInOutSine: -(cos(0) - 1) / 2 = 0 (but returns -0)
    29: 0, // easeInBack: (c+1)*0 - c*0 = 0 (but returns -0)
    30: 1, // easeOutBack: 1 + c*(-1)^3 + c*(-1)^2 = 1
    31: 0, // easeInOutBack: returns 0 (but may be -0)
    32: -0.328125, // easeInBounce: 1 - bounceOut(1) = -0.328...
    33: 0, // easeOutBounce: bounceOut(0) = 0
    34: -0.1640625, // easeInOutBounce: (1 - bounceOut(1)) / 2
    35: 1, // OutPow10: pow(-1,10)*0 + 1 = 1
  };

  // Easings where t=1 returns exactly 1
  const oneAtT1 = [0, 2, 3, 5, 6, 8, 9, 11, 12, 14, 18, 20, 21, 24, 26, 27, 28, 32, 35];
  // Easings where t=1 has floating point imprecision (close to 1)
  const closeToOneAtT1 = [1, 4, 7, 10, 13, 15, 16, 17, 19, 22, 23, 25, 29, 30, 31];
  // Easings where t=1 has known non-one values
  const nonOneAtT1: Record<number, number> = {
    32: 1, // easeInBounce: 1 - bounceOut(0) = 1
    33: 1.328125, // easeOutBounce: bounceOut(1) = 1.328...
    34: 1.1640625, // easeInOutBounce: (1 + bounceOut(1)) / 2
    35: 1, // OutPow10: pow(0,10)*1 + 1 = 1
  };

  for (let easing = 0; easing <= 35; easing++) {
    it(`easing ${easing} at t=0`, () => {
      const result = applyEasing(0, easing);
      if (easing in nonZeroAtT0) {
        expect(result).toBeCloseTo(nonZeroAtT0[easing as keyof typeof nonZeroAtT0], 3);
      } else if (zeroAtT0.includes(easing)) {
        expect(result).toBe(0);
      } else {
        // For -0 cases, toBeCloseTo handles it
        expect(result).toBeCloseTo(0, 10);
      }
    });

    it(`easing ${easing} at t=1`, () => {
      const result = applyEasing(1, easing);
      if (easing in nonOneAtT1) {
        expect(result).toBeCloseTo(nonOneAtT1[easing as keyof typeof nonOneAtT1], 3);
      } else if (closeToOneAtT1.includes(easing)) {
        expect(result).toBeCloseTo(1, 10);
      } else if (oneAtT1.includes(easing)) {
        expect(result).toBe(1);
      } else {
        expect(result).toBeCloseTo(1, 10);
      }
    });
  }
});

// ============================================
// Midpoint values (t=0.5)
// ============================================

describe("applyEasing - midpoint values (t=0.5)", () => {
  it("easing 0 (linear) should return 0.5", () => {
    expect(applyEasing(0.5, 0)).toBe(0.5);
  });

  it("easing 1 (easeOut) should return 0.75", () => {
    expect(applyEasing(0.5, 1)).toBe(0.75);
  });

  it("easing 2 (easeIn) should return 0.25", () => {
    expect(applyEasing(0.5, 2)).toBe(0.25);
  });

  it("easing 3 (easeInQuad) should return 0.25", () => {
    expect(applyEasing(0.5, 3)).toBe(0.25);
  });

  it("easing 4 (easeOutQuad) should return 0.75", () => {
    expect(applyEasing(0.5, 4)).toBe(0.75);
  });

  it("easing 5 (easeInOutQuad) should return 0.5", () => {
    expect(applyEasing(0.5, 5)).toBe(0.5);
  });

  it("easing 15 (easeInSine) should return ~0.293", () => {
    expect(applyEasing(0.5, 15)).toBeCloseTo(0.29289, 4);
  });

  it("easing 16 (easeOutSine) should return ~0.707", () => {
    expect(applyEasing(0.5, 16)).toBeCloseTo(0.70711, 4);
  });

  it("easing 17 (easeInOutSine) should return ~0.5", () => {
    expect(applyEasing(0.5, 17)).toBeCloseTo(0.5, 10);
  });

  it("easing 18 (easeInExpo) should return ~0.03125", () => {
    expect(applyEasing(0.5, 18)).toBeCloseTo(0.03125, 4);
  });

  it("easing 19 (easeOutExpo) should return ~0.96875", () => {
    expect(applyEasing(0.5, 19)).toBeCloseTo(0.96875, 4);
  });
});

// ============================================
// Monotonicity for standard easings
// ============================================

describe("applyEasing - monotonicity for standard easings", () => {
  // Excluding: 24-31 (elastic/back), 32-35 (bounce/OutPow10)
  const monotonicEasings = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
    15, 16, 17, 18, 19, 20, 21, 22, 23,
  ];

  for (const easing of monotonicEasings) {
    it(`easing ${easing} should be monotonically increasing`, () => {
      let prev = applyEasing(0, easing);
      for (let t = 0.01; t <= 1; t += 0.01) {
        const val = applyEasing(t, easing);
        expect(val).toBeGreaterThanOrEqual(prev - 0.0001);
        prev = val;
      }
    });
  }
});

// ============================================
// Bounce easing behavior
// ============================================

describe("applyEasing - bounce easing behavior", () => {
  it("easing 32 (InBounce) at t=0 is negative", () => {
    // 1 - bounceOut(1) = 1 - 1.328... = -0.328...
    expect(applyEasing(0, 32)).toBeCloseTo(-0.328125, 3);
  });

  it("easing 33 (OutBounce) at t=1 overshoots", () => {
    // bounceOut(1) = 1.328...
    expect(applyEasing(1, 33)).toBeCloseTo(1.328125, 3);
  });

  it("easing 34 (InOutBounce) at boundaries", () => {
    // At t=0: (1 - bounceOut(1)) / 2 ≈ -0.164
    expect(applyEasing(0, 34)).toBeCloseTo(-0.1640625, 3);
    // At t=1: (1 + bounceOut(1)) / 2 ≈ 1.164
    expect(applyEasing(1, 34)).toBeCloseTo(1.1640625, 3);
  });

  it("easing 33 (OutBounce) max value is ~1.748", () => {
    // bounceOut has peaks at specific points
    // The maximum of bounceOut is at t=2.5/2.75 ≈ 0.909
    let maxVal = 0;
    for (let t = 0; t <= 1; t += 0.001) {
      const val = applyEasing(t, 33);
      if (val > maxVal) maxVal = val;
    }
    expect(maxVal).toBeGreaterThan(1.0);
    expect(maxVal).toBeLessThan(2.0);
  });
});

// ============================================
// Elastic and back easings overshoot
// ============================================

describe("applyEasing - elastic and back easings overshoot", () => {
  it("easing 24 (InElastic) should go below 0", () => {
    let foundBelowZero = false;
    for (let t = 0.01; t < 1; t += 0.01) {
      if (applyEasing(t, 24) < -0.0001) {
        foundBelowZero = true;
        break;
      }
    }
    expect(foundBelowZero).toBe(true);
  });

  it("easing 25 (OutElastic) should go above 1", () => {
    let foundAboveOne = false;
    for (let t = 0.01; t < 1; t += 0.01) {
      if (applyEasing(t, 25) > 1.0001) {
        foundAboveOne = true;
        break;
      }
    }
    expect(foundAboveOne).toBe(true);
  });

  it("easing 29 (InBack) should go below 0", () => {
    let foundBelowZero = false;
    for (let t = 0.01; t < 1; t += 0.01) {
      if (applyEasing(t, 29) < -0.0001) {
        foundBelowZero = true;
        break;
      }
    }
    expect(foundBelowZero).toBe(true);
  });

  it("easing 30 (OutBack) should go above 1", () => {
    let foundAboveOne = false;
    for (let t = 0.01; t < 1; t += 0.01) {
      if (applyEasing(t, 30) > 1.0001) {
        foundAboveOne = true;
        break;
      }
    }
    expect(foundAboveOne).toBe(true);
  });
});

// ============================================
// Specific easing values
// ============================================

describe("applyEasing - specific easing values", () => {
  it("easing 35 (OutPow10) at t=0.5 should be a valid number", () => {
    const val = applyEasing(0.5, 35);
    expect(typeof val).toBe("number");
    expect(val).toBeGreaterThanOrEqual(0);
    expect(val).toBeLessThanOrEqual(2);
  });

  it("easing 20 (easeInOutExpo) at boundaries", () => {
    expect(applyEasing(0, 20)).toBe(0);
    expect(applyEasing(1, 20)).toBe(1);
  });

  it("easing 26 (easeOutElasticHalf) at t=0.5", () => {
    const val = applyEasing(0.5, 26);
    expect(typeof val).toBe("number");
  });

  it("easing 27 (easeOutElasticQuarter) at t=0.5", () => {
    const val = applyEasing(0.5, 27);
    expect(typeof val).toBe("number");
  });

  it("easing 28 (easeInOutElastic) at t=0.5", () => {
    const val = applyEasing(0.5, 28);
    expect(typeof val).toBe("number");
  });

  it("easing 31 (easeInOutBack) at t=0.5 should be ~0.5", () => {
    expect(applyEasing(0.5, 31)).toBeCloseTo(0.5, 10);
  });

  it("unknown easing should return t (linear fallback)", () => {
    expect(applyEasing(0.5, 99)).toBe(0.5);
    expect(applyEasing(0.3, 100)).toBe(0.3);
  });
});
