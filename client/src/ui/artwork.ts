export interface ArtworkElements {
  activeUrl: string;
  pendingUrl: string;
  primary: HTMLImageElement;
  requestId: number;
  secondary: HTMLImageElement;
}

export function createArtworkElements(documentRef: Document): ArtworkElements {
  var primary = documentRef.createElement("img");
  var secondary = documentRef.createElement("img");

  primary.className = "artwork-image artwork-image-primary";
  secondary.className = "artwork-image artwork-image-secondary";

  return {
    activeUrl: "",
    pendingUrl: "",
    primary: primary,
    requestId: 0,
    secondary: secondary
  };
}

export function renderArtwork(elements: ArtworkElements, artworkUrl: string): void {
  if (!artworkUrl) {
    clearArtwork(elements);
    return;
  }

  if (elements.activeUrl === artworkUrl || elements.pendingUrl === artworkUrl) {
    return;
  }

  var requestId = elements.requestId + 1;
  elements.requestId = requestId;
  elements.activeUrl = "";
  elements.pendingUrl = artworkUrl;
  resetImage(elements.primary);
  resetImage(elements.secondary);

  var nextImage = elements.secondary;
  nextImage.onload = function () {
    if (elements.requestId !== requestId) {
      return;
    }

    nextImage.onload = null;
    nextImage.onerror = null;
    nextImage.classList.add("artwork-image-visible");
    elements.primary.classList.remove("artwork-image-visible");

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
    clearArtwork(elements);
  };
  nextImage.src = artworkUrl;
}

function clearArtwork(elements: ArtworkElements): void {
  elements.activeUrl = "";
  elements.pendingUrl = "";
  resetImage(elements.primary);
  resetImage(elements.secondary);
}

function resetImage(image: HTMLImageElement): void {
  image.onload = null;
  image.onerror = null;
  image.classList.remove("artwork-image-visible");
  image.removeAttribute("src");
}
