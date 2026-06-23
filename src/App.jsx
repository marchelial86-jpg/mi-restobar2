import { useState, useEffect, useRef } from 'react'
import { collection, addDoc, query, where, getDocs, doc, updateDoc, setDoc, deleteDoc, onSnapshot, orderBy, getDoc } from 'firebase/firestore'
import { db } from './firebase'
import './App.css'
import { registrarServiceWorker } from './registerSW'

// ============================================
// 🖼️ COMPONENTE GALERÍA DE FOTOS
// ============================================
function GaleriaProducto({ imagenes = [], nombreProducto }) {
  const [fotoActiva, setFotoActiva] = useState(0);
  const [lightboxAbierto, setLightboxAbierto] = useState(false);

  if (!imagenes || imagenes.length === 0) {
    return (
      <div className="galeria-placeholder">
        <span className="galeria-placeholder-icono">🍽️</span>
        <span className="galeria-placeholder-texto">Sin foto</span>
      </div>
    );
  }

  const abrirLightbox = (index) => {
    setFotoActiva(index);
    setLightboxAbierto(true);
  };

  const cerrarLightbox = () => setLightboxAbierto(false);

  const fotoAnterior = (e) => {
    e.stopPropagation();
    setFotoActiva((prev) => (prev === 0 ? imagenes.length - 1 : prev - 1));
  };

  const fotoSiguiente = (e) => {
    e.stopPropagation();
    setFotoActiva((prev) => (prev === imagenes.length - 1 ? 0 : prev + 1));
  };

  return (
    <>
      <div className="galeria-producto">
        <div 
          className="galeria-foto-principal" 
          onClick={() => abrirLightbox(fotoActiva)}
          role="button"
          aria-label={`Ver foto ${fotoActiva + 1} de ${imagenes.length}`}
        >
          <img 
            src={imagenes[fotoActiva]} 
            alt={`${nombreProducto} - foto ${fotoActiva + 1}`}
            className="galeria-img-principal"
            onError={(e) => { e.target.src = 'https://via.placeholder.com/300x200?text=Sin+foto'; }}
          />
          {imagenes.length > 1 && (
            <>
              <button className="galeria-nav galeria-nav-izq" onClick={(e) => { e.stopPropagation(); fotoAnterior(e); }} aria-label="Foto anterior">‹</button>
              <button className="galeria-nav galeria-nav-der" onClick={(e) => { e.stopPropagation(); fotoSiguiente(e); }} aria-label="Foto siguiente">›</button>
              <div className="galeria-contador">{fotoActiva + 1} / {imagenes.length}</div>
            </>
          )}
        </div>

        {imagenes.length > 1 && (
          <div className="galeria-miniaturas">
            {imagenes.map((img, index) => (
              <button
                key={index}
                className={`galeria-miniatura ${index === fotoActiva ? 'activa' : ''}`}
                onClick={() => setFotoActiva(index)}
                aria-label={`Ver foto ${index + 1}`}
              >
                <img 
                  src={img} 
                  alt={`Miniatura ${index + 1}`}
                  onError={(e) => { e.target.src = 'https://via.placeholder.com/60x60?text=?'; }}
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {lightboxAbierto && (
        <div className="lightbox-overlay" onClick={cerrarLightbox} role="dialog" aria-modal="true">
          <button className="lightbox-cerrar" onClick={cerrarLightbox} aria-label="Cerrar">✕</button>
          
          {imagenes.length > 1 && (
            <>
              <button className="lightbox-nav lightbox-nav-izq" onClick={fotoAnterior} aria-label="Anterior">‹</button>
              <button className="lightbox-nav lightbox-nav-der" onClick={fotoSiguiente} aria-label="Siguiente">›</button>
              <div className="lightbox-contador">{fotoActiva + 1} / {imagenes.length}</div>
            </>
          )}
          
          <img 
            src={imagenes[fotoActiva]} 
            alt={`${nombreProducto} - vista ampliada`}
            className="lightbox-img"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

// Componente Acordeón Universal (CON GALERÍA DE FOTOS)
function AcordeonCategoria({ categoriaKey, titulo, emoji, getProductosPorCategoria, formatearPrecio, agregarPedido, compartirProducto }) {
  const [abierto, setAbierto] = useState(false);
  const productos = getProductosPorCategoria(categoriaKey);

  if (!productos || productos.length === 0) return null;

  return (
    <div className={`acordeon-item ${abierto ? 'abierto' : ''}`}>
      <button 
        className="acordeon-header" 
        onClick={() => setAbierto(!abierto)}
        aria-expanded={abierto}
      >
        <span className="acordeon-titulo">{emoji} {titulo}</span>
        <span className="acordeon-icono">{abierto ? '▲' : '▼'}</span>
      </button>
      
      <div className={`acordeon-content ${abierto ? 'visible' : ''}`}>
        <div className="products-grid">
          {productos.map((producto) => {
            let imagenes = [];
            if (producto.imagenes) {
              if (Array.isArray(producto.imagenes)) {
                imagenes = producto.imagenes;
              } else if (typeof producto.imagenes === 'string') {
                imagenes = producto.imagenes
                  .split(',')
                  .map(url => url.trim())
                  .filter(url => url.length > 0);
              }
            } else if (producto.imagen) {
              imagenes = [producto.imagen];
            }

            return (
              <div key={producto.id} className={`product-card ${producto.disponible === false ? 'producto-agotado' : ''}`}>
                <GaleriaProducto 
                  imagenes={imagenes} 
                  nombreProducto={producto.nombre} 
                />
                
                <div className="product-info">
                  <h3>{producto.nombre}</h3>
                  {producto.ingredientes && <p className="product-ingredientes">{producto.ingredientes}</p>}
                  <div className="product-price">{formatearPrecio(producto.precio)}</div>
                </div>
                <div className="product-actions">
                  {producto.disponible === false ? (
  <span className="badge-agotado">🔴 Agotado</span>
) : (
  <button className="btn-primary" onClick={() => agregarPedido(producto)}>+ Agregar</button>
)}
                  <button className="btn-compartir" onClick={() => compartirProducto(producto)}>📤</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function App() {
  registrarServiceWorker()

  const [pedidos, setPedidos] = useState([])
  const [notasPorProducto, setNotasPorProducto] = useState({})
  const [tipoEntrega, setTipoEntrega] = useState('')
  const [direccion, setDireccion] = useState('')
  const [nombreCompleto, setNombreCompleto] = useState('')
  const [telefono, setTelefono] = useState('')
  const [suscribirMenu, setSuscribirMenu] = useState(false)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  
  const [estaAbierto, setEstaAbierto] = useState(false)
  const [mensajeHorario, setMensajeHorario] = useState('')
  const [tiempoRestante, setTiempoRestante] = useState('')
  const [turnoActual, setTurnoActual] = useState('dia')
  
  const [esAdmin, setEsAdmin] = useState(false)
  const [mostrarLogin, setMostrarLogin] = useState(false)
  const [passwordAdmin, setPasswordAdmin] = useState('')
  const [mostrarPanelAdmin, setMostrarPanelAdmin] = useState(false)
  const [productosFirebase, setProductosFirebase] = useState([])
  
  const [mostrarCambiarPassword, setMostrarCambiarPassword] = useState(false)
  const [nuevaPassword, setNuevaPassword] = useState('')
  const [confirmarPassword, setConfirmarPassword] = useState('')
  const [passwordActual, setPasswordActual] = useState('')
  
  const [pedidosNuevos, setPedidosNuevos] = useState([])
  const [mostrarNotificacion, setMostrarNotificacion] = useState(null)
  const [sonidoActivado, setSonidoActivado] = useState(true)
  
  const [mostrarCarritoFlotante, setMostrarCarritoFlotante] = useState(false)
  
  const [terminoBusqueda, setTerminoBusqueda] = useState('')
  const [resultadosBusqueda, setResultadosBusqueda] = useState([])
  const [mostrarResultados, setMostrarResultados] = useState(false)
  const [seccionDestacada, setSeccionDestacada] = useState(null)
  const [categoriaActiva, setCategoriaActiva] = useState(null)
  const buscadorRef = useRef(null)
  
  const [mostrarGuia, setMostrarGuia] = useState(false)
  const [pasoActual, setPasoActual] = useState(0)
  
  const [mostrarRedes, setMostrarRedes] = useState(false)
  
  const [mostrarTerminos, setMostrarTerminos] = useState(false)
  const [aceptoTerminos, setAceptoTerminos] = useState(false)
  const [mostrarZonaDelivery, setMostrarZonaDelivery] = useState(false)
  const [direccionValida, setDireccionValida] = useState(null)

  const [mostrarCalificacion, setMostrarCalificacion] = useState(false)
  const [calificacion, setCalificacion] = useState(0)
  const [calificacionHover, setCalificacionHover] = useState(0)
  const [comentarioResena, setComentarioResena] = useState('')
  const [resenas, setResenas] = useState([])
  const [promedioResenas, setPromedioResenas] = useState(0)
  const [totalResenas, setTotalResenas] = useState(0)
  const [mostrarFormResena, setMostrarFormResena] = useState(false)
  const [pedidoReciente, setPedidoReciente] = useState(null)
  const [cargandoResenas, setCargandoResenas] = useState(false)

  const [puedeInstalar, setPuedeInstalar] = useState(false)
  
  const [modoOscuro, setModoOscuro] = useState(() => {
    const guardado = localStorage.getItem('ineva_modo_oscuro')
    if (guardado !== null) return guardado === 'true'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  const [mostrarFidelidad, setMostrarFidelidad] = useState(false)
  const [puntosCliente, setPuntosCliente] = useState(null)
  const [nivelCliente, setNivelCliente] = useState('bronce')
  const [historialPuntos, setHistorialPuntos] = useState([])
  const [premiosDisponibles, setPremiosDisponibles] = useState([])
  const [periodoActivo, setPeriodoActivo] = useState(null)
  const [configFidelidad, setConfigFidelidad] = useState(null)
  const [mostrarAdminFidelidad, setMostrarAdminFidelidad] = useState(false)
  const [periodosFidelidad, setPeriodosFidelidad] = useState([])
  const [canjesFidelidad, setCanjesFidelidad] = useState([])
  const [nuevoPeriodo, setNuevoPeriodo] = useState({
    nombre: '', fechaInicio: '', fechaCierre: '', puntosPorCienPesos: 1,
    bonusCantidad: 5, bonusPuntos: 10, activo: true
  })
  const [nuevoPremio, setNuevoPremio] = useState({
    nombre: '', descripcion: '', puntosRequeridos: 100, tipo: 'canje', cantidadDisponible: 1
  })

  const [mostrarReservas, setMostrarReservas] = useState(false)
  const [formReserva, setFormReserva] = useState({
    nombre: '', telefono: '', fecha: '', hora: '', personas: '2', mensaje: ''
  })

  useEffect(() => {
    localStorage.setItem('ineva_modo_oscuro', modoOscuro)
    document.documentElement.classList.toggle('modo-oscuro', modoOscuro)
  }, [modoOscuro])

  const toggleModoOscuro = () => setModoOscuro(prev => !prev)

  const DATOS_DIA = {
    nombre: 'Ineva Resto-Bar',
    direccion: 'López y Planes Nº 470 - Orán',
    telefono: '3878541224',
    telefonoFijo: '3878770614',
    telefonoWhatsApp: '5493878541224',
    horarios: 'Lunes a Sábados de 09:00 a 15:00 hs',
    deliveryCosto: 0,
    deliveryRadio: 5,
    deliveryTexto: 'Delivery GRATIS',
    subtitulo: 'Restó & Bar'
  }

  const DATOS_NOCHE = {
    nombre: 'Ineva Resto-Bar',
    direccion: 'López y Planes Nº 470 - Orán',
    telefono: '3878750460',
    telefonoFijo: '3878770614',
    telefonoWhatsApp: '5493878750460',
    horarios: 'Lunes y Miércoles a Sábados de 21:00 a 04:00 hs',
    deliveryCosto: null,
    deliveryRadio: 3,
    deliveryTexto: 'Consultar precio de delivery',
    subtitulo: 'Noche de Tragos & Música'
  }

  const datosActuales = turnoActual === 'noche' ? DATOS_NOCHE : DATOS_DIA
  const WHATSAPP_NUMBER = datosActuales.telefonoWhatsApp

  const coctelesClasicos = [
    { id: 'n1', nombre: 'Daiquiri', precio: 3500, categoria: 'cocteles', turno: 'noche', ingredientes: 'Ron - Fruta a Elección (Frutilla, Durazno, Ananá)', orden: 1 },
    { id: 'n2', nombre: 'Primavera', precio: 3500, categoria: 'cocteles', turno: 'noche', ingredientes: 'Vodka - Jugo de Naranja - Frutilla - Durazno - Ananá', orden: 2 },
    { id: 'n3', nombre: 'Sex on The Beach', precio: 4000, categoria: 'cocteles', turno: 'noche', ingredientes: 'Vodka - Licor de Durazno - Jugo de Naranja - Granadina', orden: 3 },
    { id: 'n4', nombre: 'Tequila Sunrise', precio: 4000, categoria: 'cocteles', turno: 'noche', ingredientes: 'Tequila - Jugo de Naranja - Granadina', orden: 4 },
    { id: 'n5', nombre: 'Cuba Libre', precio: 3000, categoria: 'cocteles', turno: 'noche', ingredientes: 'Ron - Coca Cola - Jugo de Limón', orden: 5 },
    { id: 'n6', nombre: 'Gancia Batido', precio: 2500, categoria: 'cocteles', turno: 'noche', ingredientes: 'Gancia - Limón - Azúcar', orden: 6 },
    { id: 'n7', nombre: 'Laguna Azul', precio: 3500, categoria: 'cocteles', turno: 'noche', ingredientes: 'Vodka - Blue Curacao - Limón - Sprite', orden: 7 },
    { id: 'n8', nombre: 'Mexicana', precio: 3500, categoria: 'cocteles', turno: 'noche', ingredientes: 'Tequila - Ananá - Granadina', orden: 8 },
    { id: 'n9', nombre: 'Caipiroska', precio: 3000, categoria: 'cocteles', turno: 'noche', ingredientes: 'Vodka - Trozo de Limón - Azúcar', orden: 9 },
    { id: 'n10', nombre: 'Caipi Frutos Rojos', precio: 3500, categoria: 'cocteles', turno: 'noche', ingredientes: 'Vodka - Trozo de Limón - Frutos Rojos - Azúcar', orden: 10 },
    { id: 'n11', nombre: 'Piel de Iguana', precio: 4000, categoria: 'cocteles', turno: 'noche', ingredientes: 'Vodka - Gancia - Licor de Melón - Blue Curacao - Sprite', orden: 11 },
    { id: 'n12', nombre: 'Long Island', precio: 5000, categoria: 'cocteles', turno: 'noche', ingredientes: 'Vodka - Tequila - Ron - Gin - Jugo de Naranja - Limón - Coca Cola', orden: 12 },
    { id: 'n13', nombre: 'Tom Collins', precio: 3500, categoria: 'cocteles', turno: 'noche', ingredientes: 'Gin - Azúcar - Jugo de Limón - Soda', orden: 13 },
    { id: 'n14', nombre: 'Mojito', precio: 3500, categoria: 'cocteles', turno: 'noche', ingredientes: 'Ron - Menta - Jugo de Limón - Soda', orden: 14 },
    { id: 'n15', nombre: 'Campari', precio: 3000, categoria: 'cocteles', turno: 'noche', ingredientes: 'Campari - Jugo de Naranja - Hielo', orden: 15 },
    { id: 'n16', nombre: 'Baileys', precio: 4000, categoria: 'cocteles', turno: 'noche', ingredientes: 'Vodka - Baileys - Licor de Chocolate - Azúcar', orden: 16 },
    { id: 'n17', nombre: 'Aperol Spritz', precio: 3500, categoria: 'cocteles', turno: 'noche', ingredientes: 'Aperol - Soda', orden: 17 },
    { id: 'n18', nombre: 'Deseo', precio: 3500, categoria: 'cocteles', turno: 'noche', ingredientes: 'Vodka - Gancia - Almíbar Frutos Rojos - Sprite - Granadina', orden: 18 },
    { id: 'n19', nombre: 'Caipirinha', precio: 3000, categoria: 'cocteles', turno: 'noche', ingredientes: 'Cachaza - Limón - Azúcar - Hielo', orden: 19 },
    { id: 'n20', nombre: 'Piña Frozen', precio: 3500, categoria: 'cocteles', turno: 'noche', ingredientes: 'Piña Colada - Ananá', orden: 20 },
    { id: 'n21', nombre: 'Orgasmo', precio: 4000, categoria: 'cocteles', turno: 'noche', ingredientes: 'Vodka - Piña Colada - Licor de Durazno - Granadina', orden: 21 },
    { id: 'n22', nombre: 'Pantera Rosa', precio: 4000, categoria: 'cocteles', turno: 'noche', ingredientes: 'Vodka - Piña Colada - Granadina - Licor de frutilla', orden: 22 },
    { id: 'n23', nombre: 'Hawaiano Azul', precio: 4000, categoria: 'cocteles', turno: 'noche', ingredientes: 'Ron - Piña Colada - Blue Curacao', orden: 23 },
    { id: 'n24', nombre: 'Margarita', precio: 3500, categoria: 'cocteles', turno: 'noche', ingredientes: 'Tequila - Triple sec - Jugo de limón - Azúcar', orden: 24 },
    { id: 'n25', nombre: 'Affair', precio: 4000, categoria: 'cocteles', turno: 'noche', ingredientes: 'Vodka - Licor de Frutilla - Jugo de Naranja - Frutos Rojos - Soda', orden: 25 },
  ]

  const ginTonics = [
    { id: 'gt1', nombre: 'Gin Tonic - New Styles', precio: 4000, categoria: 'ginTonic', turno: 'noche', ingredientes: 'Gin New Styles - Agua Tónica - Jugo de Limón', orden: 26 },
    { id: 'gt2', nombre: 'Gin Tonic - Gordon\'s', precio: 4500, categoria: 'ginTonic', turno: 'noche', ingredientes: 'Gin Gordon\'s - Agua Tónica - Jugo de Limón', orden: 27 },
    { id: 'gt3', nombre: 'Gin Tonic - Beefeater', precio: 4500, categoria: 'ginTonic', turno: 'noche', ingredientes: 'Gin Beefeater - Agua Tónica - Jugo de Limón', orden: 28 },
    { id: 'gt4', nombre: 'Gin Tonic - Bulldog', precio: 5000, categoria: 'ginTonic', turno: 'noche', ingredientes: 'Gin Bulldog - Agua Tónica - Jugo de Limón', orden: 29 },
    { id: 'gt5', nombre: 'Gin Tonic - Bombay', precio: 5000, categoria: 'ginTonic', turno: 'noche', ingredientes: 'Gin Bombay - Agua Tónica - Jugo de Limón', orden: 30 },
    { id: 'gt6', nombre: 'Gin Tonic - Tanqueray', precio: 5500, categoria: 'ginTonic', turno: 'noche', ingredientes: 'Gin Tanqueray - Agua Tónica - Jugo de Limón', orden: 31 },
    { id: 'gt7', nombre: 'Gin Tonic Frutos Rojos - Bols Pink', precio: 4500, categoria: 'ginTonic', turno: 'noche', ingredientes: 'Gin Bols Pink - Agua Tónica', orden: 32 },
    { id: 'gt8', nombre: 'Gin Tonic Frutos Rojos - Gordon\'s', precio: 5000, categoria: 'ginTonic', turno: 'noche', ingredientes: 'Gin Gordon\'s - Agua Tónica', orden: 33 },
    { id: 'gt9', nombre: 'Gin Tonic Frutos Rojos - Beefeater', precio: 5000, categoria: 'ginTonic', turno: 'noche', ingredientes: 'Gin Beefeater - Agua Tónica', orden: 34 },
    { id: 'gt10', nombre: 'Gin Tonic Frutos Rojos - Bulldog', precio: 5500, categoria: 'ginTonic', turno: 'noche', ingredientes: 'Gin Bulldog - Agua Tónica', orden: 35 },
    { id: 'gt11', nombre: 'Gin Tonic Frutos Rojos - Bombay', precio: 5500, categoria: 'ginTonic', turno: 'noche', ingredientes: 'Gin Bombay - Agua Tónica', orden: 36 },
    { id: 'gt12', nombre: 'Gin Tonic Frutos Rojos - Tanqueray', precio: 6000, categoria: 'ginTonic', turno: 'noche', ingredientes: 'Gin Tanqueray - Agua Tónica', orden: 37 },
  ]

  const medidasYJarras = [
    { id: 'mj1', nombre: 'Fernet con Coca (Medida)', precio: 2500, categoria: 'medidas', turno: 'noche', orden: 38 },
    { id: 'mj2', nombre: 'Vodka con Speed (Medida)', precio: 2500, categoria: 'medidas', turno: 'noche', orden: 39 },
    { id: 'mj3', nombre: 'Gancia con Sprite (Medida)', precio: 2000, categoria: 'medidas', turno: 'noche', orden: 40 },
    { id: 'mj4', nombre: 'Absolut con Speed (Medida)', precio: 3000, categoria: 'medidas', turno: 'noche', orden: 41 },
    { id: 'mj5', nombre: 'Jarra Fernet con Coca', precio: 8000, categoria: 'jarras', turno: 'noche', orden: 42 },
    { id: 'mj6', nombre: 'Jarra Vodka con Speed', precio: 8000, categoria: 'jarras', turno: 'noche', orden: 43 },
    { id: 'mj7', nombre: 'Jarra Gancia con Sprite', precio: 6000, categoria: 'jarras', turno: 'noche', orden: 44 },
  ]

  const whiskysYTequilas = [
    { id: 'wt1', nombre: 'Whisky Smuggler', precio: 3000, categoria: 'whiskys', turno: 'noche', orden: 45 },
    { id: 'wt2', nombre: 'Whisky Red Label', precio: 3500, categoria: 'whiskys', turno: 'noche', orden: 46 },
    { id: 'wt3', nombre: 'Whisky Black Label', precio: 5000, categoria: 'whiskys', turno: 'noche', orden: 47 },
    { id: 'wt4', nombre: 'Shot Promo Tequila', precio: 1500, categoria: 'tequilas', turno: 'noche', orden: 48 },
    { id: 'wt5', nombre: 'Shot Conquistador', precio: 2000, categoria: 'tequilas', turno: 'noche', orden: 49 },
    { id: 'wt6', nombre: 'Shot Sol Azteca', precio: 2000, categoria: 'tequilas', turno: 'noche', orden: 50 },
    { id: 'wt7', nombre: 'Shot José Cuervo', precio: 2500, categoria: 'tequilas', turno: 'noche', orden: 51 },
    { id: 'wt8', nombre: 'Ruleta de Tragos', precio: 5000, categoria: 'otros', turno: 'noche', orden: 52 },
  ]

  const cervezasNoche = [
    { id: 'cer1', nombre: 'Quilmes', precio: 2000, categoria: 'cervezas', turno: 'noche', orden: 53 },
    { id: 'cer2', nombre: 'Salta Rubia', precio: 1800, categoria: 'cervezas', turno: 'noche', orden: 54 },
    { id: 'cer3', nombre: 'Salta Negra', precio: 1800, categoria: 'cervezas', turno: 'noche', orden: 55 },
    { id: 'cer4', nombre: 'Brahma', precio: 1800, categoria: 'cervezas', turno: 'noche', orden: 56 },
    { id: 'cer5', nombre: 'Corona', precio: 2500, categoria: 'cervezas', turno: 'noche', orden: 57 },
    { id: 'cer6', nombre: 'Heineken', precio: 2500, categoria: 'cervezas', turno: 'noche', orden: 58 },
    { id: 'cer7', nombre: 'Miller', precio: 2000, categoria: 'cervezas', turno: 'noche', orden: 59 },
    { id: 'cer8', nombre: 'Budweiser', precio: 2000, categoria: 'cervezas', turno: 'noche', orden: 60 },
    { id: 'cer9', nombre: 'Stella Artois', precio: 2200, categoria: 'cervezas', turno: 'noche', orden: 61 },
  ]

  const vinosYEspumantes = [
    { id: 've1', nombre: 'Viñas de Balbo "T"', precio: 8000, categoria: 'vinos', turno: 'noche', orden: 62 },
    { id: 've2', nombre: 'Toro "T"', precio: 7000, categoria: 'vinos', turno: 'noche', orden: 63 },
    { id: 've3', nombre: 'Dada "T"', precio: 7500, categoria: 'vinos', turno: 'noche', orden: 64 },
    { id: 've4', nombre: 'Elemento "T"', precio: 7000, categoria: 'vinos', turno: 'noche', orden: 65 },
    { id: 've5', nombre: 'Dilema "B"', precio: 6500, categoria: 'vinos', turno: 'noche', orden: 66 },
    { id: 've6', nombre: 'Alma Mora', precio: 7000, categoria: 'vinos', turno: 'noche', orden: 67 },
    { id: 've7', nombre: 'Frizzé', precio: 5000, categoria: 'espumantes', turno: 'noche', orden: 68 },
    { id: 've8', nombre: 'New Age', precio: 4500, categoria: 'espumantes', turno: 'noche', orden: 69 },
    { id: 've9', nombre: 'Dr Lemón', precio: 4000, categoria: 'espumantes', turno: 'noche', orden: 70 },
    { id: 've10', nombre: 'Champagne c/Speed', precio: 6000, categoria: 'espumantes', turno: 'noche', orden: 71 },
  ]

  const comidasNoche = [
    { id: 'cn1', nombre: 'Pizza Muzza', precio: 7000, categoria: 'pizzasNoche', turno: 'noche', orden: 72 },
    { id: 'cn2', nombre: 'Pizza Especial', precio: 8500, categoria: 'pizzasNoche', turno: 'noche', orden: 73 },
    { id: 'cn3', nombre: 'Pizza Doble Muzza', precio: 8000, categoria: 'pizzasNoche', turno: 'noche', orden: 74 },
    { id: 'cn4', nombre: 'Pizza Napolitana', precio: 8500, categoria: 'pizzasNoche', turno: 'noche', orden: 75 },
    { id: 'cn5', nombre: 'Pizza Argentina', precio: 9000, categoria: 'pizzasNoche', turno: 'noche', orden: 76 },
    { id: 'cn6', nombre: 'Pizza Primavera', precio: 8500, categoria: 'pizzasNoche', turno: 'noche', orden: 77 },
    { id: 'cn7', nombre: 'Pizza de Pollo', precio: 9000, categoria: 'pizzasNoche', turno: 'noche', orden: 78 },
    { id: 'cn8', nombre: 'Empanada de Carne', precio: 1100, categoria: 'empanadasNoche', turno: 'noche', orden: 79 },
    { id: 'cn9', nombre: 'Empanada de Pollo', precio: 1100, categoria: 'empanadasNoche', turno: 'noche', orden: 80 },
    { id: 'cn10', nombre: 'Empanada Árabe', precio: 1100, categoria: 'empanadasNoche', turno: 'noche', orden: 81 },
    { id: 'cn11', nombre: 'Empanada Jamón y Queso', precio: 1100, categoria: 'empanadasNoche', turno: 'noche', orden: 82 },
    { id: 'cn12', nombre: 'Sándwich de Milanesa', precio: 5000, categoria: 'minutas', turno: 'noche', orden: 83 },
    { id: 'cn13', nombre: 'Sándwich de Lomito', precio: 5000, categoria: 'minutas', turno: 'noche', orden: 84 },
    { id: 'cn14', nombre: 'Hamburguesa', precio: 5000, categoria: 'minutas', turno: 'noche', orden: 85 },
    { id: 'cn15', nombre: 'Napo para Dos', precio: 6000, categoria: 'minutas', turno: 'noche', orden: 86 },
    { id: 'cn16', nombre: 'Papas Fritas', precio: 3000, categoria: 'extras', turno: 'noche', orden: 87 },
    { id: 'cn17', nombre: 'Papas Gratinadas', precio: 3500, categoria: 'extras', turno: 'noche', orden: 88 },
    { id: 'cn18', nombre: 'Papas Cheddar', precio: 3500, categoria: 'extras', turno: 'noche', orden: 89 },
    { id: 'cn19', nombre: 'Papas Bacon', precio: 4000, categoria: 'extras', turno: 'noche', orden: 90 },
  ]

  const bebidasSinAlcoholNoche = [
    { id: 'bs1', nombre: 'Gaseosa Chica', precio: 1500, categoria: 'sinAlcohol', turno: 'noche', orden: 91 },
    { id: 'bs2', nombre: 'Gaseosa 1 lts', precio: 2500, categoria: 'sinAlcohol', turno: 'noche', orden: 92 },
    { id: 'bs3', nombre: 'Gaseosa 1.5 lts', precio: 3000, categoria: 'sinAlcohol', turno: 'noche', orden: 93 },
    { id: 'bs4', nombre: 'Gaseosa 2 lts', precio: 4000, categoria: 'sinAlcohol', turno: 'noche', orden: 94 },
    { id: 'bs5', nombre: 'Agua Mineral Chica', precio: 1000, categoria: 'sinAlcohol', turno: 'noche', orden: 95 },
    { id: 'bs6', nombre: 'Agua Mineral Grande', precio: 1500, categoria: 'sinAlcohol', turno: 'noche', orden: 96 },
    { id: 'bs7', nombre: 'Soda', precio: 1000, categoria: 'sinAlcohol', turno: 'noche', orden: 97 },
    { id: 'bs8', nombre: 'Agua Saborizada', precio: 1500, categoria: 'sinAlcohol', turno: 'noche', orden: 98 },
    { id: 'bs9', nombre: 'Speed Chica', precio: 1500, categoria: 'sinAlcohol', turno: 'noche', orden: 99 },
    { id: 'bs10', nombre: 'Speed Grande', precio: 2500, categoria: 'sinAlcohol', turno: 'noche', orden: 100 },
    { id: 'bs11', nombre: 'Limonada Clásica', precio: 2000, categoria: 'sinAlcohol', turno: 'noche', orden: 101 },
    { id: 'bs12', nombre: 'Limonada c/Menta y Jengibre', precio: 2500, categoria: 'sinAlcohol', turno: 'noche', orden: 102 },
    { id: 'bs13', nombre: 'Jugo de Naranja', precio: 2000, categoria: 'sinAlcohol', turno: 'noche', orden: 103 },
  ]

  const menuDelDia = [
    { id: 1, nombre: 'Menú del Día #1 - Milanesa con Puré', precio: 12000, categoria: 'menuDelDia', turno: 'dia', orden: 1 },
    { id: 2, nombre: 'Menú del Día #2 - Pollo al Horno con Arroz', precio: 12000, categoria: 'menuDelDia', turno: 'dia', orden: 2 },
    { id: 3, nombre: 'Menú del Día #3 - Pasta con Salsa Bolognesa', precio: 11000, categoria: 'menuDelDia', turno: 'dia', orden: 3 },
  ]
  const comidasFijas = [
    { id: 4, nombre: 'Milanesa con Guarnición', precio: 11000, categoria: 'comidasFijas', turno: 'dia', orden: 4 },
    { id: 6, nombre: 'Costeleta con Guarnición', precio: 9500, categoria: 'comidasFijas', turno: 'dia', orden: 5 },
    { id: 7, nombre: 'Mila Napo', precio: 7000, categoria: 'comidasFijas', turno: 'dia', orden: 6 },
    { id: 8, nombre: 'Mila a Caballo', precio: 7000, categoria: 'comidasFijas', turno: 'dia', orden: 7 },
    { id: 10, nombre: 'Hamburguesa con Guarnición', precio: 7000, categoria: 'comidasFijas', turno: 'dia', orden: 8 },
    { id: 11, nombre: 'Sándwich de Lomito', precio: 7000, categoria: 'comidasFijas', turno: 'dia', orden: 9 },
    { id: 12, nombre: 'Sándwich de Milanesa', precio: 7000, categoria: 'comidasFijas', turno: 'dia', orden: 10 },
    { id: 13, nombre: 'Hamburguesa', precio: 7000, categoria: 'comidasFijas', turno: 'dia', orden: 11 },
  ]
  const pizzasDetalladas = [
    { id: 'p1', nombre: 'Muzza', precio: 7000, categoria: 'pizzas', turno: 'ambos', orden: 12 },
    { id: 'p2', nombre: 'Napo', precio: 8500, categoria: 'pizzas', turno: 'ambos', orden: 13 },
    { id: 'p3', nombre: 'Especial', precio: 9000, categoria: 'pizzas', turno: 'ambos', orden: 14 },
    { id: 'p4', nombre: 'Fugazza', precio: 7500, categoria: 'pizzas', turno: 'ambos', orden: 15 },
    { id: 'p5', nombre: 'Fugazzeta', precio: 8000, categoria: 'pizzas', turno: 'ambos', orden: 16 },
    { id: 'p6', nombre: 'Calabresa', precio: 8500, categoria: 'pizzas', turno: 'ambos', orden: 17 },
  ]
  const empanadasDetalladas = [
    { id: 'e1', nombre: 'Carne', precio: 1100, categoria: 'empanadas', turno: 'ambos', orden: 18 },
    { id: 'e2', nombre: 'Pollo', precio: 1100, categoria: 'empanadas', turno: 'ambos', orden: 19 },
    { id: 'e3', nombre: 'Jamón y Queso', precio: 1100, categoria: 'empanadas', turno: 'ambos', orden: 20 },
    { id: 'e4', nombre: 'Queso y Cebolla', precio: 1100, categoria: 'empanadas', turno: 'ambos', orden: 21 },
    { id: 'e5', nombre: 'Árabe', precio: 1100, categoria: 'empanadas', turno: 'ambos', orden: 22 },
    { id: 'e6', nombre: 'Verdura', precio: 1100, categoria: 'empanadas', turno: 'ambos', orden: 23 },
    { id: 'e7', nombre: 'Choclo', precio: 1100, categoria: 'empanadas', turno: 'ambos', orden: 24 },
  ]
  const desayunos = [
    { id: 14, nombre: 'Desayuno (Mate Cocido)', precio: 8500, categoria: 'desayunos', turno: 'dia', orden: 25 },
    { id: 15, nombre: 'Desayuno (Té)', precio: 5000, categoria: 'desayunos', turno: 'dia', orden: 26 },
    { id: 16, nombre: 'Licuados', precio: 4500, categoria: 'desayunos', turno: 'dia', orden: 27 },
    { id: 17, nombre: 'Jugos Naturales', precio: 6000, categoria: 'desayunos', turno: 'dia', orden: 28 },
  ]
  const bebidasDia = [
    { id: 18, nombre: 'Coca Cola 2 lts', precio: 4000, categoria: 'bebidas', turno: 'ambos', orden: 29 },
    { id: 19, nombre: 'Coca Cola 1.5 lts', precio: 2500, categoria: 'bebidas', turno: 'ambos', orden: 30 },
    { id: 20, nombre: 'Coca Cola 1 lts', precio: 2000, categoria: 'bebidas', turno: 'ambos', orden: 31 },
    { id: 21, nombre: 'Agua Saborizada', precio: 1500, categoria: 'bebidas', turno: 'ambos', orden: 32 },
    { id: 22, nombre: 'Agua Mineral', precio: 1000, categoria: 'bebidas', turno: 'ambos', orden: 33 },
    { id: 23, nombre: 'Vino Viña de Balbo', precio: 5000, categoria: 'bebidas', turno: 'ambos', orden: 34 },
  ]

  const categoriasInfoDia = {
    menuDelDia: { nombre: 'Menú del Día', emoji: '📋', color: '#6c5ce7' },
    comidasFijas: { nombre: 'Comidas Fijas', emoji: '🍽️', color: '#00b894' },
    pizzas: { nombre: 'Pizzas', emoji: '🍕', color: '#e17055' },
    empanadas: { nombre: 'Empanadas', emoji: '🥟', color: '#fdcb6e' },
    desayunos: { nombre: 'Desayunos', emoji: '🥐', color: '#a29bfe' },
    bebidas: { nombre: 'Bebidas', emoji: '🥤', color: '#00cec9' }
  }

  const categoriasInfoNoche = {
    cocteles: { nombre: 'Cócteles Clásicos', emoji: '🍹', color: '#EC4899' },
    ginTonic: { nombre: 'Gin Tonic', emoji: '🍸', color: '#06B6D4' },
    medidas: { nombre: 'Medidas', emoji: '🥃', color: '#F59E0B' },
    jarras: { nombre: 'Jarras', emoji: '🍺', color: '#8B5CF6' },
    whiskys: { nombre: 'Whiskys', emoji: '🥃', color: '#D97706' },
    tequilas: { nombre: 'Tequilas & Shots', emoji: '🌵', color: '#10B981' },
    otros: { nombre: 'Otros', emoji: '🎲', color: '#EF4444' },
    cervezas: { nombre: 'Cervezas', emoji: '🍻', color: '#F59E0B' },
    vinos: { nombre: 'Vinos', emoji: '🍷', color: '#7C3AED' },
    espumantes: { nombre: 'Espumantes', emoji: '🥂', color: '#EC4899' },
    sinAlcohol: { nombre: 'Sin Alcohol', emoji: '🧃', color: '#06B6D4' },
    pizzasNoche: { nombre: 'Pizzas', emoji: '🍕', color: '#EF4444' },
    empanadasNoche: { nombre: 'Empanadas', emoji: '🥟', color: '#F59E0B' },
    minutas: { nombre: 'Minutas', emoji: '🥪', color: '#10B981' },
    extras: { nombre: 'Extras', emoji: '🍟', color: '#F97316' },
    promosNoche: { nombre: 'Super Promos Delivery', emoji: '🔥', color: '#FF0000' }
  }

  const categoriasOrdenNoche = [
    { key: 'promosNoche', nombre: '🔥 Super Promos Delivery', emoji: '🔥' },
    { key: 'empanadasNoche', nombre: 'Empanadas', emoji: '🥟' },
    { key: 'pizzasNoche', nombre: 'Pizzas', emoji: '🍕' },
    { key: 'minutas', nombre: 'Minutas', emoji: '🥪' },
    { key: 'extras', nombre: 'Extras', emoji: '🍟' },
    { key: 'cervezas', nombre: 'Cervezas', emoji: '🍻' },
    { key: 'vinos', nombre: 'Vinos', emoji: '🍷' },
    { key: 'cocteles', nombre: 'Cócteles Clásicos', emoji: '🍹' },
    { key: 'whiskys', nombre: 'Whiskys', emoji: '🥃' },
    { key: 'espumantes', nombre: 'Espumantes', emoji: '🥂' },
    { key: 'jarras', nombre: 'Jarras', emoji: '🍺' },
    { key: 'medidas', nombre: 'Medidas', emoji: '🥃' },
    { key: 'ginTonic', nombre: 'Gin Tonic', emoji: '🍸' },
    { key: 'tequilas', nombre: 'Tequila & Shots', emoji: '🌵' },
    { key: 'sinAlcohol', nombre: 'Sin Alcohol', emoji: '🧃' }
  ];

  const categoriasOrdenDia = [
    { key: 'menuDelDia', nombre: 'Menú del Día', emoji: '📋' },
    { key: 'comidasFijas', nombre: 'Comidas Fijas', emoji: '🍽️' },
    { key: 'pizzas', nombre: 'Pizzas', emoji: '🍕' },
    { key: 'empanadas', nombre: 'Empanadas', emoji: '🥟' },
    { key: 'desayunos', nombre: 'Desayunos', emoji: '🥐' },
    { key: 'bebidas', nombre: 'Bebidas', emoji: '🥤' }
  ];

  const pasosGuia = [
    { id: 'buscador', titulo: '🔍 Buscá rápido', descripcion: 'Usá el buscador para encontrar tus productos favoritos.' },
    { id: 'categorias', titulo: '📂 Categorías', descripcion: 'Hacé clic en las categorías para navegar rápido.' },
    { id: 'productos', titulo: '🍔 Agregá al carrito', descripcion: 'Hacé clic en "+ Agregar" para añadir productos.' },
    { id: 'carrito', titulo: '🛒 Tu pedido', descripcion: 'El carrito flotante te muestra el total.' },
    { id: 'finalizar', titulo: '📱 Finalizá tu pedido', descripcion: 'Completá tus datos y enviá por WhatsApp.' }
  ]

  useEffect(() => {
    const verificarTurno = () => {
      const ahora = new Date()
      const horaActual = ahora.getHours()
      const minutosActuales = ahora.getMinutes()
      const tiempoActualEnMinutos = horaActual * 60 + minutosActuales
      
      const aperturaDia = 9 * 60
      const cierreDia = 15 * 60
      const aperturaNoche = 21 * 60
      const cierreNoche = 4 * 60
      
      let nuevoTurno = 'dia'
      let abierto = false
      let msgHorario = ''
      let tiempoRest = ''
      
      if (tiempoActualEnMinutos >= aperturaDia && tiempoActualEnMinutos < cierreDia) {
        nuevoTurno = 'dia'
        abierto = true
        const minsHastaCierre = cierreDia - tiempoActualEnMinutos
        msgHorario = '🟢 Abierto ahora'
        tiempoRest = `Cierra en ${Math.floor(minsHastaCierre / 60)}h ${minsHastaCierre % 60}min`
      } else if (tiempoActualEnMinutos >= cierreDia && tiempoActualEnMinutos < aperturaNoche) {
        nuevoTurno = 'prevent'
        abierto = false
        const minsHastaApertura = aperturaNoche - tiempoActualEnMinutos
        msgHorario = '🌆 Preventa Nocturna'
        tiempoRest = `Abrimos a las 21:00 (en ${Math.floor(minsHastaApertura / 60)}h ${minsHastaApertura % 60}min)`
      } else if (tiempoActualEnMinutos >= aperturaNoche || tiempoActualEnMinutos < cierreNoche) {
        nuevoTurno = 'noche'
        abierto = true
        if (tiempoActualEnMinutos >= aperturaNoche) {
          const minsHastaCierre = (24 * 60 - tiempoActualEnMinutos) + cierreNoche
          msgHorario = '🌙 Abierto - Noche de Tragos'
          tiempoRest = `Cierra a las 04:00 (en ${Math.floor(minsHastaCierre / 60)}h ${minsHastaCierre % 60}min)`
        } else {
          const minsHastaCierre = cierreNoche - tiempoActualEnMinutos
          msgHorario = '🌙 Abierto - Noche de Tragos'
          tiempoRest = `Cierra a las 04:00 (en ${Math.floor(minsHastaCierre / 60)}h ${minsHastaCierre % 60}min)`
        }
      } else {
        nuevoTurno = 'dia'
        abierto = false
        const minsHastaApertura = aperturaDia - tiempoActualEnMinutos
        msgHorario = '🔴 Cerrado'
        tiempoRest = `Abrimos a las 09:00 (en ${Math.floor(minsHastaApertura / 60)}h ${minsHastaApertura % 60}min)`
      }
      
      setTurnoActual(nuevoTurno)
      setEstaAbierto(abierto)
      setMensajeHorario(msgHorario)
      setTiempoRestante(tiempoRest)
    }
    
    verificarTurno()
    const intervalo = setInterval(verificarTurno, 60000)
    return () => clearInterval(intervalo)
  }, [])

  useEffect(() => {
    document.body.classList.remove('turno-dia', 'turno-prevent', 'turno-noche')
    document.body.classList.add(`turno-${turnoActual}`)
  }, [turnoActual])

  useEffect(() => {
    const cargarConfigFidelidad = async () => {
      try {
        const configSnap = await getDoc(doc(db, 'fidelidad_config', 'general'))
        if (configSnap.exists()) setConfigFidelidad(configSnap.data())
      } catch (error) { console.error('Error cargando config fidelidad:', error) }
    }
    cargarConfigFidelidad()
  }, [])

  useEffect(() => {
    const cargarPeriodoActivo = async () => {
      try {
        const ahora = new Date().toISOString()
        const q = query(collection(db, 'fidelidad_periodos'), where('activo', '==', true), where('fechaInicio', '<=', ahora), where('fechaCierre', '>=', ahora))
        const querySnapshot = await getDocs(q)
        if (!querySnapshot.empty) setPeriodoActivo({ id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() })
      } catch (error) { console.error('Error cargando período activo:', error) }
    }
    cargarPeriodoActivo()
  }, [])

  useEffect(() => {
    const cargarDatosFidelidad = async () => {
      if (!telefono || !periodoActivo) return
      try {
        const clientesRef = collection(db, 'clientes')
        const q = query(clientesRef, where('telefono', '==', telefono))
        const querySnapshot = await getDocs(q)
        if (querySnapshot.empty) return
        const clienteId = querySnapshot.docs[0].id
        const puntosSnap = await getDoc(doc(db, 'fidelidad_puntos', `${clienteId}_${periodoActivo.id}`))
        if (puntosSnap.exists()) {
          const datosPuntos = puntosSnap.data()
          setPuntosCliente(datosPuntos)
          const totalPuntos = datosPuntos.totalPuntos || 0
          if (totalPuntos >= 501) setNivelCliente('oro')
          else if (totalPuntos >= 201) setNivelCliente('plata')
          else setNivelCliente('bronce')
          setHistorialPuntos(datosPuntos.historial || [])
        } else {
          setPuntosCliente({ totalPuntos: 0, pedidosRealizados: 0, historial: [] })
          setNivelCliente('bronce')
          setHistorialPuntos([])
        }
        const premiosQuery = query(collection(db, 'fidelidad_premios'), where('periodoId', '==', periodoActivo.id))
        const premiosSnapshot = await getDocs(premiosQuery)
        setPremiosDisponibles(premiosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
      } catch (error) { console.error('Error cargando datos fidelidad:', error) }
    }
    cargarDatosFidelidad()
  }, [telefono, periodoActivo])

  useEffect(() => {
    const cargarPeriodos = async () => {
      try {
        const q = query(collection(db, 'fidelidad_periodos'), orderBy('fechaInicio', 'desc'))
        const querySnapshot = await getDocs(q)
        setPeriodosFidelidad(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
      } catch (error) { console.error('Error cargando períodos:', error) }
    }
    if (esAdmin && mostrarAdminFidelidad) cargarPeriodos()
  }, [esAdmin, mostrarAdminFidelidad])

  useEffect(() => {
    const cargarCanjes = async () => {
      try {
        const q = query(collection(db, 'fidelidad_canjes'), orderBy('fecha', 'desc'))
        const querySnapshot = await getDocs(q)
        setCanjesFidelidad(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
      } catch (error) { console.error('Error cargando canjes:', error) }
    }
    if (esAdmin && mostrarAdminFidelidad) cargarCanjes()
  }, [esAdmin, mostrarAdminFidelidad])

  useEffect(() => {
    const cargarResenas = async () => {
      try {
        const q = query(collection(db, 'resenas'), orderBy('fecha', 'desc'))
        const querySnapshot = await getDocs(q)
        const resenasData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        setResenas(resenasData)
        if (resenasData.length > 0) {
          const suma = resenasData.reduce((acc, r) => acc + r.calificacion, 0)
          setPromedioResenas((suma / resenasData.length).toFixed(1))
          setTotalResenas(resenasData.length)
        }
      } catch (error) { console.error('Error cargando reseñas:', error) }
    }
    cargarResenas()
  }, [])

  useEffect(() => {
    const guiaVista = localStorage.getItem('ineva_guia_vista')
    if (!guiaVista) setTimeout(() => setMostrarGuia(true), 2000)
  }, [])

  useEffect(() => {
    const cargarCliente = async () => {
      const telefonoGuardado = localStorage.getItem('ineva_telefono')
      if (telefonoGuardado) {
        try {
          const q = query(collection(db, 'clientes'), where('telefono', '==', telefonoGuardado))
          const querySnapshot = await getDocs(q)
          if (!querySnapshot.empty) {
            const clienteData = querySnapshot.docs[0].data()
            setNombreCompleto(clienteData.nombre || '')
            setTelefono(clienteData.telefono || '')
            setSuscribirMenu(clienteData.suscribirMenu || false)
          }
        } catch (error) { console.error('Error cargando cliente:', error) }
      }
    }
    cargarCliente()
  }, [])

  useEffect(() => {
    const cargarProductos = async () => {
      try {
        console.log('🔍 Cargando productos de Firebase...')
        const querySnapshot = await getDocs(collection(db, 'productos'))
        console.log('📦 Documentos encontrados:', querySnapshot.size)
        const productos = querySnapshot.docs.map(doc => ({ 
          ...doc.data(), 
          firestoreId: doc.id, 
          id: doc.data().id || doc.id 
        }))
        console.log('✅ Productos cargados:', productos.length)
        setProductosFirebase(productos)
      } catch (error) { 
        console.error('❌ Error cargando productos:', error) 
      }
    }
    cargarProductos()
  }, [])

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'pedidos'), (snapshot) => {
      const pedidosActualizados = []
      snapshot.forEach((docSnap) => {
        const pedido = { id: docSnap.id, ...docSnap.data() }
        const diferenciaMinutos = (new Date() - new Date(pedido.fecha)) / (1000 * 60)
        if (pedido.estado === 'pendiente' && diferenciaMinutos < 30) pedidosActualizados.push(pedido)
      })
      pedidosActualizados.sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
      setPedidosNuevos(pedidosActualizados)
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    setMostrarCarritoFlotante(pedidos.reduce((sum, p) => sum + p.cantidad, 0) > 0)
  }, [pedidos])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (buscadorRef.current && !buscadorRef.current.contains(event.target)) setMostrarResultados(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const manejarPrompt = (evento) => { evento.preventDefault(); setPuedeInstalar(true); window.deferredPrompt = evento }
    window.addEventListener('beforeinstallprompt', manejarPrompt)
    return () => window.removeEventListener('beforeinstallprompt', manejarPrompt)
  }, [])

  const instalarPWA = () => {
    if (window.deferredPrompt) {
      window.deferredPrompt.prompt()
      window.deferredPrompt.userChoice.then(() => { setPuedeInstalar(false); window.deferredPrompt = null })
    }
  }

  const calcularPuntosPedido = (monto) => {
    if (!configFidelidad || !periodoActivo) return 0
    const puntosBase = Math.floor(monto / 100) * (periodoActivo.puntosPorCienPesos || configFidelidad.puntosPorCienPesos || 1)
    const multiplicador = configFidelidad.niveles?.[nivelCliente]?.multiplicador || 1
    return Math.floor(puntosBase * multiplicador)
  }

  const acumularPuntos = async (clienteId, montoPedido, pedidoId) => {
    if (!periodoActivo || !configFidelidad) return
    try {
      const puntosGanados = calcularPuntosPedido(montoPedido)
      const puntosRef = doc(db, 'fidelidad_puntos', `${clienteId}_${periodoActivo.id}`)
      const puntosSnap = await getDoc(puntosRef)
      if (puntosSnap.exists()) {
        const datosActuales = puntosSnap.data()
        const nuevosPedidos = (datosActuales.pedidosRealizados || 0) + 1
        const nuevosPuntos = (datosActuales.totalPuntos || 0) + puntosGanados
        let puntosBonus = 0
        const bonusConfig = periodoActivo.bonusPedidos || configFidelidad.bonusPedidos
        if (bonusConfig && nuevosPedidos % bonusConfig.cantidad === 0) puntosBonus = bonusConfig.puntos
        const totalConBonus = nuevosPuntos + puntosBonus
        const historialActual = datosActuales.historial || []
        historialActual.push({ fecha: new Date().toISOString(), tipo: 'pedido', puntos: puntosGanados, puntosBonus, monto: montoPedido, pedidoId, totalAcumulado: totalConBonus })
        await updateDoc(puntosRef, { totalPuntos: totalConBonus, pedidosRealizados: nuevosPedidos, historial: historialActual, ultimoPedido: new Date().toISOString() })
      } else {
        await setDoc(puntosRef, { clienteId, periodoId: periodoActivo.id, totalPuntos: puntosGanados, pedidosRealizados: 1, historial: [{ fecha: new Date().toISOString(), tipo: 'pedido', puntos: puntosGanados, puntosBonus: 0, monto: montoPedido, pedidoId, totalAcumulado: puntosGanados }], creadoEn: new Date().toISOString(), ultimoPedido: new Date().toISOString() })
      }
    } catch (error) { console.error('Error acumulando puntos:', error) }
  }

  const canjearPremio = async (premio) => {
    if (!puntosCliente || !telefono) { alert('❌ No tenés puntos acumulados'); return }
    if (puntosCliente.totalPuntos < premio.puntosRequeridos) { alert('❌ No tenés suficientes puntos'); return }
    if (!window.confirm(`¿Confirmar canje de "${premio.nombre}" por ${premio.puntosRequeridos} puntos?`)) return
    try {
      const q = query(collection(db, 'clientes'), where('telefono', '==', telefono))
      const querySnapshot = await getDocs(q)
      if (querySnapshot.empty) { alert('❌ Cliente no encontrado'); return }
      const clienteId = querySnapshot.docs[0].id
      const nuevosPuntos = puntosCliente.totalPuntos - premio.puntosRequeridos
      const historialActual = [...historialPuntos]
      historialActual.push({ fecha: new Date().toISOString(), tipo: 'canje', puntos: -premio.puntosRequeridos, premioId: premio.id, premioNombre: premio.nombre, totalAcumulado: nuevosPuntos })
      await updateDoc(doc(db, 'fidelidad_puntos', `${clienteId}_${periodoActivo.id}`), { totalPuntos: nuevosPuntos, historial: historialActual })
      await addDoc(collection(db, 'fidelidad_canjes'), { clienteId, clienteNombre: nombreCompleto, clienteTelefono: telefono, premioId: premio.id, premioNombre: premio.nombre, puntosCanjeados: premio.puntosRequeridos, fecha: new Date().toISOString(), periodoId: periodoActivo.id, estado: 'pendiente' })
      alert('✅ ¡Canje realizado! Mostrá este mensaje en el local.')
      setPuntosCliente({ ...puntosCliente, totalPuntos: nuevosPuntos })
    } catch (error) { alert('❌ Error al realizar el canje') }
  }

  const guardarPeriodo = async () => {
    if (!nuevoPeriodo.nombre || !nuevoPeriodo.fechaInicio || !nuevoPeriodo.fechaCierre) { alert('❌ Completá todos los campos'); return }
    try {
      await addDoc(collection(db, 'fidelidad_periodos'), { nombre: nuevoPeriodo.nombre, fechaInicio: new Date(nuevoPeriodo.fechaInicio).toISOString(), fechaCierre: new Date(nuevoPeriodo.fechaCierre).toISOString(), puntosPorCienPesos: Number(nuevoPeriodo.puntosPorCienPesos), bonusPedidos: { cantidad: Number(nuevoPeriodo.bonusCantidad), puntos: Number(nuevoPeriodo.bonusPuntos) }, activo: nuevoPeriodo.activo })
      alert('✅ Período creado')
      setNuevoPeriodo({ nombre: '', fechaInicio: '', fechaCierre: '', puntosPorCienPesos: 1, bonusCantidad: 5, bonusPuntos: 10, activo: true })
      const q = query(collection(db, 'fidelidad_periodos'), orderBy('fechaInicio', 'desc'))
      const qs = await getDocs(q)
      setPeriodosFidelidad(qs.docs.map(doc => ({ id: doc.id, ...doc.data() })))
    } catch (error) { alert('❌ Error: ' + error.message) }
  }

  const guardarPremio = async () => {
    if (!nuevoPremio.nombre || !nuevoPremio.descripcion || !periodoActivo) { alert('❌ Completá todos los campos y asegurate de tener un período activo'); return }
    try {
      await addDoc(collection(db, 'fidelidad_premios'), { nombre: nuevoPremio.nombre, descripcion: nuevoPremio.descripcion, puntosRequeridos: Number(nuevoPremio.puntosRequeridos), tipo: nuevoPremio.tipo, cantidadDisponible: Number(nuevoPremio.cantidadDisponible), periodoId: periodoActivo.id, activo: true })
      alert('✅ Premio creado')
      setNuevoPremio({ nombre: '', descripcion: '', puntosRequeridos: 100, tipo: 'canje', cantidadDisponible: 1 })
      const pq = query(collection(db, 'fidelidad_premios'), where('periodoId', '==', periodoActivo.id))
      const ps = await getDocs(pq)
      setPremiosDisponibles(ps.docs.map(doc => ({ id: doc.id, ...doc.data() })))
    } catch (error) { alert('❌ Error: ' + error.message) }
  }

  const togglePeriodoActivo = async (periodoId, estadoActual) => {
    try {
      await updateDoc(doc(db, 'fidelidad_periodos', periodoId), { activo: !estadoActual })
      alert('✅ Período actualizado')
      const q = query(collection(db, 'fidelidad_periodos'), orderBy('fechaInicio', 'desc'))
      const qs = await getDocs(q)
      setPeriodosFidelidad(qs.docs.map(doc => ({ id: doc.id, ...doc.data() })))
    } catch (error) { alert('❌ Error: ' + error.message) }
  }

  const marcarCanjeEntregado = async (canjeId) => {
    try {
      await updateDoc(doc(db, 'fidelidad_canjes', canjeId), { estado: 'entregado' })
      alert('✅ Canje marcado como entregado')
      const q = query(collection(db, 'fidelidad_canjes'), orderBy('fecha', 'desc'))
      const qs = await getDocs(q)
      setCanjesFidelidad(qs.docs.map(doc => ({ id: doc.id, ...doc.data() })))
    } catch (error) { alert('❌ Error: ' + error.message) }
  }

  const enviarReserva = async () => {
    if (!formReserva.nombre || !formReserva.telefono || !formReserva.fecha || !formReserva.hora) {
      alert('❌ Completá todos los campos obligatorios')
      return
    }
    try {
      await addDoc(collection(db, 'reservas'), {
        ...formReserva,
        fechaCreacion: new Date().toISOString(),
        estado: 'pendiente',
        turno: 'noche'
      })
      alert('✅ ¡Reserva enviada! Te confirmaremos por WhatsApp.')
      const mensaje = encodeURIComponent(`🎉 *NUEVA RESERVA - Ineva Resto-Bar*\n\n👤 ${formReserva.nombre}\n📱 ${formReserva.telefono}\n📅 ${formReserva.fecha}\n🕐 ${formReserva.hora}\n👥 ${formReserva.personas} personas\n💬 ${formReserva.mensaje || 'Sin mensaje'}`)
      window.open(`https://wa.me/${DATOS_NOCHE.telefonoWhatsApp}?text=${mensaje}`, '_blank')
      setMostrarReservas(false)
      setFormReserva({ nombre: '', telefono: '', fecha: '', hora: '', personas: '2', mensaje: '' })
    } catch (error) { alert('❌ Error al enviar la reserva') }
  }

  const renderizarEstrellas = (calificacionValor, tamano = 'normal', interactivo = false, onHover = null, onClick = null) => {
    const tamanoClase = tamano === 'grande' ? 'estrella-grande' : tamano === 'pequeno' ? 'estrella-pequeno' : 'estrella-normal'
    return (
      <div className={`estrellas-container ${interactivo ? 'interactivo' : ''}`} role="img" aria-label={`${calificacionValor} de 5 estrellas`}>
        {[1, 2, 3, 4, 5].map((estrella) => (
          <span key={estrella} className={`estrella ${tamanoClase} ${estrella <= (interactivo ? (calificacionHover || calificacionValor) : calificacionValor) ? 'activa' : ''}`}
            onMouseEnter={() => interactivo && onHover && onHover(estrella)}
            onMouseLeave={() => interactivo && onHover && onHover(0)}
            onClick={() => interactivo && onClick && onClick(estrella)}
            role="button" aria-label={`${estrella} estrella${estrella > 1 ? 's' : ''}`}>★</span>
        ))}
      </div>
    )
  }

  const obtenerTextoCalificacion = (promedio) => {
    if (promedio >= 4.5) return '¡Excelente!'
    if (promedio >= 4) return 'Muy bueno'
    if (promedio >= 3) return 'Bueno'
    if (promedio >= 2) return 'Regular'
    return 'Necesita mejorar'
  }

  const validarZonaDelivery = () => {
    if (!direccion.trim()) { setError('❌ Debes ingresar la dirección'); return false }
    setDireccionValida(true); return true
  }

  const abrirGoogleMaps = () => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(datosActuales.direccion)}`, '_blank')
  const llamarTelefono = () => window.location.href = `tel:${datosActuales.telefono}`

  const reproducirSonidoNotificacion = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      oscillator.connect(gainNode); gainNode.connect(audioContext.destination)
      oscillator.frequency.value = 800; oscillator.type = 'sine'; gainNode.gain.value = 0.3
      oscillator.start(); oscillator.stop(audioContext.currentTime + 0.2)
    } catch (error) {}
  }

  const cambiarEstadoPedido = async (pedidoId, nuevoEstado) => {
    try {
      await updateDoc(doc(db, 'pedidos', pedidoId), { estado: nuevoEstado, estadoActualizado: new Date().toISOString() })
      alert(`✅ Pedido marcado como: ${nuevoEstado}`)
      if (nuevoEstado === 'entregado') setPedidosNuevos(prev => prev.filter(p => p.id !== pedidoId))
    } catch (error) { alert('❌ Error al actualizar el pedido') }
  }

  const getProductosPorCategoria = (categoria) => {
    const firebaseProducts = productosFirebase.filter(p => {
      const productoTurno = p.turno || 'ambos'
      return p.categoria === categoria && (productoTurno === turnoActual || productoTurno === 'ambos')
    })
    if (firebaseProducts.length > 0) return firebaseProducts.sort((a, b) => (a.orden || 999) - (b.orden || 999))

    if (turnoActual === 'noche') {
      const productosNoche = {
        cocteles: coctelesClasicos, ginTonic: ginTonics, medidas: medidasYJarras.filter(p => p.categoria === 'medidas'),
        jarras: medidasYJarras.filter(p => p.categoria === 'jarras'), whiskys: whiskysYTequilas.filter(p => p.categoria === 'whiskys'),
        tequilas: whiskysYTequilas.filter(p => p.categoria === 'tequilas'), otros: whiskysYTequilas.filter(p => p.categoria === 'otros'),
        cervezas: cervezasNoche, vinos: vinosYEspumantes.filter(p => p.categoria === 'vinos'),
        espumantes: vinosYEspumantes.filter(p => p.categoria === 'espumantes'), sinAlcohol: bebidasSinAlcoholNoche,
        pizzasNoche: comidasNoche.filter(p => p.categoria === 'pizzasNoche'), empanadasNoche: comidasNoche.filter(p => p.categoria === 'empanadasNoche'),
        minutas: comidasNoche.filter(p => p.categoria === 'minutas'), extras: comidasNoche.filter(p => p.categoria === 'extras'),
        promosNoche: []
      }
      return (productosNoche[categoria] || []).sort((a, b) => (a.orden || 999) - (b.orden || 999))
    } else {
      const productosDia = { menuDelDia, comidasFijas, pizzas: pizzasDetalladas, empanadas: empanadasDetalladas, desayunos, bebidas: bebidasDia }
      return (productosDia[categoria] || []).sort((a, b) => (a.orden || 999) - (b.orden || 999))
    }
  }

  const formatearPrecio = (precio) => precio.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
  const copiarAlias = () => { navigator.clipboard.writeText('silvia.ge.nes').then(() => alert('✅ Alias copiado')).catch(() => alert('❌ No se pudo copiar')) }

  const getPasswordDesdeFirebase = async () => {
    try {
      const docSnap = await getDoc(doc(db, 'config', 'admin'))
      if (docSnap.exists()) return docSnap.data().password
      return 'ineva2024admin'
    } catch (error) { return 'ineva2024admin' }
  }

  const verificarLogin = async () => {
    const passwordGuardada = await getPasswordDesdeFirebase()
    if (passwordAdmin === passwordGuardada) { setEsAdmin(true); setMostrarLogin(false); setPasswordAdmin('') }
    else alert('❌ Contraseña incorrecta')
  }

  const logout = () => { setEsAdmin(false); setMostrarPanelAdmin(false) }

  const cambiarPassword = async () => {
    if (!passwordActual || !nuevaPassword || !confirmarPassword) { alert('❌ Completá todos los campos'); return }
    if (nuevaPassword !== confirmarPassword) { alert('❌ Las contraseñas no coinciden'); return }
    if (nuevaPassword.length < 6) { alert('❌ Mínimo 6 caracteres'); return }
    try {
      const passwordGuardada = await getPasswordDesdeFirebase()
      if (passwordActual !== passwordGuardada) { alert('❌ Contraseña actual incorrecta'); return }
      await updateDoc(doc(db, 'config', 'admin'), { password: nuevaPassword })
      alert('✅ Contraseña cambiada')
      setMostrarCambiarPassword(false); setNuevaPassword(''); setConfirmarPassword(''); setPasswordActual('')
    } catch (error) { alert('❌ Error al cambiar la contraseña') }
  }

  const enviarMenuDiario = async () => {
    if (!window.confirm('¿Enviar menú del día a todos los clientes suscritos?')) return
    try {
      const q = query(collection(db, 'clientes'), where('suscribirMenu', '==', true))
      const querySnapshot = await getDocs(q)
      if (querySnapshot.empty) { alert('❌ No hay clientes suscritos'); return }
      const clientesSuscriptos = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      const fechaHoy = new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      const menuDelDiaTexto = `🍔 *MENÚ DEL DÍA - INEVA RESTO-BAR* 🍔\n📅 ${fechaHoy.toUpperCase()}\n\n*Menú #1:* Milanesa con Puré - $12.000\n*Menú #2:* Pollo al Horno con Arroz - $12.000\n*Menú #3:* Pasta con Salsa Bolognesa - $11.000\n\n¡Te esperamos! 🎉`
      let enviados = 0
      for (const cliente of clientesSuscriptos) {
        try {
          const tel = cliente.telefono.replace(/\D/g, '')
          window.open(`https://wa.me/549${tel}?text=${encodeURIComponent(menuDelDiaTexto)}`, '_blank')
          enviados++
          await new Promise(resolve => setTimeout(resolve, 2000))
        } catch (error) {}
      }
      alert(`✅ Envío completado! Enviados: ${enviados}`)
    } catch (error) { alert('❌ Error: ' + error.message) }
  }

  const recargarProductos = async () => {
    try {
      console.log('🔄 Recargando productos...')
      const querySnapshot = await getDocs(collection(db, 'productos'))
      const productos = querySnapshot.docs.map(doc => ({ 
        ...doc.data(), 
        firestoreId: doc.id, 
        id: doc.data().id || doc.id 
      }))
      console.log('✅ Productos recargados:', productos.length)
      setProductosFirebase(productos)
    } catch (error) {
      console.error('❌ Error recargando productos:', error)
    }
  }

  const agregarProducto = async (producto) => {
    try {
      await addDoc(collection(db, 'productos'), { ...producto, disponible: true, fechaCreacion: new Date().toISOString() })
      alert('✅ Producto agregado'); await recargarProductos()
    } catch (error) { alert('❌ Error al agregar producto') }
  }

  const editarProducto = async (id, datosActualizados) => {
    try {
      const producto = productosFirebase.find(p => p.id === id || p.firestoreId === id)
      const firestoreId = producto?.firestoreId || id
      await setDoc(doc(db, 'productos', firestoreId), datosActualizados, { merge: true })
      setProductosFirebase(prev => prev.map(p => (p.id === id || p.firestoreId === id) ? { ...p, ...datosActualizados } : p))
      alert('✅ Producto actualizado')
    } catch (error) { alert('❌ Error: ' + error.message) }
  }

  const eliminarProducto = async (id) => {
    if (!window.confirm('¿Eliminar este producto?')) return
    try {
      const producto = productosFirebase.find(p => p.id === id || p.firestoreId === id)
      const firestoreId = producto?.firestoreId || id
      await deleteDoc(doc(db, 'productos', firestoreId))
      setProductosFirebase(prev => prev.filter(p => p.id !== id && p.firestoreId !== id))
      alert('✅ Producto eliminado')
    } catch (error) { alert('❌ Error: ' + error.message) }
  }
    const toggleDisponibilidad = async (id) => {
    try {
      const producto = productosFirebase.find(p => p.id === id || p.firestoreId === id)
      const firestoreId = producto?.firestoreId || id
      const nuevaDisponibilidad = !producto.disponible
      await setDoc(doc(db, 'productos', firestoreId), { disponible: nuevaDisponibilidad }, { merge: true })
      setProductosFirebase(prev => prev.map(p => (p.id === id || p.firestoreId === id) ? { ...p, disponible: nuevaDisponibilidad } : p))
      alert(nuevaDisponibilidad ? '✅ Producto marcado como DISPONIBLE' : '🔴 Producto marcado como AGOTADO')
    } catch (error) { alert(' Error: ' + error.message) }
  }

  const guardarDatosCliente = async () => {
    try {
      const q = query(collection(db, 'clientes'), where('telefono', '==', telefono))
      const querySnapshot = await getDocs(q)
      if (!querySnapshot.empty) {
        await updateDoc(querySnapshot.docs[0].ref, { nombre: nombreCompleto, suscribirMenu, ultimoPedido: new Date().toISOString() })
      } else {
        await addDoc(collection(db, 'clientes'), { nombre: nombreCompleto, telefono, suscribirMenu, fechaRegistro: new Date().toISOString(), ultimoPedido: new Date().toISOString() })
      }
      localStorage.setItem('ineva_telefono', telefono)
    } catch (error) { throw error }
  }

  const generarMensajeWhatsApp = () => {
    let mensaje = `* NUEVO PEDIDO - ${datosActuales.nombre}*\n\n`
    mensaje += `* Cliente:* ${nombreCompleto}\n* Teléfono:* ${telefono}\n* Tipo:* ${tipoEntrega === 'delivery' ? '🚚 Delivery' : '🏪 Retiro en local'}\n`
    if (tipoEntrega === 'delivery') mensaje += `* Dirección:* ${direccion}\n`
    mensaje += `\n* PEDIDO:*\n`
    pedidos.forEach((p) => {
      mensaje += `\n• ${p.cantidad}x ${p.nombre} - ${formatearPrecio(p.precio * p.cantidad)}`
      if (notasPorProducto[p.id]) mensaje += `\n   Nota: ${notasPorProducto[p.id]}`
    })
    mensaje += `\n\n* SUBTOTAL: ${formatearPrecio(total)}*`
    mensaje += `\n* TOTAL: ${formatearPrecio(totalConEnvio)}*`
    mensaje += `\n\n*💳 Alias:* silvia.ge.nes`
    return encodeURIComponent(mensaje)
  }

  const enviarPorWhatsApp = async () => {
    if (pedidos.length === 0) { setError('❌ No hay productos'); return }
    if (!nombreCompleto.trim()) { setError('❌ Ingresá tu nombre'); return }
    if (!telefono.trim()) { setError('❌ Ingresá tu teléfono'); return }
    if (!tipoEntrega) { setError('❌ Seleccioná tipo de entrega'); return }
    if (tipoEntrega === 'delivery' && turnoActual === 'noche') {
    } else if (tipoEntrega === 'delivery' && !direccion.trim()) {
      setError('❌ Ingresá la dirección'); return
    }
    if (!aceptoTerminos) { setError('⚠️ Aceptá los Términos'); setMostrarTerminos(true); return }
    setCargando(true)
    try {
      await guardarDatosCliente()
      const pedidoData = {
        cliente: { nombre: nombreCompleto, telefono },
        tipoEntrega, direccion: tipoEntrega === 'delivery' ? direccion : null,
        costoEnvio: turnoActual === 'noche' ? null : 0,
        productos: pedidos.map(p => ({ id: p.id, nombre: p.nombre, cantidad: p.cantidad, precio: p.precio, nota: notasPorProducto[p.id] || null })),
        subtotal: total, total: totalConEnvio, suscritoMenu: suscribirMenu,
        fecha: new Date().toISOString(), estado: 'pendiente', aceptoTerminos: true, turno: turnoActual
      }
      const docRef = await addDoc(collection(db, 'pedidos'), pedidoData)
      setError('')
      if (configFidelidad?.activo && periodoActivo) {
        const cq = query(collection(db, 'clientes'), where('telefono', '==', telefono))
        const cs = await getDocs(cq)
        if (!cs.empty) await acumularPuntos(cs.docs[0].id, totalConEnvio, docRef.id)
      }
      window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${generarMensajeWhatsApp()}`, '_blank')
      setPedidoReciente(docRef.id)
      setPedidos([]); setNotasPorProducto({}); setTipoEntrega(''); setDireccion('')
      setTimeout(() => setMostrarCalificacion(true), 2000)
    } catch (error) { setError('❌ Error al procesar el pedido') }
    finally { setCargando(false) }
  }

  const compartirProducto = (producto) => {
    const texto = `¡Mirá ${datosActuales.nombre}! ${producto.nombre} - ${formatearPrecio(producto.precio)} #InevaRestoBar`
    navigator.clipboard.writeText(texto).then(() => alert('📋 Texto copiado'))
  }

  const scrollToCart = () => { const cartSection = document.querySelector('.cart-section'); if (cartSection) cartSection.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
  const siguientePaso = () => { if (pasoActual < pasosGuia.length - 1) setPasoActual(pasoActual + 1); else { setMostrarGuia(false); localStorage.setItem('ineva_guia_vista', 'true') } }
  const pasoAnterior = () => { if (pasoActual > 0) setPasoActual(pasoActual - 1) }
  const saltarGuia = () => { setMostrarGuia(false); localStorage.setItem('ineva_guia_vista', 'true') }
  const abrirWhatsAppConsulta = () => window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Hola! Quisiera hacer una consulta.')}`, '_blank')

  const agregarPedido = (producto) => {
    setPedidos((pedidosActuales) => {
      const existe = pedidosActuales.find((p) => p.id === producto.id)
      if (existe) return pedidosActuales.map((p) => p.id === producto.id ? { ...p, cantidad: p.cantidad + 1 } : p)
      return [...pedidosActuales, { ...producto, cantidad: 1 }]
    })
  }
  const aumentarCantidad = (id) => setPedidos(prev => prev.map((p) => p.id === id ? { ...p, cantidad: p.cantidad + 1 } : p))
  const disminuirCantidad = (id) => setPedidos(prev => prev.map((p) => p.id === id ? { ...p, cantidad: p.cantidad - 1 } : p).filter((p) => p.cantidad > 0))
  const eliminarItem = (id) => {
    const nuevasNotas = { ...notasPorProducto }; delete nuevasNotas[id]; setNotasPorProducto(nuevasNotas)
    setPedidos(prev => prev.filter((p) => p.id !== id))
  }
  const actualizarNota = (id, nota) => setNotasPorProducto({ ...notasPorProducto, [id]: nota })

  const total = pedidos.reduce((sum, p) => sum + p.precio * p.cantidad, 0)
  const totalItems = pedidos.reduce((sum, p) => sum + p.cantidad, 0)
  const costoEnvio = tipoEntrega === 'delivery' && turnoActual !== 'noche' ? 0 : 0
  const totalConEnvio = total + costoEnvio

  const buscarProductos = (termino) => {
    if (!termino.trim()) { setResultadosBusqueda([]); setMostrarResultados(false); return }
    const terminoNormalizado = termino.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const resultados = []
    const todasCategorias = turnoActual === 'noche' ? categoriasInfoNoche : categoriasInfoDia
    Object.keys(todasCategorias).forEach(categoria => {
      const productos = getProductosPorCategoria(categoria)
      productos.forEach(producto => {
        const nombreNormalizado = producto.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        if (nombreNormalizado.includes(terminoNormalizado)) resultados.push({ ...producto, categoriaInfo: todasCategorias[categoria] })
      })
    })
    setResultadosBusqueda(resultados)
    setMostrarResultados(resultados.length > 0)
  }

  const handleBusquedaChange = (e) => { setTerminoBusqueda(e.target.value); buscarProductos(e.target.value) }
  const navegarASeccion = (categoria) => {
    const elemento = document.getElementById(`seccion-${categoria}`)
    if (elemento) {
      setSeccionDestacada(categoria)
      setTimeout(() => setSeccionDestacada(null), 2000)
      elemento.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setTerminoBusqueda(''); setMostrarResultados(false)
    }
  }
  const handleCategoriaClick = (categoria) => {
    if (categoriaActiva === categoria) setCategoriaActiva(null)
    else { setCategoriaActiva(categoria); navegarASeccion(categoria) }
  }

  const PanelAdministracion = () => {
    const [nuevoProducto, setNuevoProducto] = useState({ nombre: '', precio: '', categoria: 'comidasFijas', turno: 'dia', orden: '', imagenes: '' })
    const [tabActiva, setTabActiva] = useState('productos')
    
    console.log('📊 productosFirebase en admin:', productosFirebase.length)
    
    const handleSubmit = (e) => {
      e.preventDefault()
      if (!nuevoProducto.nombre || !nuevoProducto.precio) { alert('Completá todos los campos'); return }
      agregarProducto({ 
        nombre: nuevoProducto.nombre, 
        precio: Number(nuevoProducto.precio), 
        categoria: nuevoProducto.categoria, 
        turno: nuevoProducto.turno, 
        orden: nuevoProducto.orden ? Number(nuevoProducto.orden) : 999,
        imagenes: nuevoProducto.imagenes || ''
      })
      setNuevoProducto({ nombre: '', precio: '', categoria: 'comidasFijas', turno: 'dia', orden: '', imagenes: '' })
    }
    
    return (
      <div className="panel-admin-container" role="main" aria-label="Panel de administración">
        <div className="admin-tabs">
          <button className={`admin-tab ${tabActiva === 'pedidos' ? 'activa' : ''}`} onClick={() => setTabActiva('pedidos')}>📋 Pedidos</button>
          <button className={`admin-tab ${tabActiva === 'productos' ? 'activa' : ''}`} onClick={() => setTabActiva('productos')}>🔧 Productos</button>
          <button className={`admin-tab ${tabActiva === 'fidelidad' ? 'activa' : ''}`} onClick={() => setTabActiva('fidelidad')}>🏆 Fidelidad</button>
          <button className={`admin-tab ${tabActiva === 'reservas' ? 'activa' : ''}`} onClick={() => setTabActiva('reservas')}>📅 Reservas</button>
        </div>

        {tabActiva === 'pedidos' && (
          <div className="panel-section">
            <div className="panel-header">
              <h2>📋 Pedidos Pendientes ({pedidosNuevos.length})</h2>
              <button onClick={() => setSonidoActivado(!sonidoActivado)} className="btn-sonido" style={{ background: sonidoActivado ? '#00b894' : '#e74c3c' }}>
                {sonidoActivado ? '🔔 Sonido ON' : '🔕 Sonido OFF'}
              </button>
            </div>
            {pedidosNuevos.length === 0 ? <p className="no-pedidos">✅ No hay pedidos pendientes</p> : (
              <div className="pedidos-grid">
                {pedidosNuevos.map((pedido) => (
                  <div key={pedido.id} className="pedido-card" style={{ borderLeft: `4px solid ${pedido.estado === 'pendiente' ? '#ffc107' : pedido.estado === 'en_preparacion' ? '#00b894' : '#6c5ce7'}` }}>
                    <div className="pedido-header">
                      <div><strong>👤 {pedido.cliente?.nombre}</strong><div>📱 {pedido.cliente?.telefono}</div><div>🕐 {new Date(pedido.fecha).toLocaleTimeString('es-AR')}</div></div>
                      <div className="pedido-total"><div>{formatearPrecio(pedido.total)}</div><div className={`badge-entrega ${pedido.tipoEntrega === 'delivery' ? 'delivery' : 'retiro'}`}>{pedido.tipoEntrega === 'delivery' ? '🚚 Delivery' : '🏪 Retiro'}</div></div>
                    </div>
                    <div className="pedido-productos"><strong>📦 Productos:</strong><ul>{pedido.productos?.map((prod, idx) => (<li key={idx}>{prod.cantidad}x {prod.nombre}{prod.nota && <em> ({prod.nota})</em>}</li>))}</ul></div>
                    {pedido.direccion && <div className="pedido-direccion">🏠 {pedido.direccion}</div>}
                    <div className="pedido-botones">
                      {pedido.estado === 'pendiente' && <button onClick={() => cambiarEstadoPedido(pedido.id, 'en_preparacion')} className="btn-estado btn-preparar">👨‍🍳 Preparar</button>}
                      {pedido.estado === 'en_preparacion' && <button onClick={() => cambiarEstadoPedido(pedido.id, 'listo')} className="btn-estado btn-listo">✅ Listo</button>}
                      <button onClick={() => cambiarEstadoPedido(pedido.id, 'entregado')} className="btn-estado btn-entregado">📦 Entregado</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tabActiva === 'productos' && (
          <>
            <div className="panel-action verde">
              <h3>📩 Enviar Menú del Día</h3>
              <button onClick={enviarMenuDiario} className="btn-action">📩 Enviar</button>
            </div>
            
            <div className="botones-seguridad">
              <button onClick={() => setMostrarCambiarPassword(true)} className="btn-seguridad verde">
                🔑 Cambiar Contraseña
              </button>
            </div>
            
            <h2 className="panel-titulo">➕ Agregar Producto</h2>
            <form onSubmit={handleSubmit} className="form-producto">
              <input 
                type="text" 
                placeholder="Nombre" 
                value={nuevoProducto.nombre} 
                onChange={(e) => setNuevoProducto({...nuevoProducto, nombre: e.target.value})} 
                className="input-neumo" 
                required 
              />
              <input 
                type="number" 
                placeholder="Precio" 
                value={nuevoProducto.precio} 
                onChange={(e) => setNuevoProducto({...nuevoProducto, precio: e.target.value})} 
                className="input-neumo" 
                required 
              />
              <textarea 
                placeholder="📷 URLs de imágenes (separadas por coma). Ej: https://foto1.jpg, https://foto2.jpg"
                value={nuevoProducto.imagenes || ''}
                onChange={(e) => setNuevoProducto({...nuevoProducto, imagenes: e.target.value})}
                className="input-neumo textarea-neumo"
                rows="2"
              />
              <select 
                value={nuevoProducto.categoria} 
                onChange={(e) => setNuevoProducto({...nuevoProducto, categoria: e.target.value})} 
                className="input-neumo"
              >
                <option value="menuDelDia">Menú del Día</option>
                <option value="comidasFijas">Comidas Fijas</option>
                <option value="pizzas">Pizzas</option>
                <option value="empanadas">Empanadas</option>
                <option value="desayunos">Desayunos</option>
                <option value="bebidas">Bebidas</option>
                <option value="cocteles">Cócteles</option>
                <option value="ginTonic">Gin Tonic</option>
                <option value="medidas">Medidas</option>
                <option value="jarras">Jarras</option>
                <option value="whiskys">Whiskys</option>
                <option value="tequilas">Tequilas</option>
                <option value="cervezas">Cervezas</option>
                <option value="vinos">Vinos</option>
                <option value="espumantes">Espumantes</option>
                <option value="sinAlcohol">Sin Alcohol</option>
                <option value="pizzasNoche">Pizzas Noche</option>
                <option value="minutas">Minutas</option>
                <option value="extras">Extras</option>
                <option value="promosNoche">🔥 Promos Noche Delivery</option>
              </select>
              <select 
                value={nuevoProducto.turno} 
                onChange={(e) => setNuevoProducto({...nuevoProducto, turno: e.target.value})} 
                className="input-neumo"
              >
                <option value="dia">☀️ Solo Día</option>
                <option value="noche">🌙 Solo Noche</option>
                <option value="ambos">🔄 Ambos Turnos</option>
              </select>
              <button type="submit" className="btn-primary">➕ Agregar</button>
            </form>
            
            <div style={{ 
  marginBottom: '1rem', 
  padding: '1rem', 
  background: turnoActual === 'noche' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(0, 184, 148, 0.2)',
  borderRadius: '10px',
  border: `2px solid ${turnoActual === 'noche' ? '#8b5cf6' : '#00b894'}`,
  textAlign: 'center'
}}>
  <span style={{ 
    fontSize: '1.1rem', 
    fontWeight: 'bold',
    color: turnoActual === 'noche' ? '#a78bfa' : '#00b894'
  }}>
    {turnoActual === 'noche' ? '🌙 Turno Noche' : turnoActual === 'prevent' ? '🌆 Preventa' : '☀️ Turno Día'}
  </span>
  <span style={{ marginLeft: '10px', color: '#94a3b8' }}>
    ({[...productosFirebase].filter(p => {
      const tp = p.turno || 'ambos'
      if (tp === 'ambos') return true
      if (turnoActual === 'noche') return tp === 'noche'
      if (turnoActual === 'dia') return tp === 'dia'
      return false
    }).length} productos)
  </span>
</div>
            <h3>📋 Productos Existentes ({productosFirebase.length} en total)</h3>
            
            <div style={{ 
              marginBottom: '1.5rem', 
              padding: '1rem', 
              background: 'rgba(0,0,0,0.2)', 
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              flexWrap: 'wrap'
            }}>
              <button 
                onClick={recargarProductos} 
                className="btn-primary"
                style={{ margin: 0 }}
              >
                🔄 Recargar Productos
              </button>
              <span style={{ color: '#00b894', fontWeight: 'bold' }}>
                {productosFirebase.length} productos cargados
              </span>
            </div>
            
            {productosFirebase.length === 0 ? (
              <div className="sin-productos">
                <p>⚠️ No hay productos en Firebase</p>
                <p style={{ fontSize: '0.9rem', color: '#888' }}>
                  Agregá tu primer producto con el formulario de arriba
                </p>
              </div>
            ) : (
              <div className="productos-admin-grid">
                {[...productosFirebase]
  .filter((prod) => {
    // Filtrar por turno actual
    const turnoProducto = prod.turno || 'ambos'
    if (turnoProducto === 'ambos') return true
    if (turnoActual === 'noche') return turnoProducto === 'noche'
    if (turnoActual === 'dia') return turnoProducto === 'dia'
    return true
  })
  .sort((a, b) => {
    const ordenCategorias = {
      'menuDelDia': 1, 'comidasFijas': 2, 'pizzas': 3, 'empanadas': 4,
      'desayunos': 5, 'bebidas': 6, 'cocteles': 7, 'ginTonic': 8,
      'medidas': 9, 'jarras': 10, 'whiskys': 11, 'tequilas': 12,
      'cervezas': 13, 'vinos': 14, 'espumantes': 15, 'sinAlcohol': 16,
      'pizzasNoche': 17, 'empanadasNoche': 18, 'minutas': 19,
      'extras': 20, 'promosNoche': 21, 'otros': 22
    }
    const ordenA = ordenCategorias[a.categoria] || 999
    const ordenB = ordenCategorias[b.categoria] || 999
    if (ordenA !== ordenB) return ordenA - ordenB
    return Number(a.orden || 999) - Number(b.orden || 999)
  })
  .map((prod) => {
                    const productId = prod.firestoreId || prod.id;
                    const tieneFotos = prod.imagenes && prod.imagenes.toString().trim().length > 0;
                    
                    return (
                      <div key={productId} className="producto-admin-card">
                        <div className="producto-admin-info">
                          <strong>{prod.nombre || 'Sin nombre'}</strong>
                          <div className="precio">
                            ${prod.precio ? Number(prod.precio).toLocaleString('es-AR') : '0'}
                          </div>
                          <div className="meta">
                            📂 {prod.categoria || 'sin categoría'} • 
                            🕐 {prod.turno || 'ambos'}
                          </div>
                          {tieneFotos && (
                            <div className="meta" style={{ color: '#00b894', marginTop: '0.25rem' }}>
                              📷 Tiene fotos
                            </div>
                          )}
                        </div>
                        <div className="producto-admin-botones">
                          <button 
                            onClick={() => { 
                              const n = prompt('Nuevo nombre:', prod.nombre); 
                              if (n && n.trim()) editarProducto(productId, { nombre: n.trim() }) 
                            }} 
                            className="btn-small azul"
                          >
                            ✏️ Nombre
                          </button>
                          <button 
                            onClick={() => { 
                              const p = prompt('Nuevo precio:', prod.precio); 
                              if (p && !isNaN(Number(p))) editarProducto(productId, { precio: Number(p) }) 
                            }} 
                            className="btn-small verde"
                          >
                            💰 Precio
                          </button>
                          <button 
                            onClick={() => { 
                              const c = prompt('Nueva categoría:', prod.categoria); 
                              if (c && c.trim()) editarProducto(productId, { categoria: c.trim() }) 
                            }} 
                            className="btn-small purpura"
                          >
                            📂 Categoría
                          </button>
                          <button 
                            onClick={() => { 
                              const imgs = prompt(
                                'URLs de imágenes (separadas por coma):\n\nEjemplo:\nhttps://foto1.jpg, https://foto2.jpg', 
                                prod.imagenes || ''
                              ); 
                              if (imgs !== null) editarProducto(productId, { imagenes: imgs.trim() }) 
                            }} 
                            className={`btn-small ${tieneFotos ? 'naranja' : 'gris'}`}
                          >
                            📷 Fotos
                          </button>
                          <button 
  onClick={() => toggleDisponibilidad(productId)} 
  className={`btn-small ${producto.disponible !== false ? 'verde' : 'rojo'}`}
>
  {producto.disponible !== false ? '✅ Disponible' : '🔴 Agotado'}
</button>
                          <button 
                            onClick={() => eliminarProducto(productId)} 
                            className="btn-small rojo"
                          >
                            🗑️ Eliminar
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </>
        )}

        {tabActiva === 'fidelidad' && (
          <div className="panel-fidelidad">
            <h2 className="panel-titulo">🏆 Programa de Fidelidad</h2>
            <div className="fidelidad-config-info">
              <h3>⚙️ Configuración Actual</h3>
              {configFidelidad ? (
                <div className="config-cards">
                  <div className="config-card"><strong>Puntos por $100:</strong><span>{configFidelidad.puntosPorCienPesos || 1}</span></div>
                  <div className="config-card"><strong>Bonus cada {configFidelidad.bonusPedidos?.cantidad || 5} pedidos:</strong><span>+{configFidelidad.bonusPedidos?.puntos || 10} pts</span></div>
                  <div className="config-card nivel-bronce-config">🥉 Bronce: 0-200 pts (1x)</div>
                  <div className="config-card nivel-plata-config">🥈 Plata: 201-500 pts (1.5x)</div>
                  <div className="config-card nivel-oro-config">🥇 Oro: 501+ pts (2x)</div>
                </div>
              ) : <p>Cargando configuración...</p>}
            </div>
            <div className="fidelidad-seccion">
              <h3>📅 Períodos</h3>
              <div className="form-periodo">
                <input type="text" placeholder="Nombre del período" value={nuevoPeriodo.nombre} onChange={(e) => setNuevoPeriodo({...nuevoPeriodo, nombre: e.target.value})} className="input-neumo" />
                <div className="form-row">
                  <div><label>Fecha inicio:</label><input type="datetime-local" value={nuevoPeriodo.fechaInicio} onChange={(e) => setNuevoPeriodo({...nuevoPeriodo, fechaInicio: e.target.value})} className="input-neumo" /></div>
                  <div><label>Fecha cierre:</label><input type="datetime-local" value={nuevoPeriodo.fechaCierre} onChange={(e) => setNuevoPeriodo({...nuevoPeriodo, fechaCierre: e.target.value})} className="input-neumo" /></div>
                </div>
                <div className="form-row">
                  <div><label>Puntos por $100:</label><input type="number" value={nuevoPeriodo.puntosPorCienPesos} onChange={(e) => setNuevoPeriodo({...nuevoPeriodo, puntosPorCienPesos: e.target.value})} className="input-neumo" /></div>
                  <div><label>Bonus cada N pedidos:</label><input type="number" value={nuevoPeriodo.bonusCantidad} onChange={(e) => setNuevoPeriodo({...nuevoPeriodo, bonusCantidad: e.target.value})} className="input-neumo" /></div>
                  <div><label>Puntos bonus:</label><input type="number" value={nuevoPeriodo.bonusPuntos} onChange={(e) => setNuevoPeriodo({...nuevoPeriodo, bonusPuntos: e.target.value})} className="input-neumo" /></div>
                </div>
                <label className="checkbox-label"><input type="checkbox" checked={nuevoPeriodo.activo} onChange={(e) => setNuevoPeriodo({...nuevoPeriodo, activo: e.target.checked})} /><span>Período activo</span></label>
                <button onClick={guardarPeriodo} className="btn-primary">💾 Guardar Período</button>
              </div>
              {periodosFidelidad.length > 0 && (
                <div className="lista-periodos">
                  <h4>Períodos creados:</h4>
                  {periodosFidelidad.map((p) => (
                    <div key={p.id} className={`periodo-item ${p.activo ? 'activo' : ''}`}>
                      <div><strong>{p.nombre}</strong><div>{new Date(p.fechaInicio).toLocaleDateString('es-AR')} - {new Date(p.fechaCierre).toLocaleDateString('es-AR')}</div></div>
                      <button onClick={() => togglePeriodoActivo(p.id, p.activo)} className={`btn-small ${p.activo ? 'verde' : 'gris'}`}>{p.activo ? '✅ Activo' : '⏸️ Inactivo'}</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="fidelidad-seccion">
              <h3>🎁 Premios</h3>
              {!periodoActivo && <p className="aviso">⚠️ Primero creá y activá un período</p>}
              {periodoActivo && (
                <>
                  <div className="form-premio">
                    <input type="text" placeholder="Nombre del premio" value={nuevoPremio.nombre} onChange={(e) => setNuevoPremio({...nuevoPremio, nombre: e.target.value})} className="input-neumo" />
                    <textarea placeholder="Descripción" value={nuevoPremio.descripcion} onChange={(e) => setNuevoPremio({...nuevoPremio, descripcion: e.target.value})} className="input-neumo" rows="2" />
                    <div className="form-row">
                      <div><label>Puntos requeridos:</label><input type="number" value={nuevoPremio.puntosRequeridos} onChange={(e) => setNuevoPremio({...nuevoPremio, puntosRequeridos: e.target.value})} className="input-neumo" /></div>
                      <div><label>Tipo:</label><select value={nuevoPremio.tipo} onChange={(e) => setNuevoPremio({...nuevoPremio, tipo: e.target.value})} className="input-neumo"><option value="canje">Canje directo</option><option value="sorteo">Sorteo</option></select></div>
                      <div><label>Cantidad disponible:</label><input type="number" value={nuevoPremio.cantidadDisponible} onChange={(e) => setNuevoPremio({...nuevoPremio, cantidadDisponible: e.target.value})} className="input-neumo" /></div>
                    </div>
                    <button onClick={guardarPremio} className="btn-primary">🎁 Guardar Premio</button>
                  </div>
                  {premiosDisponibles.length > 0 && (
                    <div className="lista-premios">
                      <h4>Premios del período actual:</h4>
                      {premiosDisponibles.map((premio) => (
                        <div key={premio.id} className="premio-admin-item">
                          <div><strong>{premio.nombre}</strong><div>{premio.descripcion}</div><div className="premio-meta">{premio.puntosRequeridos} pts • {premio.tipo === 'canje' ? 'Canje' : 'Sorteo'} • Stock: {premio.cantidadDisponible}</div></div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="fidelidad-seccion">
              <h3>📋 Canjes Realizados ({canjesFidelidad.length})</h3>
              {canjesFidelidad.length === 0 ? <p>No hay canjes aún</p> : (
                <div className="lista-canjes">
                  {canjesFidelidad.map((canje) => (
                    <div key={canje.id} className={`canje-item ${canje.estado}`}>
                      <div><strong>{canje.clienteNombre}</strong> - {canje.clienteTelefono}<div>Premio: {canje.premioNombre} • {canje.puntosCanjeados} pts</div><div>{new Date(canje.fecha).toLocaleString('es-AR')} • Estado: {canje.estado}</div></div>
                      {canje.estado === 'pendiente' && <button onClick={() => marcarCanjeEntregado(canje.id)} className="btn-small verde">✅ Entregado</button>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tabActiva === 'reservas' && (
          <div className="panel-reservas">
            <h2 className="panel-titulo">📅 Reservas Nocturnas</h2>
          </div>
        )}
      </div>
    )
  }

  const categoriasInfo = turnoActual === 'noche' ? categoriasInfoNoche : categoriasInfoDia

  const platoEspecial = productosFirebase.find(p => {
    if (p.categoria !== 'promosNoche') return false;
    if (p.especial) return true;
    if (p.fechaInicio && p.fechaFin) {
      const ahora = new Date();
      const inicio = new Date(p.fechaInicio);
      const fin = new Date(p.fechaFin);
      fin.setHours(23, 59, 59, 999);
      return ahora >= inicio && ahora <= fin;
    }
    return false;
  }) || null;

  return (
    <div className={`app-container ${turnoActual === 'noche' ? 'tema-noche' : turnoActual === 'prevent' ? 'tema-prevent' : 'tema-dia'}`} role="application" aria-label="Aplicación de pedidos Ineva Resto-Bar">
      
      <button className="btn-modo-oscuro" onClick={toggleModoOscuro} aria-label={modoOscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'} title={modoOscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}>
        {modoOscuro ? '☀️' : '🌙'}
      </button>

      {puedeInstalar && <button className="btn-instalar-flotante" onClick={instalarPWA} aria-label="Instalar app">📲</button>}
      <button className="btn-ayuda-flotante" onClick={() => setMostrarGuia(true)} aria-label="Ayuda">❓</button>
      <button className="btn-whatsapp-flotante" onClick={abrirWhatsAppConsulta} aria-label="WhatsApp">💬</button>
      <button className="btn-redes-flotante" onClick={() => setMostrarRedes(true)} aria-label="Redes">📱</button>
      
      {telefono && <button className="btn-fidelidad-flotante" onClick={() => setMostrarFidelidad(true)} aria-label="Ver mis puntos" title="Ver programa de fidelidad">🏆</button>}

      {esAdmin && (
        <div style={{ 
          position: 'fixed', 
          top: '80px', 
          right: '20px', 
          zIndex: 10000, 
          background: 'rgba(0,0,0,0.8)', 
          padding: '10px', 
          borderRadius: '10px',
          display: 'flex',
          gap: '5px'
        }}>
          <button onClick={() => setTurnoActual('dia')} style={{ padding: '5px 10px', cursor: 'pointer', background: turnoActual === 'dia' ? '#00b894' : '#333', color: 'white', border: 'none', borderRadius: '5px' }}>☀️ Día</button>
          <button onClick={() => setTurnoActual('prevent')} style={{ padding: '5px 10px', cursor: 'pointer', background: turnoActual === 'prevent' ? '#ec4899' : '#333', color: 'white', border: 'none', borderRadius: '5px' }}>🌆 Prevent</button>
          <button onClick={() => setTurnoActual('noche')} style={{ padding: '5px 10px', cursor: 'pointer', background: turnoActual === 'noche' ? '#8b5cf6' : '#333', color: 'white', border: 'none', borderRadius: '5px' }}>🌙 Noche</button>
        </div>
      )}

      {mostrarReservas && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content modal-reservas">
            <div className="modal-header-reservas">
              <h3>📅 Reservar Mesa - Noche</h3>
              <button className="guia-cerrar" onClick={() => setMostrarReservas(false)}>✕</button>
            </div>
            <div className="reservas-form">
              <p className="reservas-info">🌙 Reservá tu mesa para la noche. Te confirmaremos por WhatsApp.</p>
              <div className="form-field"><label>👤 Nombre:</label><input type="text" value={formReserva.nombre} onChange={(e) => setFormReserva({...formReserva, nombre: e.target.value})} className="input-neumo" placeholder="Tu nombre" /></div>
              <div className="form-field"><label>📱 Teléfono:</label><input type="tel" value={formReserva.telefono} onChange={(e) => setFormReserva({...formReserva, telefono: e.target.value})} className="input-neumo" placeholder="Tu teléfono" /></div>
              <div className="form-row">
                <div className="form-field"><label>📅 Fecha:</label><input type="date" value={formReserva.fecha} onChange={(e) => setFormReserva({...formReserva, fecha: e.target.value})} className="input-neumo" /></div>
                <div className="form-field"><label>🕐 Hora:</label><input type="time" value={formReserva.hora} onChange={(e) => setFormReserva({...formReserva, hora: e.target.value})} className="input-neumo" /></div>
              </div>
              <div className="form-field"><label>👥 Personas:</label><select value={formReserva.personas} onChange={(e) => setFormReserva({...formReserva, personas: e.target.value})} className="input-neumo">
                <option value="1">1 persona</option><option value="2">2 personas</option><option value="3">3 personas</option><option value="4">4 personas</option><option value="5">5 personas</option><option value="6">6 personas</option><option value="7">7 personas</option><option value="8">8+ personas</option>
              </select></div>
              <div className="form-field"><label>💬 Mensaje (opcional):</label><textarea value={formReserva.mensaje} onChange={(e) => setFormReserva({...formReserva, mensaje: e.target.value})} className="input-neumo textarea-neumo" rows="3" placeholder="Cumpleaños, evento especial, etc." /></div>
              <div className="modal-buttons">
                <button onClick={enviarReserva} className="btn-ingresar">📅 Enviar Reserva</button>
                <button onClick={() => setMostrarReservas(false)} className="btn-cancelar">Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {mostrarGuia && (
        <div className="guia-overlay" role="dialog" aria-modal="true">
          <div className="guia-modal">
            <div className="guia-header"><h3>👋 Te ayudo a usar la app</h3><button className="guia-cerrar" onClick={saltarGuia}>✕</button></div>
            <div className="guia-content">
              <div className="guia-paso-actual"><h4>{pasosGuia[pasoActual].titulo}</h4><p>{pasosGuia[pasoActual].descripcion}</p></div>
              <div className="guia-indicador">{pasosGuia.map((_, index) => (<div key={index} className={`guia-dot ${index === pasoActual ? 'activo' : ''} ${index < pasoActual ? 'completado' : ''}`} />))}</div>
              <div className="guia-navegacion">
                <button className="btn-guia" onClick={pasoAnterior} disabled={pasoActual === 0}>← Anterior</button>
                <button className="btn-guia btn-guia-primario" onClick={siguientePaso}>{pasoActual === pasosGuia.length - 1 ? '¡Comenzar!' : 'Siguiente →'}</button>
              </div>
              <button className="btn-saltar" onClick={saltarGuia}>Saltar guía</button>
            </div>
          </div>
        </div>
      )}

      {mostrarCalificacion && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content modal-calificacion">
            <div className="calificacion-header"><div className="calificacion-icono">🎉</div><h3>¡Gracias por tu pedido!</h3><p>¿Cómo fue tu experiencia?</p></div>
            <div className="calificacion-body">
              <div className="calificacion-estrellas">{renderizarEstrellas(calificacion, 'grande', true, setCalificacionHover, setCalificacion)}</div>
              {calificacion > 0 && <p className="calificacion-texto">{obtenerTextoCalificacion(calificacion)}</p>}
              <div className="calificacion-comentario">
                <label htmlFor="comentario-calificacion">Contanos más (opcional):</label>
                <textarea id="comentario-calificacion" value={comentarioResena} onChange={(e) => setComentarioResena(e.target.value)} placeholder="¿Qué te pareció?" className="input-neumo textarea-neumo" rows="4" />
              </div>
            </div>
            <div className="modal-buttons">
              <button onClick={() => { if (calificacion > 0) { setMostrarCalificacion(false); setCalificacion(0); setComentarioResena('') } }} className="btn-ingresar" disabled={calificacion === 0}>✅ Enviar</button>
              <button onClick={() => { setMostrarCalificacion(false); setCalificacion(0); setComentarioResena('') }} className="btn-cancelar">Ahora no</button>
            </div>
          </div>
        </div>
      )}

      {mostrarFormResena && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content modal-calificacion">
            <div className="calificacion-header"><div className="calificacion-icono">✍️</div><h3>Dejá tu reseña</h3></div>
            <div className="calificacion-body">
              <div className="calificacion-estrellas">{renderizarEstrellas(calificacion, 'grande', true, setCalificacionHover, setCalificacion)}</div>
              {calificacion > 0 && <p className="calificacion-texto">{obtenerTextoCalificacion(calificacion)}</p>}
              <div className="calificacion-comentario">
                <label htmlFor="comentario-resena">Contanos tu experiencia:</label>
                <textarea id="comentario-resena" value={comentarioResena} onChange={(e) => setComentarioResena(e.target.value)} placeholder="¿Qué te pareció?" className="input-neumo textarea-neumo" rows="4" />
              </div>
            </div>
            <div className="modal-buttons">
              <button onClick={() => { setMostrarFormResena(false); setCalificacion(0); setComentarioResena('') }} className="btn-ingresar">✅ Enviar</button>
              <button onClick={() => { setMostrarFormResena(false); setCalificacion(0); setComentarioResena('') }} className="btn-cancelar">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {mostrarRedes && (
        <div className="redes-overlay" role="dialog" aria-modal="true">
          <div className="redes-modal">
            <div className="redes-header"><h3>📱 Seguinos en redes</h3><button className="redes-cerrar" onClick={() => setMostrarRedes(false)}>✕</button></div>
            <div className="redes-content">
              <div className="redes-lista">
                {Object.entries({ instagram: { nombre: 'Instagram', url: DATOS_DIA.redesSociales?.instagram || '#', seguidores: '2.4K', color: '#E4405F', gradiente: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)', icono: '📷', promocion: '🎁 10% OFF mencionando este post' }, facebook: { nombre: 'Facebook', url: DATOS_DIA.redesSociales?.facebook || '#', seguidores: '1.8K', color: '#1877F2', gradiente: 'linear-gradient(145deg, #1877F2, #0d5bbf)', icono: '👍', promocion: '🎉 Sorteo semanal' }, tiktok: { nombre: 'TikTok', url: DATOS_DIA.redesSociales?.tiktok || '#', seguidores: '5.2K', color: '#000000', gradiente: 'linear-gradient(145deg, #000000, #25F4EE)', icono: '🎵', promocion: '🎬 Videos exclusivos' } }).map(([key, red]) => (
                  <div key={key} className="redes-card" style={{ '--color-red': red.color }}>
                    <div className="redes-info"><div className="redes-icono" style={{ background: red.gradiente }}><span>{red.icono}</span></div><div className="redes-detalles"><h4>{red.nombre}</h4><div className="redes-seguidores"><span className="seguidores-numero">{red.seguidores} seguidores</span></div></div></div>
                    <div className="redes-promocion"><p>{red.promocion}</p></div>
                    <a href={red.url} target="_blank" rel="noopener noreferrer" className="btn-seguir" style={{ background: red.gradiente }}>Seguir</a>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {mostrarTerminos && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content modal-terminos">
            <div className="modal-header-terminos"><h3>📋 Términos y Condiciones</h3><button className="guia-cerrar" onClick={() => setMostrarTerminos(false)}>✕</button></div>
            <div className="terminos-content"><p>Al utilizar los servicios de {datosActuales.nombre}, aceptás los términos y condiciones.</p>
              <div className="terminos-checkbox"><label><input type="checkbox" checked={aceptoTerminos} onChange={(e) => setAceptoTerminos(e.target.checked)} /><span>He leído y acepto</span></label></div>
            </div>
            <div className="modal-buttons">
              <button onClick={() => { if (aceptoTerminos) { setMostrarTerminos(false); setError('') } else alert('❌ Debés aceptar') }} className="btn-ingresar">✅ Aceptar</button>
              <button onClick={() => setMostrarTerminos(false)} className="btn-cancelar">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {mostrarZonaDelivery && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content modal-zona">
            <div className="modal-header-terminos"><h3>🗺️ Zona de Delivery</h3><button className="guia-cerrar" onClick={() => setMostrarZonaDelivery(false)}>✕</button></div>
            <div className="zona-content">
              <div className="zona-info-card"><div className="zona-icono">📍</div><p className="zona-radio">{datosActuales.deliveryRadio} km desde el local</p></div>
              <div className="zona-costos"><div className="costo-item"><span>Costo:</span><strong>{datosActuales.deliveryTexto}</strong></div></div>
            </div>
            <div className="modal-buttons"><button onClick={() => setMostrarZonaDelivery(false)} className="btn-ingresar" style={{ flex: 1 }}>Entendido</button></div>
          </div>
        </div>
      )}

      {mostrarFidelidad && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content modal-fidelidad">
            <div className="modal-header-fidelidad"><h3>🏆 Ineva Rewards</h3><button className="guia-cerrar" onClick={() => setMostrarFidelidad(false)}>✕</button></div>
            <div className="fidelidad-content">
              {periodoActivo ? (
                <>
                  <div className="fidelidad-periodo"><h4>{periodoActivo.nombre}</h4><p>Hasta: {new Date(periodoActivo.fechaCierre).toLocaleDateString('es-AR')}</p></div>
                  {puntosCliente ? (
                    <>
                      <div className="fidelidad-puntos">
                        <div className="puntos-total"><span className="puntos-numero">{puntosCliente.totalPuntos || 0}</span><span className="puntos-label">puntos</span></div>
                        <div className={`nivel-badge nivel-${nivelCliente}`}>{nivelCliente === 'oro' ? '🥇' : nivelCliente === 'plata' ? '🥈' : '🥉'} {nivelCliente.charAt(0).toUpperCase() + nivelCliente.slice(1)}</div>
                      </div>
                      <div className="fidelidad-progreso">
                        <div className="progreso-barra"><div className="progreso-fill" style={{ width: `${Math.min((puntosCliente.totalPuntos / 500) * 100, 100)}%` }}></div></div>
                        <p>Progreso al nivel Oro: {puntosCliente.totalPuntos}/500</p>
                      </div>
                      {historialPuntos.length > 0 && (
                        <div className="fidelidad-historial">
                          <h4>📜 Historial</h4>
                          <div className="historial-lista">
                            {historialPuntos.slice(-10).reverse().map((item, index) => (
                              <div key={index} className={`historial-item ${item.tipo}`}>
                                <div className="historial-fecha">{new Date(item.fecha).toLocaleDateString('es-AR')}</div>
                                <div className="historial-detalles">{item.tipo === 'pedido' ? <>Pedido de {formatearPrecio(item.monto)}: +{item.puntos} pts{item.puntosBonus > 0 && ` +${item.puntosBonus} bonus`}</> : <>Canje: {item.premioNombre}: {item.puntos} pts</>}</div>
                                <div className="historial-total">Total: {item.totalAcumulado}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {premiosDisponibles.length > 0 && (
                        <div className="fidelidad-premios">
                          <h4>🎁 Premios Disponibles</h4>
                          <div className="premios-grid">
                            {premiosDisponibles.map((premio) => (
                              <div key={premio.id} className="premio-card">
                                <h5>{premio.nombre}</h5><p>{premio.descripcion}</p>
                                <div className="premio-puntos">{premio.puntosRequeridos} puntos</div>
                                <button className="btn-canjear" onClick={() => canjearPremio(premio)} disabled={puntosCliente.totalPuntos < premio.puntosRequeridos}>{puntosCliente.totalPuntos >= premio.puntosRequeridos ? 'Canjear' : 'Faltan puntos'}</button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : <div className="fidelidad-sin-datos"><p>📱 Ingresá tu teléfono para ver tus puntos</p></div>}
                </>
              ) : <div className="fidelidad-sin-periodo"><p>No hay períodos activos</p></div>}
            </div>
          </div>
        </div>
      )}

      {mostrarCarritoFlotante && (
        <div className="carrito-flotante" onClick={scrollToCart} role="button" aria-label={`Ver carrito, ${totalItems} items`} tabIndex={0}>
          <div className="carrito-flotante-icono">🛒<span className="carrito-badge">{totalItems}</span></div>
          <div className="carrito-flotante-info"><span className="carrito-total">{formatearPrecio(totalConEnvio)}</span><span className="carrito-texto">Ver pedido</span></div>
        </div>
      )}

      {mostrarNotificacion && (
        <div className="notification-popup" role="alert">
          <div className="notification-header"><h3>🔔 ¡Nuevo Pedido!</h3><button onClick={() => setMostrarNotificacion(null)}>✕</button></div>
          <div className="notification-content">
            <p><strong>👤 Cliente:</strong> {mostrarNotificacion.cliente?.nombre}</p>
            <p><strong>📱 Tel:</strong> {mostrarNotificacion.cliente?.telefono}</p>
            <p className="total"><strong>💰 Total:</strong> {formatearPrecio(mostrarNotificacion.total)}</p>
          </div>
          <button onClick={() => { setMostrarNotificacion(null); if (!esAdmin) setMostrarLogin(true); else setMostrarPanelAdmin(true) }} className="btn-ver-detalles">👁️ Ver Detalles</button>
        </div>
      )}

      {/* HEADER - BANNER INEVA */}
      <div className={`header ${turnoActual === 'noche' ? 'header-noche' : turnoActual === 'prevent' ? 'header-prevent' : 'header-dia'}`}>
        <div className="header-title">
          <div className="logo-circle"><span className="logo-text" translate="no">IN</span></div>
          <div>
            <h1>{datosActuales.nombre}</h1>
            <p className="subtitulo-turno">{datosActuales.subtitulo}</p>
          </div>
        </div>
      </div>

      {/* BUSCADOR - ELIMINADO TEMPORALMENTE */}

      {/* BOTONES ADMIN */}
      <div className="admin-buttons">
        {esAdmin ? (
          <div className="admin-buttons-group">
            <button onClick={() => setMostrarPanelAdmin(!mostrarPanelAdmin)} className="btn-admin-panel">{mostrarPanelAdmin ? '👁️ Ver App' : '🔧 Panel Admin'}</button>
            <button onClick={logout} className="btn-salir">🚪 Salir</button>
          </div>
        ) : <button onClick={() => setMostrarLogin(true)} className="btn-admin">👤 Admin</button>}
      </div>

      {mostrarLogin && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content">
            <h3>🔐 Acceso Administrador</h3>
            <input type="password" placeholder="Contraseña" value={passwordAdmin} onChange={(e) => setPasswordAdmin(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && verificarLogin()} className="input-neumo" />
            <div className="modal-buttons"><button onClick={verificarLogin} className="btn-ingresar">Ingresar</button><button onClick={() => setMostrarLogin(false)} className="btn-cancelar">Cancelar</button></div>
          </div>
        </div>
      )}

      {mostrarCambiarPassword && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content">
            <h3>🔑 Cambiar Contraseña</h3>
            <div className="form-field"><label>Contraseña Actual:</label><input type="password" value={passwordActual} onChange={(e) => setPasswordActual(e.target.value)} className="input-neumo" /></div>
            <div className="form-field"><label>Nueva:</label><input type="password" value={nuevaPassword} onChange={(e) => setNuevaPassword(e.target.value)} className="input-neumo" /></div>
            <div className="form-field"><label>Confirmar:</label><input type="password" value={confirmarPassword} onChange={(e) => setConfirmarPassword(e.target.value)} className="input-neumo" /></div>
            <div className="modal-buttons"><button onClick={cambiarPassword} className="btn-ingresar">✅ Cambiar</button><button onClick={() => setMostrarCambiarPassword(false)} className="btn-cancelar">Cancelar</button></div>
          </div>
        </div>
      )}

      <div className={`status-banner ${estaAbierto ? 'abierto' : 'cerrado'} ${turnoActual === 'noche' ? 'banner-noche' : ''}`} role="status">
        <div className="status-indicator"><span className={`status-dot ${estaAbierto ? 'verde' : 'rojo'}`}></span><strong>{mensajeHorario}</strong></div>
        <div className="status-timer"><span>⏱️ {tiempoRestante}</span></div>
      </div>

      <div className="time-banner">
        <p>⏱️ Tiempo estimado: <strong>20 a 40 minutos</strong></p>
        <p className="horario-info">🕐 {datosActuales.horarios}</p>
        {turnoActual === 'noche' && <p className="horario-info neon-text">🎉 Noche de Tragos & Música en Vivo</p>}
      </div>

      {!estaAbierto && turnoActual !== 'prevent' && (
        <div className="cerrado-warning" role="alert">
          <p>⚠️ <strong>El local está cerrado.</strong></p>
          <p>Podés armar tu pedido, se enviará cuando abramos.</p>
        </div>
      )}

      {turnoActual === 'prevent' && (
        <div className="prevent-banner">
          <div className="prevent-content">
            <h2>🌆 ¡Preparando la Noche!</h2>
            <p>Abrimos a las 21:00 hs con la mejor noche de tragos y música</p>
            <div className="prevent-actions">
              <button className="btn-reservar-prevent" onClick={() => setMostrarReservas(true)}>📅 Reservar Mesa</button>
              <p className="prevent-info">📞 Consultas: {DATOS_NOCHE.telefono}</p>
            </div>
          </div>
        </div>
      )}

      {esAdmin && mostrarPanelAdmin ? (
        <PanelAdministracion />
      ) : turnoActual !== 'prevent' ? (
        <>
          {turnoActual === 'noche' && platoEspecial && (
            <div className="plato-especial-banner">
              <div className="plato-especial-content">
                <div className="plato-especial-badge">⭐ PLATO ESPECIAL</div>
                <h2>{platoEspecial.nombre}</h2>
                {platoEspecial.ingredientes && <p className="plato-especial-desc">{platoEspecial.ingredientes}</p>}
                <div className="plato-especial-price">{formatearPrecio(platoEspecial.precio)}</div>
                <button className="btn-primary btn-especial-agregar" onClick={() => agregarPedido(platoEspecial)}>🛒 Agregar al Pedido</button>
              </div>
            </div>
          )}

          {turnoActual === 'noche' ? (
            <div className="menu-acordeon-container">
              {categoriasOrdenNoche.map((cat) => (
                <AcordeonCategoria 
                  key={cat.key} 
                  categoriaKey={cat.key} 
                  titulo={cat.nombre} 
                  emoji={cat.emoji} 
                  getProductosPorCategoria={getProductosPorCategoria}
                  formatearPrecio={formatearPrecio}
                  agregarPedido={agregarPedido}
                  compartirProducto={compartirProducto}
                />
              ))}
            </div>
          ) : (
            <div className="menu-acordeon-container">
              {categoriasOrdenDia.map((cat) => (
                <AcordeonCategoria 
                  key={cat.key} 
                  categoriaKey={cat.key} 
                  titulo={cat.nombre} 
                  emoji={cat.emoji} 
                  getProductosPorCategoria={getProductosPorCategoria}
                  formatearPrecio={formatearPrecio}
                  agregarPedido={agregarPedido}
                  compartirProducto={compartirProducto}
                />
              ))}
            </div>
          )}

          <div className="form-section">
            <h2>📝 Datos del Cliente</h2>
            <div className="form-group">
              <label htmlFor="nombre-completo">👤 Nombre: <span className="required">*</span></label>
              <input id="nombre-completo" type="text" className="form-input" value={nombreCompleto} onChange={(e) => { setNombreCompleto(e.target.value); setError(''); }} placeholder="Ej: Juan Pérez" />
            </div>
            <div className="form-group">
              <label htmlFor="telefono">📱 Teléfono: <span className="required">*</span></label>
              <input id="telefono" type="tel" className="form-input" value={telefono} onChange={(e) => { setTelefono(e.target.value); setError(''); }} placeholder="Ej: 3878123456" />
            </div>
            <div className="subscribe-box">
              <label><input type="checkbox" checked={suscribirMenu} onChange={(e) => setSuscribirMenu(e.target.checked)} /><div><div className="subscribe-text">📩 Suscribirse al Menú del Día</div></div></label>
            </div>
          </div>

          <div className="form-section">
            <h2>🚚 Tipo de Entrega</h2>
            <div className="delivery-buttons">
              <button className={`delivery-btn ${tipoEntrega === 'delivery' ? 'active' : ''}`} onClick={() => { setTipoEntrega('delivery'); setError(''); }}>🚚 Delivery</button>
              <button className={`delivery-btn ${tipoEntrega === 'retirar' ? 'active' : ''}`} onClick={() => { setTipoEntrega('retirar'); setError(''); }}>🏪 Retirar</button>
            </div>
            <button className="btn-ver-zona" onClick={() => setMostrarZonaDelivery(true)}>🗺️ Ver zona de delivery</button>
            
            {tipoEntrega === 'delivery' && turnoActual === 'noche' && (
              <div className="delivery-noche-info">
                <p>📍 <strong>Delivery Nocturno:</strong> {datosActuales.deliveryTexto}</p>
                <p>💬 Para conocer el precio exacto según tu zona, consultanos por WhatsApp después de enviar tu pedido.</p>
              </div>
            )}
            
            {tipoEntrega === 'delivery' && turnoActual !== 'noche' && (
              <div className="address-wrapper">
                <label htmlFor="direccion">🏠 Dirección: <span className="required">*</span></label>
                <div className="address-container">
                  <input id="direccion" type="text" className="form-input" value={direccion} onChange={(e) => { setDireccion(e.target.value); setError(''); setDireccionValida(null) }} placeholder="Calle y número" />
                  <button className="btn-location" onClick={() => { if (navigator.geolocation) navigator.geolocation.getCurrentPosition((pos) => { setDireccion(`https://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`); setError('') }, () => alert('❌ No se pudo obtener la ubicación')) }}>📍</button>
                </div>
                {direccionValida === true && <div className="zona-valida">✅ Dirección válida</div>}
                {direccionValida === false && <div className="zona-invalida">❌ Fuera de zona</div>}
              </div>
            )}
          </div>

          <div className="cart-section" id="cart-section">
            <h2>🛒 Pedidos ({totalItems} items)</h2>
            {pedidos.length === 0 ? <div className="empty-cart">No hay pedidos aún</div> : (
              <div className="cart-container">
                {pedidos.map((pedido) => (
                  <div key={pedido.id} className="cart-item">
                    <div className="cart-item-header">
                      <div className="cart-item-info"><strong>{pedido.nombre}</strong><div className="unit-price">{formatearPrecio(pedido.precio)} c/u</div></div>
                      <div className="cart-item-controls">
                        <button className="btn-quantity minus" onClick={() => disminuirCantidad(pedido.id)}>-</button>
                        <span className="cart-item-quantity">{pedido.cantidad}</span>
                        <button className="btn-quantity plus" onClick={() => aumentarCantidad(pedido.id)}>+</button>
                        <button className="btn-delete" onClick={() => eliminarItem(pedido.id)}>🗑️</button>
                      </div>
                      <div className="cart-item-total">{formatearPrecio(pedido.precio * pedido.cantidad)}</div>
                    </div>
                    <input type="text" className="cart-item-note" value={notasPorProducto[pedido.id] || ''} onChange={(e) => actualizarNota(pedido.id, e.target.value)} placeholder="📝 Nota" />
                  </div>
                ))}
                <div className="resumen-pedido">
                  <div className="resumen-item"><span>Subtotal:</span><span>{formatearPrecio(total)}</span></div>
                  <div className="resumen-item total"><span>TOTAL:</span><span>{formatearPrecio(totalConEnvio)}</span></div>
                </div>
                <div className="terminos-pedido">
                  <label><input type="checkbox" checked={aceptoTerminos} onChange={(e) => setAceptoTerminos(e.target.checked)} /><span>Acepto los <button className="btn-link-terminos" onClick={() => setMostrarTerminos(true)}>Términos y Condiciones</button></span></label>
                </div>
                <div className="transfer-section">
                  <h3>💳 PAGO POR TRANSFERENCIA</h3>
                  <div className="alias-container">
                    <input type="text" className="alias-input" value="silvia.ge.nes" readOnly />
                    <button className="btn-copy" onClick={copiarAlias}>📋 Copiar</button>
                  </div>
                </div>
                {error && <div className="error-message">{error}</div>}
                <div className="cart-footer">
                  <div className="total-amount">Total: <span>{formatearPrecio(totalConEnvio)}</span></div>
                  <button className="btn-whatsapp" onClick={enviarPorWhatsApp} disabled={cargando}>{cargando ? '⏳ Enviando...' : '📱 Enviar Pedido'}</button>
                </div>
              </div>
            )}
          </div>

          <div className="seccion-resenas">
            <div className="resenas-header"><h2>⭐ Lo que dicen nuestros clientes</h2></div>
            <div className="resenas-resumen">
              <div className="resumen-promedio">
                <div className="promedio-numero">{promedioResenas || '0.0'}</div>
                <div className="promedio-estrellas">{renderizarEstrellas(Math.round(promedioResenas), 'pequeno')}</div>
                <div className="promedio-texto">{obtenerTextoCalificacion(parseFloat(promedioResenas))}</div>
                <div className="promedio-total">{totalResenas} reseñas</div>
              </div>
              <button className="btn-escribir-resena" onClick={() => setMostrarFormResena(true)}>✍️ Escribir una reseña</button>
            </div>
          </div>

          <div className="seccion-contacto">
            <h2>📞 Contacto</h2>
            <div className="contacto-grid">
              <div className="contacto-card"><div className="contacto-icono">📍</div><h3>Dirección</h3><p>{datosActuales.direccion}</p><button className="btn-contacto" onClick={abrirGoogleMaps}>🗺️ Ver</button></div>
              
              <div className="contacto-card">
                <div className="contacto-icono">📞</div>
                <h3>Teléfonos</h3>
                <p><strong>Cel/WhatsApp:</strong> {datosActuales.telefono}</p>
                {datosActuales.telefonoFijo && (
                  <p><strong>Fijo:</strong> {datosActuales.telefonoFijo}</p>
                )}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button className="btn-contacto" onClick={llamarTelefono}>📱 Llamar Cel</button>
                  {datosActuales.telefonoFijo && (
                    <button className="btn-contacto" onClick={() => window.location.href = `tel:${datosActuales.telefonoFijo}`}>☎️ Llamar Fijo</button>
                  )}
                </div>
              </div>

              <div className="contacto-card"><div className="contacto-icono">🕐</div><h3>Horarios</h3><p>{datosActuales.horarios}</p></div>
            </div>
          </div>

          <footer className="footer-app">
            <div className="footer-content">
              <div className="footer-info"><h4>{datosActuales.nombre}</h4><p>📍 {datosActuales.direccion}</p><p>📞 {datosActuales.telefono}</p></div>
              <div className="footer-legal">
                <h4>Legal</h4>
                <button className="btn-footer-link" onClick={() => setMostrarTerminos(true)}>📋 Términos</button>
                <p className="footer-copy">© 2026 {datosActuales.nombre}</p>
              </div>
            </div>
          </footer>
        </>
      ) : null}
    </div>
  )
}

export default App