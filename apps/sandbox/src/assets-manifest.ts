export const ASSET_MANIFEST: Record<
  'python' | 'ruby',
  { version: string; baseUrl: string; files: string[] }
> = {
  python: {
    version: '0.26.0',
    baseUrl: '/assets/python/0.26.0/',
    files: []
  },
  ruby: {
    version: '2.10.1',
    baseUrl: '/assets/ruby/2.10.1/',
    files: []
  }
};
