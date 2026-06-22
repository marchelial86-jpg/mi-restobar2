export function registrarServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('[SW] Service Worker registrado correctamente');
          
          // Verificar actualizaciones cada 5 minutos
          setInterval(() => {
            registration.update();
          }, 5 * 60 * 1000);

          // Cuando hay una nueva versión disponible
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            console.log('[SW] Nueva versión detectada, instalando...');

            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[SW] Nueva versión instalada, activando...');
                newWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          });

          // Cuando el Service Worker cambia, recargar automáticamente
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('[SW] Actualización activada, recargando página...');
            window.location.reload();
          });

        })
        .catch((error) => {
          console.error('[SW] Error al registrar:', error);
        });
    });
  }
}