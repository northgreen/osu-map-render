// Easing interpolation functions (osu! supports 0-34)

function bounceOut(t: number): number {
  const n1 = 7.5625,
    d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) return n1 * (t - 1.5 / d1) * t + 0.75;
  if (t < 2.5 / d1) return n1 * (t - 2.25 / d1) * t + 0.9375;
  return n1 * (t - 2.625 / d1) * t + 0.984375;
}

export function applyEasing(t: number, easing: number): number {
  switch (easing) {
    case 0:
      return t;
    case 1:
      return t * (2 - t);
    case 2:
      return t * t;
    case 3:
      return t * t;
    case 4:
      return t * (2 - t);
    case 5:
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    case 6:
      return t * t * t;
    case 7:
      return 1 - Math.pow(1 - t, 3);
    case 8:
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    case 9:
      return t * t * t * t;
    case 10:
      return 1 - Math.pow(1 - t, 4);
    case 11:
      return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
    case 12:
      return t * t * t * t * t;
    case 13:
      return 1 - Math.pow(1 - t, 5);
    case 14:
      return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;
    case 15:
      return 1 - Math.cos((t * Math.PI) / 2);
    case 16:
      return Math.sin((t * Math.PI) / 2);
    case 17:
      return -(Math.cos(Math.PI * t) - 1) / 2;
    case 18:
      return t === 0 ? 0 : Math.pow(2, 10 * t - 10);
    case 19:
      return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    case 20:
      if (t === 0) return 0;
      if (t === 1) return 1;
      return t < 0.5
        ? Math.pow(2, 20 * t - 10) / 2
        : (2 - Math.pow(2, -20 * t + 10)) / 2;
    case 21:
      return 1 - Math.sqrt(1 - Math.pow(t, 2));
    case 22:
      return Math.sqrt(1 - Math.pow(t - 1, 2));
    case 23:
      if (t < 0.5) return (1 - Math.sqrt(1 - Math.pow(2 * t, 2))) / 2;
      return (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2;
    case 24:
      if (t === 0 || t === 1) return t;
      return (
        -Math.pow(2, 10 * t - 10) *
        Math.sin((t * 10 - 10.75) * ((2 * Math.PI) / 3))
      );
    case 25:
      if (t === 0 || t === 1) return t;
      return (
        Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) +
        1
      );
    case 26:
      if (t === 0 || t === 1) return t;
      return (
        Math.pow(2, -10 * t) * Math.sin((t * 20 - 0.75) * ((2 * Math.PI) / 3)) +
        1
      );
    case 27:
      if (t === 0 || t === 1) return t;
      return (
        Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 5)) +
        1
      );
    case 28:
      if (t === 0 || t === 1) return t;
      if (t < 0.5) {
        return (
          -(
            Math.pow(2, 20 * t - 10) *
            Math.sin((20 * t - 11.125) * ((2 * Math.PI) / 4.5))
          ) / 2
        );
      }
      return (
        (Math.pow(2, -20 * t + 10) *
          Math.sin((20 * t - 11.125) * ((2 * Math.PI) / 4.5))) /
          2 +
        1
      );
    case 29: {
      const c1 = 1.70158;
      return (c1 + 1) * t * t * t - c1 * t * t;
    }
    case 30: {
      const c4 = 1.70158;
      return 1 + c4 * Math.pow(t - 1, 3) + c4 * Math.pow(t - 1, 2);
    }
    case 31: {
      const c5 = 1.70158;
      const c2 = c5 * 1.525;
      if (t < 0.5) return (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2;
      return (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
    }
    case 32:
      return 1 - bounceOut(1 - t);
    case 33:
      return bounceOut(t);
    case 34:
      if (t < 0.5) return (1 - bounceOut(1 - 2 * t)) / 2;
      return (1 + bounceOut(2 * t - 1)) / 2;
    default:
      return t;
  }
}
