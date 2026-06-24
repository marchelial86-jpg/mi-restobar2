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
    horarios: 'Todos los Días de 09:00 a 16:00 hs',
    deliveryCosto: 0,
    deliveryRadio: 5,
    deliveryTexto: 'Delivery GRATIS',
    subtitulo: 'Dos Mundos Un Solo Lugar'
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

  // ============================================
  // 📋 CATEGORÍAS - TURNO DÍA (SOLO FIREBASE)
  // ============================================
  const categoriasInfoDia = {
    promosDia: { nombre: 'Promos Día', emoji: '🔥', color: '#FF0000' },
    menuDelDia: { nombre: 'Menú del Día', emoji: '📋', color: '#6c5ce7' },
    comidasFijas: { nombre: 'Comidas Fijas', emoji: '🍽️', color: '#00b894' },
    pizzas: { nombre: 'Pizzas', emoji: '🍕', color: '#e17055' },
    empanadas: { nombre: 'Empanadas', emoji: '🥟', color: '#fdcb6e' },
    desayunos: { nombre: 'Desayunos', emoji: '🥐', color: '#a29bfe' },
    bebidas: { nombre: 'Bebidas', emoji: '🥤', color: '#00cec9' }
  }

  // ============================================
  // 📋 CATEGORÍAS - TURNO NOCHE (SOLO FIREBASE)
  // ============================================
  const categoriasInfoNoche = {
    promosNoche: { nombre: 'Promos Noche', emoji: '🔥', color: '#FF0000' },
    cocteles: { nombre: 'Cócteles Clásicos', emoji: '🍹', color: '#EC4899' },
    ginTonic: { nombre: 'Gin Tonic', emoji: '🍸', color: '#06B6D4' },
    medidas: { nombre: 'Medidas', emoji: '🥃', color: '#F59E0B' },
    jarras: { nombre: 'Jarras', emoji: '🍺', color: '#8B5CF6' },
    whiskys: { nombre: 'Whiskys', emoji: '🥃', color: '#D97706' },
    tequilas: { nombre: 'Tequilas & Shots', emoji: '🌵', color: '#10B981' },
    cervezas: { nombre: 'Cervezas', emoji: '🍻', color: '#F59E0B' },
    vinos: { nombre: 'Vinos', emoji: '🍷', color: '#7C3AED' },
    espumantes: { nombre: 'Espumantes', emoji: '🥂', color: '#EC4899' },
    sinAlcohol: { nombre: 'Sin Alcohol', emoji: '🧃', color: '#06B6D4' },
    pizzas: { nombre: 'Pizzas', emoji: '🍕', color: '#EF4444' },
    empanadas: { nombre: 'Empanadas', emoji: '🥟', color: '#F59E0B' },
    minutas: { nombre: 'Minutas', emoji: '🥪', color: '#10B981' },
    extras: { nombre: 'Extras', emoji: '🍟', color: '#F97316' }
  }

  const categoriasOrdenNoche = [
    { key: 'promosNoche', nombre: '🔥 Promos Noche', emoji: '🔥' },
    { key: 'cocteles', nombre: 'Cócteles Clásicos', emoji: '🍹' },
    { key: 'ginTonic', nombre: 'Gin Tonic', emoji: '🍸' },
    { key: 'medidas', nombre: 'Medidas', emoji: '🥃' },
    { key: 'jarras', nombre: 'Jarras', emoji: '🍺' },
    { key: 'whiskys', nombre: 'Whiskys', emoji: '🥃' },
    { key: 'tequilas', nombre: 'Tequila & Shots', emoji: '🌵' },
    { key: 'cervezas', nombre: 'Cervezas', emoji: '🍻' },
    { key: 'vinos', nombre: 'Vinos', emoji: '🍷' },
    { key: 'espumantes', nombre: 'Espumantes', emoji: '🥂' },
    { key: 'sinAlcohol', nombre: 'Sin Alcohol', emoji: '🧃' },
    { key: 'pizzas', nombre: 'Pizzas', emoji: '🍕' },
    { key: 'empanadas', nombre: 'Empanadas', emoji: '🥟' },
    { key: 'minutas', nombre: 'Minutas', emoji: '🥪' },
    { key: 'extras', nombre: 'Extras', emoji: '🍟' }
  ];

  const categoriasOrdenDia = [
    { key: 'promosDia', nombre: '🔥 Promos Día', emoji: '🔥' },
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
      const cierreDia = 16 * 60
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

  // ============================================
  // 🍔 CARGAR PRODUCTOS DESDE FIREBASE
  // ============================================
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

  // ============================================
  // 📲 PWA - MEJORADO PARA INSTALACIÓN
  // ============================================
  useEffect(() => {
    const manejarPrompt = (evento) => { 
      evento.preventDefault(); 
      setPuedeInstalar(true); 
      window.deferredPrompt = evento;
      console.log('📲 PWA Install prompt disponible!');
    }
    window.addEventListener('beforeinstallprompt', manejarPrompt)
    
    // Detectar cuando la app se instala
    window.addEventListener('appinstalled', () => {
      console.log('✅ PWA instalada correctamente');
      setPuedeInstalar(false);
    });
    
    return () => {
      window.removeEventListener('beforeinstallprompt', manejarPrompt)
    }
  }, [])

  const instalarPWA = () => {
    if (window.deferredPrompt) {
      window.deferredPrompt.prompt()
      window.deferredPrompt.userChoice.then((choiceResult) => {
        console.log('📲 Resultado instalación:', choiceResult.outcome);
        if (choiceResult.outcome === 'accepted') {
          console.log('✅ Usuario aceptó la instalación');
        } else {
          console.log('❌ Usuario rechazó la instalación');
        }
        setPuedeInstalar(false);
        window.deferredPrompt = null;
      })
    } else {
      console.log('⚠️ No hay prompt disponible.');
      // Instrucciones manuales según el dispositivo
      const esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      if (esIOS) {
        alert('📱 Para instalar en iPhone:\n\n1. Tocá el botón Compartir (cuadrado con flecha)\n2. Seleccioná "Agregar a pantalla principal"\n3. Confirmá');
      } else {
        alert('📱 Para instalar:\n\n1. Tocá los 3 puntos (⋮) de Chrome\n2. Seleccioná "Instalar aplicación"\n3. Confirmá');
      }
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

  // ============================================
  // 🍔 OBTENER PRODUCTOS POR CATEGORÍA (SOLO FIREBASE - SIN HARDCODED)
  // ============================================
  const getProductosPorCategoria = (categoria) => {
    const productosFiltrados = productosFirebase.filter(p => {
      const turnoProducto = p.turno || 'ambos'
      return p.categoria === categoria && (turnoProducto === turnoActual || turnoProducto === 'ambos')
    })
    return productosFiltrados.sort((a, b) => (a.orden || 999) - (b.orden || 999))
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
      const menuDelDiaTexto = `🍔 *MENÚ DEL DÍA - INEVA RESTO-BAR* 🍔\n📅 ${fechaHoy.toUpperCase()}\n\n¡Te esperamos! 🎉`
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

  // ============================================
  // 🔧 AGREGAR PRODUCTO
  // ============================================
  const agregarProducto = async (producto) => {
    try {
      await addDoc(collection(db, 'productos'), { 
        ...producto, 
        disponible: true, 
        fechaCreacion: new Date().toISOString() 
      })
      alert('✅ Producto agregado')
      await recargarProductos()
    } catch (error) { 
      alert('❌ Error al agregar producto') 
    }
  }

  // ============================================
  // ✏️ EDITAR PRODUCTO
  // ============================================
  const editarProducto = async (id, datosActualizados) => {
    try {
      const producto = productosFirebase.find(p => p.id === id || p.firestoreId === id)
      const firestoreId = producto?.firestoreId || id
      await setDoc(doc(db, 'productos', firestoreId), datosActualizados, { merge: true })
      setProductosFirebase(prev => prev.map(p => (p.id === id || p.firestoreId === id) ? { ...p, ...datosActualizados } : p))
      alert('✅ Producto actualizado')
    } catch (error) { 
      alert('❌ Error: ' + error.message) 
    }
  }

  // ============================================
  // 🗑️ ELIMINAR PRODUCTO
  // ============================================
  const eliminarProducto = async (id) => {
    if (!window.confirm('¿Eliminar este producto?')) return
    try {
      const producto = productosFirebase.find(p => p.id === id || p.firestoreId === id)
      const firestoreId = producto?.firestoreId || id
      await deleteDoc(doc(db, 'productos', firestoreId))
      setProductosFirebase(prev => prev.filter(p => p.id !== id && p.firestoreId !== id))
      alert('✅ Producto eliminado')
    } catch (error) { 
      alert('❌ Error: ' + error.message) 
    }
  }

  // ============================================
  // ✅ TOGGLE DISPONIBILIDAD
  // ============================================
  const toggleDisponibilidad = async (id) => {
    try {
      const producto = productosFirebase.find(p => p.id === id || p.firestoreId === id)
      const firestoreId = producto?.firestoreId || id
      const nuevaDisponibilidad = !producto.disponible
      await setDoc(doc(db, 'productos', firestoreId), { disponible: nuevaDisponibilidad }, { merge: true })
      setProductosFirebase(prev => prev.map(p => (p.id === id || p.firestoreId === id) ? { ...p, disponible: nuevaDisponibilidad } : p))
      alert(nuevaDisponibilidad ? '✅ Producto marcado como DISPONIBLE' : '🔴 Producto marcado como AGOTADO')
    } catch (error) { 
      alert('❌ Error: ' + error.message) 
    }
  }

  // ============================================
  // 🔄 CAMBIAR TURNO PRODUCTO
  // ============================================
  const cambiarTurnoProducto = async (id, nuevoTurno) => {
    try {
      const producto = productosFirebase.find(p => p.id === id || p.firestoreId === id)
      const firestoreId = producto?.firestoreId || id
      await setDoc(doc(db, 'productos', firestoreId), { turno: nuevoTurno }, { merge: true })
      setProductosFirebase(prev => prev.map(p => (p.id === id || p.firestoreId === id) ? { ...p, turno: nuevoTurno } : p))
      const iconos = { dia: '☀️', noche: '🌙', ambos: '🔄' }
      alert(`✅ Turno cambiado a: ${iconos[nuevoTurno]} ${nuevoTurno.toUpperCase()}`)
    } catch (error) {
      alert('❌ Error: ' + error.message)
    }
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

  // ============================================
  // 🔧 PANEL DE ADMINISTRACIÓN
  // ============================================
  const PanelAdministracion = () => {
    const [nuevoProducto, setNuevoProducto] = useState({ nombre: '', precio: '', categoria: 'menuDelDia', turno: 'dia', orden: '', imagenes: '' })
    const [tabActiva, setTabActiva] = useState('productosDia')
    
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
      setNuevoProducto({ nombre: '', precio: '', categoria: 'menuDelDia', turno: nuevoProducto.turno, orden: '', imagenes: '' })
    }

    // Filtrar productos por turno
    const productosDia = productosFirebase.filter(p => p.turno === 'dia')
    const productosNoche = productosFirebase.filter(p => p.turno === 'noche')
    
    return (
      <div className="panel-admin-container" role="main" aria-label="Panel de administración">
        <div className="admin-tabs">
          <button className={`admin-tab ${tabActiva === 'pedidos' ? 'activa' : ''}`} onClick={() => setTabActiva('pedidos')}>📋 Pedidos</button>
          <button className={`admin-tab ${tabActiva === 'productosDia' ? 'activa' : ''}`} onClick={() => setTabActiva('productosDia')}>☀️ Productos Día</button>
          <button className={`admin-tab ${tabActiva === 'productosNoche' ? 'activa' : ''}`} onClick={() => setTabActiva('productosNoche')}>🌙 Productos Noche</button>
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

        {/* ============================================ */}
        {/* PRODUCTOS DÍA */}
        {/* ============================================ */}
        {tabActiva === 'productosDia' && (
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
            
            <h2 className="panel-titulo">☀️ Agregar Producto - Turno Día</h2>
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
                <option value="promosDia">🔥 Promos Día</option>
                <option value="menuDelDia">📋 Menú del Día</option>
                <option value="comidasFijas">🍽️ Comidas Fijas</option>
                <option value="pizzas">🍕 Pizzas</option>
                <option value="empanadas">🥟 Empanadas</option>
                <option value="desayunos">🥐 Desayunos</option>
                <option value="bebidas">🥤 Bebidas</option>
              </select>
              <input type="hidden" value="dia" />
              <button type="submit" className="btn-primary">➕ Agregar</button>
            </form>
            
            <div style={{ 
              marginBottom: '1rem', 
              padding: '1rem', 
              background: 'rgba(0, 184, 148, 0.2)',
              borderRadius: '10px',
              border: '2px solid #00b894',
              textAlign: 'center'
            }}>
              <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#00b894' }}>
                ☀️ Turno Día
              </span>
              <span style={{ marginLeft: '10px', color: '#94a3b8' }}>
                ({productosDia.length} productos)
              </span>
            </div>

            <h3>📋 Productos Día ({productosDia.length})</h3>
            
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
              <button onClick={recargarProductos} className="btn-primary" style={{ margin: 0 }}>
                🔄 Recargar Productos
              </button>
              <span style={{ color: '#00b894', fontWeight: 'bold' }}>
                {productosFirebase.length} productos totales
              </span>
            </div>
            
            {productosDia.length === 0 ? (
              <div className="sin-productos">
                <p>⚠️ No hay productos de día</p>
                <p style={{ fontSize: '0.9rem', color: '#888' }}>
                  Agregá tu primer producto con el formulario de arriba
                </p>
              </div>
            ) : (
              <div className="productos-admin-grid">
                {productosDia
                  .sort((a, b) => {
                    const ordenCategorias = {
                      'promosDia': 1, 'menuDelDia': 2, 'comidasFijas': 3, 'pizzas': 4, 'empanadas': 5,
                      'desayunos': 6, 'bebidas': 7
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
                            📂 {prod.categoria || 'sin categoría'}
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
                              const imgs = prompt('URLs de imágenes (separadas por coma):', prod.imagenes || ''); 
                              if (imgs !== null) editarProducto(productId, { imagenes: imgs.trim() }) 
                            }} 
                            className={`btn-small ${tieneFotos ? 'naranja' : 'gris'}`}
                          >
                            📷 Fotos
                          </button>
                          <button 
                            onClick={() => toggleDisponibilidad(productId)} 
                            className={`btn-small ${prod.disponible !== false ? 'verde' : 'rojo'}`}
                          >
                            {prod.disponible !== false ? '✅ Disponible' : '🔴 Agotado'}
                          </button>
                          <button 
                            onClick={() => cambiarTurnoProducto(productId, 'noche')} 
                            className="btn-small purpura"
                          >
                            🌙 Mover a Noche
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

        {/* ============================================ */}
        {/* PRODUCTOS NOCHE */}
        {/* ============================================ */}
        {tabActiva === 'productosNoche' && (
          <>
            <div className="botones-seguridad">
              <button onClick={() => setMostrarCambiarPassword(true)} className="btn-seguridad verde">
                🔑 Cambiar Contraseña
              </button>
            </div>
            
            <h2 className="panel-titulo">🌙 Agregar Producto - Turno Noche</h2>
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
                <option value="promosNoche">🔥 Promos Noche</option>
                <option value="cocteles">🍹 Cócteles Clásicos</option>
                <option value="ginTonic">🍸 Gin Tonic</option>
                <option value="medidas">🥃 Medidas</option>
                <option value="jarras">🍺 Jarras</option>
                <option value="whiskys">🥃 Whiskys</option>
                <option value="tequilas">🌵 Tequilas & Shots</option>
                <option value="cervezas">🍻 Cervezas</option>
                <option value="vinos">🍷 Vinos</option>
                <option value="espumantes">🥂 Espumantes</option>
                <option value="sinAlcohol">🧃 Sin Alcohol</option>
                <option value="pizzas">🍕 Pizzas</option>
                <option value="empanadas">🥟 Empanadas</option>
                <option value="minutas">🥪 Minutas</option>
                <option value="extras">🍟 Extras</option>
              </select>
              <input type="hidden" value="noche" />
              <button type="submit" className="btn-primary">➕ Agregar</button>
            </form>
            
            <div style={{ 
              marginBottom: '1rem', 
              padding: '1rem', 
              background: 'rgba(139, 92, 246, 0.2)',
              borderRadius: '10px',
              border: '2px solid #8b5cf6',
              textAlign: 'center'
            }}>
              <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#a78bfa' }}>
                🌙 Turno Noche
              </span>
              <span style={{ marginLeft: '10px', color: '#94a3b8' }}>
                ({productosNoche.length} productos)
              </span>
            </div>

            <h3>📋 Productos Noche ({productosNoche.length})</h3>
            
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
              <button onClick={recargarProductos} className="btn-primary" style={{ margin: 0 }}>
                🔄 Recargar Productos
              </button>
              <span style={{ color: '#00b894', fontWeight: 'bold' }}>
                {productosFirebase.length} productos totales
              </span>
            </div>
            
            {productosNoche.length === 0 ? (
              <div className="sin-productos">
                <p>⚠️ No hay productos de noche</p>
                <p style={{ fontSize: '0.9rem', color: '#888' }}>
                  Agregá tu primer producto con el formulario de arriba
                </p>
              </div>
            ) : (
              <div className="productos-admin-grid">
                {productosNoche
                  .sort((a, b) => {
                    const ordenCategorias = {
                      'promosNoche': 1, 'cocteles': 2, 'ginTonic': 3, 'medidas': 4, 'jarras': 5,
                      'whiskys': 6, 'tequilas': 7, 'cervezas': 8, 'vinos': 9, 'espumantes': 10,
                      'sinAlcohol': 11, 'pizzas': 12, 'empanadas': 13, 'minutas': 14, 'extras': 15
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
                            📂 {prod.categoria || 'sin categoría'}
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
                              const imgs = prompt('URLs de imágenes (separadas por coma):', prod.imagenes || ''); 
                              if (imgs !== null) editarProducto(productId, { imagenes: imgs.trim() }) 
                            }} 
                            className={`btn-small ${tieneFotos ? 'naranja' : 'gris'}`}
                          >
                            📷 Fotos
                          </button>
                          <button 
                            onClick={() => toggleDisponibilidad(productId)} 
                            className={`btn-small ${prod.disponible !== false ? 'verde' : 'rojo'}`}
                          >
                            {prod.disponible !== false ? '✅ Disponible' : '🔴 Agotado'}
                          </button>
                          <button 
                            onClick={() => cambiarTurnoProducto(productId, 'dia')} 
                            className="btn-small verde"
                          >
                            ☀️ Mover a Día
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
    if (p.categoria !== 'promosNoche' && p.categoria !== 'promosDia') return false;
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

      {/* 📲 BOTÓN DE INSTALACIÓN PWA MEJORADO */}
      {puedeInstalar && (
        <button 
          onClick={instalarPWA} 
          aria-label="Instalar app"
          style={{
            position: 'fixed',
            bottom: '100px',
            right: '20px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '50px',
            padding: '16px 28px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            zIndex: 9999,
            boxShadow: '0 10px 30px rgba(102, 126, 234, 0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            animation: 'pulse 2s infinite'
          }}
        >
          📲 Instalar App
        </button>
      )}

      {/* Animación CSS para el botón */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
      `}</style>

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

      {/* 🎨 HEADER MEJORADO CON COLORES VIBRANTES */}
    <div className="header" style={{
  background: 'transparent',
  backgroundImage: 'url(/fachada-ineva.jpg)',
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
  filter: 'none'
}}>
        <div className="header-title">
          <div className="logo-circle" 
            style={{
              width: '80px',
              height: '80px',
              background: 'linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 25px rgba(0,0,0,0.3)',
              marginBottom: '15px'
            }}
          >
            <span className="logo-text" 
              style={{
                fontSize: '32px',
                fontWeight: 'bold',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}
            >
              IN
            </span>
          </div>
          <div>
            <h1 style={{
              fontSize: '42px',
              fontWeight: 'bold',
              color: 'white',
              margin: '0 0 8px 0',
              textShadow: '0 2px 10px rgba(0,0,0,0.2)'
            }}>
              {datosActuales.nombre}
            </h1>
            <p className="subtitulo-turno" 
              style={{
                fontSize: '18px',
                color: 'rgba(255,255,255,0.95)',
                margin: '0',
                fontWeight: '500'
              }}
            >
              {datosActuales.subtitulo}
            </p>
          </div>
        </div>
      </div>

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

      <div 
  className={`status-banner ${estaAbierto ? 'abierto' : 'cerrado'} ${turnoActual === 'noche' ? 'banner-noche' : ''}`} 
  role="status"
  style={{
    color: (turnoActual === 'noche' || turnoActual === 'prevent') ? '#ffffff' : '#333333',
    fontWeight: 'bold',
    textShadow: turnoActual === 'noche' || turnoActual === 'prevent' ? '0 1px 3px rgba(0,0,0,0.5)' : 'none'
  }}
>
  style={{
    color: (turnoActual === 'noche' || turnoActual === 'prevent') ? '#ffffff' : '#333333',
    fontWeight: 'bold'
  }}
>
        <div className="status-indicator">
  <span className={`status-dot ${estaAbierto ? 'verde' : 'rojo'}`}></span>
  <strong style={{ color: (turnoActual === 'noche' || turnoActual === 'prevent') ? '#ffffff' : '#333333' }}>{mensajeHorario}</strong>
</div>
        <div className="status-timer" style={{ color: (turnoActual === 'noche' || turnoActual === 'prevent') ? '#ffffff' : '#333333' }}>
  <span>⏱️ {tiempoRestante}</span>
</div>
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