const CACHE = 'nosso-espaco-v1';

// Recursos que ficam em cache para funcionar offline
const PRECACHE = [
  '/',
  '/index.html',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Firebase, Spotify, Riot API e fontes externas: sempre rede
  if (
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('spotify.com') ||
    url.hostname.includes('riotgames.com') ||
    url.hostname.includes('simpleicons.org') ||
    url.hostname.includes('ddragon.leagueoflegends.com') ||
    url.hostname.includes('gstatic.com')
  ) {
    return;
  }

  // App shell: cache-first, com fallback para rede
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        if (resp && resp.status === 200 && resp.type === 'basic') {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => caches.match('/index.html'));
    })
  );
});
