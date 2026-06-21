// ============================================
// REGISTRO DEL SERVICE WORKER
// ============================================

export function registrarServiceWorker() {
  // Verificar si el navegador soporta Service Workers
  if (!('serviceWorker' in navigator)) {
    console.log('❌ Tu navegador no soporta PWA');
    return;
  }

  // Esperar a que la página cargue completamente
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registro) => {
        console.log('✅ [PWA] Service Worker registrado con éxito');
        console.log('📍 Scope:', registro.scope);
        
        // Verificar actualizaciones periódicamente
        setInterval(() => {
          registro.update();
        }, 60 * 60 * 1000); // Cada 1 hora
      })
      .catch((error) => {
        console.error('❌ [PWA] Error al registrar:', error);
      });
  });
}

// ============================================
// DETECTAR SI SE PUEDE INSTALAR
// ============================================
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  console.log('📱 [PWA] App lista para instalar');
});

export function instalarApp() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('✅ Usuario instaló la app');
      } else {
        console.log('❌ Usuario canceló la instalación');
      }
      deferredPrompt = null;
    });
  }
}