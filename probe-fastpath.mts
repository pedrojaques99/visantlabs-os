import { renderPsdMockup } from './server/services/psdRenderService.js';
const TINY = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
try {
  const r = await renderPsdMockup({
    psdFileName: 'Uns - Flag Mockup.psd',
    arts: [{ smartObject: '*', artBase64: TINY }],
    hideLayers: ['[BOXY]'],
    userId: 'probe-local',
    accessTier: 'public',
  } as any);
  console.log('RESULTADO:', JSON.stringify({ engine: (r as any).engine, url: (r as any).url?.slice(0, 80) }));
} catch (e: any) {
  console.log('ERRO:', e.message);
}
