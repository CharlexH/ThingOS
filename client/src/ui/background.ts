var DEFAULT_ALPHA_VALUES = [0.78, 0.62, 0.56, 0.48];

export var DEFAULT_BACKGROUND_COLORS = [
  "rgba(58, 87, 128, 0.78)",
  "rgba(112, 68, 132, 0.62)",
  "rgba(164, 102, 78, 0.56)",
  "rgba(44, 58, 82, 0.48)"
];

var paletteCache = new Map<string, string[]>();

export interface BackgroundElements {
  activeUrl: string;
  gradient: HTMLDivElement;
  overlay: HTMLDivElement;
  pendingUrl: string;
  primary: HTMLImageElement;
  requestId: number;
  root: HTMLElement;
  secondary: HTMLImageElement;
}

export function createBackgroundElements(documentRef: Document): BackgroundElements {
  var root = documentRef.createElement("div");
  var primary = documentRef.createElement("img");
  var secondary = documentRef.createElement("img");
  var gradient = documentRef.createElement("div");
  var overlay = documentRef.createElement("div");

  root.className = "spotify-background";
  primary.className = "spotify-background-image spotify-background-image-primary";
  secondary.className = "spotify-background-image spotify-background-image-secondary";
  gradient.className = "spotify-background-gradient";
  overlay.className = "spotify-background-overlay";
  gradient.style.background = buildBackgroundGradient(DEFAULT_BACKGROUND_COLORS);
  primary.crossOrigin = "anonymous";
  secondary.crossOrigin = "anonymous";

  root.appendChild(primary);
  root.appendChild(secondary);
  root.appendChild(gradient);
  root.appendChild(overlay);

  return {
    activeUrl: "",
    gradient: gradient,
    overlay: overlay,
    pendingUrl: "",
    primary: primary,
    requestId: 0,
    root: root,
    secondary: secondary
  };
}

export function renderBackground(
  documentRef: Document,
  elements: BackgroundElements,
  artworkUrl: string
): void {
  if (!artworkUrl) {
    clearBackgroundImages(elements);
    elements.gradient.style.background = buildBackgroundGradient(DEFAULT_BACKGROUND_COLORS);
    return;
  }

  if (elements.activeUrl !== artworkUrl && elements.pendingUrl !== artworkUrl) {
    var requestId = elements.requestId + 1;
    var nextImage = elements.secondary;

    elements.requestId = requestId;
    elements.activeUrl = "";
    elements.pendingUrl = artworkUrl;
    clearBackgroundImages(elements);
    elements.gradient.style.background = buildBackgroundGradient(DEFAULT_BACKGROUND_COLORS);

    nextImage.onload = function () {
      if (elements.requestId !== requestId) {
        return;
      }

      nextImage.onload = null;
      nextImage.onerror = null;
      nextImage.classList.add("spotify-background-image-visible");
      elements.primary.classList.remove("spotify-background-image-visible");
      elements.primary.classList.remove("spotify-background-image-primary");
      nextImage.classList.add("spotify-background-image-primary");

      var oldPrimary = elements.primary;
      elements.primary = nextImage;
      elements.secondary = oldPrimary;
      elements.activeUrl = artworkUrl;
      elements.pendingUrl = "";
    };
    nextImage.onerror = function () {
      if (elements.requestId !== requestId) {
        return;
      }

      nextImage.onload = null;
      nextImage.onerror = null;
      clearBackgroundImages(elements);
      elements.gradient.style.background = buildBackgroundGradient(DEFAULT_BACKGROUND_COLORS);
    };
    nextImage.src = artworkUrl;
  }

  resolveBackgroundPalette(documentRef, artworkUrl).then(function (palette) {
    if (elements.activeUrl !== artworkUrl && elements.pendingUrl !== artworkUrl) {
      return;
    }
    elements.gradient.style.background = buildBackgroundGradient(palette);
  });
}

export function buildBackgroundGradient(colors: string[]): string {
  var palette = colors.slice(0, 4);

  while (palette.length < 4) {
    palette.push(DEFAULT_BACKGROUND_COLORS[palette.length]);
  }

  return [
    "radial-gradient(circle at 18% 22%, " + palette[0] + " 0%, transparent 52%)",
    "radial-gradient(circle at 82% 18%, " + palette[1] + " 0%, transparent 48%)",
    "radial-gradient(circle at 50% 82%, " + palette[2] + " 0%, transparent 54%)",
    "radial-gradient(circle at 76% 72%, " + palette[3] + " 0%, transparent 46%)"
  ].join(", ");
}

