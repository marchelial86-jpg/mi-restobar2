// ============================================
// SERVICE WORKER - INEVA RESTO-BAR
// ============================================

const CACHE_NAME = 'ineva-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

// ============================================
// 1. INSTALACIÓN: Guardar archivos en caché
// ============================================
self.addEventListener('install', (event) => {
  console.log('📦 [SW] Instalando Service Worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('💾 [SW] Guardando archivos en caché');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('✅ [SW] Service Worker instalado');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('❌ [SW] Error en instalación:', error);
      })
  );
});

// ============================================
// 2. ACTIVACIÓN: Limpiar caché viejo
// ============================================
self.addEventListener('activate', (event) => {
  console.log('🚀 [SW] Activando Service Worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => cacheName !== CACHE_NAME)
            .map((cacheName) => {
              console.log('🗑️ [SW] Borrando caché viejo:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('✅ [SW] Service Worker activado');
        return self.clients.claim();
      })
  );
});

// ============================================
// 3. FETCH: Servir desde caché o red
// ============================================
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          console.log('⚡ [SW] Sirviendo desde caché:', event.request.url);
          return response;
        }
        
        console.log('🌐 [SW] Pidiendo a red:', event.request.url);
        return fetch(event.request)
          .then((response) => {
            if (!response || response.status !== 200) {
              return response;
            }
            
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          })
          .catch((error) => {
            console.error('❌ [SW] Error de red:', error);
            return caches.match('/index.html');
          });
      })
  );
});