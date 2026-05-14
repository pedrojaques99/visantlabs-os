declare module 'imagetracerjs' {
  interface ImageTracerOptions {
    ltres?: number;
    qtres?: number;
    pathomit?: number;
    colorsampling?: number;
    numberofcolors?: number;
    mincolorratio?: number;
    colorquantcycles?: number;
    blurradius?: number;
    blurdelta?: number;
    strokewidth?: number;
    linefilter?: boolean;
    roundcoords?: number;
  }

  interface ImageTracer {
    imagedataToSVG(imageData: ImageData, options?: ImageTracerOptions): string;
  }

  const ImageTracer: ImageTracer;
  export default ImageTracer;
}