export function extractGradientPalette(pixels: Uint8ClampedArray): string[] {
  if (!pixels.length) {
    return DEFAULT_BACKGROUND_COLORS.slice();
  }

  var buckets = new Map<
    string,
    { blue: number; count: number; green: number; red: number; saturation: number }
  >();

  for (var index = 0; index < pixels.length; index += 4) {
    var red = pixels[index];
    var green = pixels[index + 1];
    var blue = pixels[index + 2];
    var alpha = pixels[index + 3];
    var brightness = (red + green + blue) / 3;
    var saturation = Math.max(red, green, blue) - Math.min(red, green, blue);

    if (alpha < 200 || brightness < 22) {
      continue;
    }

    var key = [
      Math.round(red / 48),
      Math.round(green / 48),
      Math.round(blue / 48)
    ].join("-");
    var bucket = buckets.get(key);
    if (!bucket) {
      bucket = { blue: 0, count: 0, green: 0, red: 0, saturation: 0 };
      buckets.set(key, bucket);
    }

    bucket.count += 1;
    bucket.red += red;
    bucket.green += green;
    bucket.blue += blue;
    bucket.saturation += saturation;
  }

  var ranked = Array.from(buckets.values()).sort(function (left, right) {
    var leftScore = left.count * 1000 + left.saturation;
    var rightScore = right.count * 1000 + right.saturation;
    return rightScore - leftScore;
  });

  if (!ranked.length) {
    return DEFAULT_BACKGROUND_COLORS.slice();
  }

  var colors = ranked.slice(0, 4).map(function (bucket, index) {
    return normalizePaletteColor(
      bucket.red / bucket.count,
      bucket.green / bucket.count,
      bucket.blue / bucket.count,
      DEFAULT_ALPHA_VALUES[index]
    );
  });

  while (colors.length < 4) {
    colors.push(DEFAULT_BACKGROUND_COLORS[colors.length]);
  }

  return colors;
}

function extractPaletteFromArtwork(documentRef: Document, image: HTMLImageElement): string[] {
  var canvas = documentRef.createElement("canvas");
  var context = canvas.getContext("2d");

  if (!context) {
    return DEFAULT_BACKGROUND_COLORS.slice();
  }

  canvas.width = 24;
  canvas.height = 24;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  return extractGradientPalette(context.getImageData(0, 0, canvas.width, canvas.height).data);
}

function normalizePaletteColor(red: number, green: number, blue: number, alpha: number): string {
  var hsl = rgbToHsl(red, green, blue);
  var normalizedSaturation = Math.min(0.86, Math.max(0.42, hsl.s));
  var normalizedLightness = Math.min(0.62, Math.max(0.28, hsl.l));
  var rgb = hslToRgb(hsl.h, normalizedSaturation, normalizedLightness);

  return "rgba(" + rgb.r + ", " + rgb.g + ", " + rgb.b + ", " + alpha + ")";
}

function resolveBackgroundPalette(documentRef: Document, artworkUrl: string): Promise<string[]> {
  var cached = paletteCache.get(artworkUrl);
  if (cached) {
    return Promise.resolve(cached);
  }

  return new Promise(function (resolve) {
    var image = documentRef.createElement("img");
    image.crossOrigin = "anonymous";

    image.addEventListener("load", function () {
      try {
        var palette = extractPaletteFromArtwork(documentRef, image);
        paletteCache.set(artworkUrl, palette);
        resolve(palette);
      } catch (_error) {
        resolve(DEFAULT_BACKGROUND_COLORS.slice());
      }
    });
    image.addEventListener("error", function () {
      resolve(DEFAULT_BACKGROUND_COLORS.slice());
    });
    image.src = artworkUrl;
  });
}

function clearBackgroundImages(elements: BackgroundElements): void {
  elements.activeUrl = "";
  elements.pendingUrl = "";
  resetBackgroundImage(elements.primary);
  resetBackgroundImage(elements.secondary);
}

function resetBackgroundImage(image: HTMLImageElement): void {
  image.onload = null;
  image.onerror = null;
  image.classList.remove("spotify-background-image-primary");
  image.classList.remove("spotify-background-image-visible");
  image.removeAttribute("src");
}

function hslToRgb(
  hue: number,
  saturation: number,
  lightness: number
): { b: number; g: number; r: number } {
  if (!saturation) {
    var value = Math.round(lightness * 255);
    return { b: value, g: value, r: value };
  }

  var chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  var scaledHue = hue * 6;
  var secondary = chroma * (1 - Math.abs((scaledHue % 2) - 1));
  var red = 0;
  var green = 0;
  var blue = 0;

  if (scaledHue < 1) {
    red = chroma;
    green = secondary;
  } else if (scaledHue < 2) {
    red = secondary;
    green = chroma;
  } else if (scaledHue < 3) {
    green = chroma;
    blue = secondary;
  } else if (scaledHue < 4) {
    green = secondary;
    blue = chroma;
  } else if (scaledHue < 5) {
    red = secondary;
    blue = chroma;
  } else {
    red = chroma;
    blue = secondary;
  }

  var lightnessOffset = lightness - chroma / 2;
  return {
    b: Math.round((blue + lightnessOffset) * 255),
    g: Math.round((green + lightnessOffset) * 255),
    r: Math.round((red + lightnessOffset) * 255)
  };
}

function rgbToHsl(red: number, green: number, blue: number): { h: number; l: number; s: number } {
  var normalizedRed = red / 255;
  var normalizedGreen = green / 255;
  var normalizedBlue = blue / 255;
  var max = Math.max(normalizedRed, normalizedGreen, normalizedBlue);
  var min = Math.min(normalizedRed, normalizedGreen, normalizedBlue);
  var chroma = max - min;
  var lightness = (max + min) / 2;
  var hue = 0;
  var saturation = 0;

  if (chroma) {
    saturation = chroma / (1 - Math.abs(2 * lightness - 1));

    if (max === normalizedRed) {
      hue = ((normalizedGreen - normalizedBlue) / chroma) % 6;
    } else if (max === normalizedGreen) {
      hue = (normalizedBlue - normalizedRed) / chroma + 2;
    } else {
      hue = (normalizedRed - normalizedGreen) / chroma + 4;
    }
  }

  return {
    h: ((hue < 0 ? hue + 6 : hue) / 6),
    l: lightness,
    s: saturation
  };
}
