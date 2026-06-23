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

  // ============================================
  // 📋 CATEGORÍAS DISPONIBLES (SOLO DEFINICIONES)
  // ============================================
  const categoriasDisponibles = {
    dia: {
      promosDia: { nombre: 'Promos Día', emoji: '🔥' },
      menuDelDia: { nombre: 'Menú del Día', emoji: '📋' },
      comidasFijas: { nombre: 'Comidas Fijas', emoji: '🍽️' },
      pizzas: { nombre: 'Pizzas', emoji: '🍕' },
      empanadas: { nombre: 'Empanadas', emoji: '🥟' },
      desayunos: { nombre: 'Desayunos', emoji: '🥐' },
      bebidas: { nombre: 'Bebidas', emoji: '🥤' }
    },
    noche: {
      promosNoche: { nombre: 'Promos Noche', emoji: '🔥' },
      cocteles: { nombre: 'Cócteles Clásicos', emoji: '🍹' },
      ginTonic: { nombre: 'Gin Tonic', emoji: '🍸' },
      medidas: { nombre: 'Medidas', emoji: '🥃' },
      jarras: { nombre: 'Jarras', emoji: '🍺' },
      whiskys: { nombre: 'Whiskys', emoji: '🥃' },
      tequilas: { nombre: 'Tequilas & Shots', emoji: '🌵' },
      cervezas: { nombre: 'Cervezas', emoji: '🍻' },
      vinos: { nombre: 'Vinos', emoji: '🍷' },
      espumantes: { nombre: 'Espumantes', emoji: '🥂' },
      sinAlcohol: { nombre: 'Sin Alcohol', emoji: '🧃' },
      pizzas: { nombre: 'Pizzas', emoji: '🍕' },
      empanadas: { nombre: 'Empanadas', emoji: '🥟' },
      minutas: { nombre: 'Minutas', emoji: '🥪' },
      extras: { nombre: 'Extras', emoji: '🍟' }
    }
  }

  const categoriasOrdenDia = [
    { key: 'promosDia', nombre: '🔥 Promos Día', emoji: '🔥' },
    { key: 'menuDelDia', nombre: 'Menú del Día', emoji: '📋' },
    { key: 'comidasFijas', nombre: 'Comidas Fijas', emoji: '🍽️' },
    { key: 'pizzas', nombre: 'Pizzas', emoji: '🍕' },
    { key: 'empanadas', nombre: 'Empanadas', emoji: '🥟' },
    { key: 'desayunos', nombre: 'Desayunos', emoji: '🥐' },
    { key: 'bebidas', nombre: 'Bebidas', emoji: '🥤' }
  ];

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

  // ============================================
  // 🍔 OBTENER PRODUCTOS POR CATEGORÍA (SOLO FIREBASE - SIN HARDCODED)
  // ============================================
  const getProductosPorCategoria = (categoria) => {
    const productosFiltrados = productosFirebase.filter(p => {
      return p.categoria === categoria && p.turno === turnoActual
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
  // 🔧 FUNCIONES CRUD DE PRODUCTOS
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

  const cambiarTurnoProducto = async (id, nuevoTurno) => {
    try {
      const producto = productosFirebase.find(p => p.id === id || p.firestoreId === id)
      const firestoreId = producto?.firestoreId || id
      await setDoc(doc(db, 'productos', firestoreId), { turno: nuevoTurno }, { merge: true })
      setProductosFirebase(prev => prev.map(p => (p.id === id || p.firestoreId === id) ? { ...p, turno: nuevoTurno } : p))
      const iconos = { dia: '☀️', noche: '🌙' }
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
    const todasCategorias = turnoActual === 'noche' ? categoriasDisponibles.noche : categoriasDisponibles.dia
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

        {/* ============================================ */}
        {/* PRODUCTOS DÍA */}
        {/* ============================================ */}
        {tabActiva === 'productosDia' && (
          <>
            <h2 className="panel-titulo">☀️ Agregar Producto - Turno Día</h2>
            <form onSubmit={handleSubmit} className="form-producto">
              <input type="text" placeholder="Nombre" value={nuevoProducto.nombre} onChange={(e) => setNuevoProducto({...nuevoProducto, nombre: e.target.value})} className="input-neumo" required />
              <input type="number" placeholder="Precio" value={nuevoProducto.precio} onChange={(e) => setNuevoProducto({...nuevoProducto, precio: e.target.value})} className="input-neumo" required />
              <textarea placeholder="📷 URLs de imágenes (separadas por coma)" value={nuevoProducto.imagenes || ''} onChange={(e) => setNuevoProducto({...nuevoProducto, imagenes: e.target.value})} className="input-neumo textarea-neumo" rows="2" />
              <select value={nuevoProducto.categoria} onChange={(e) => setNuevoProducto({...nuevoProducto, categoria: e.target.value})} className="input-neumo">
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
            
            <div style={{ marginBottom: '1rem', padding: '1rem', background: 'rgba(0, 184, 148, 0.2)', borderRadius: '10px', border: '2px solid #00b894', textAlign: 'center' }}>
              <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#00b894' }}>☀️ Turno Día</span>
              <span style={{ marginLeft: '10px', color: '#94a3b8' }}>({productosDia.length} productos)</span>
            </div>

            <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <button onClick={recargarProductos} className="btn-primary" style={{ margin: 0 }}>🔄 Recargar Productos</button>
              <span style={{ color: '#00b894', fontWeight: 'bold' }}>{productosFirebase.length} productos totales</span>
            </div>
            
            {productosDia.length === 0 ? (
              <div className="sin-productos">
                <p>⚠️ No hay productos de día</p>
                <p style={{ fontSize: '0.9rem', color: '#888' }}>Agregá tu primer producto con el formulario de arriba</p>
              </div>
            ) : (
              <div className="productos-admin-grid">
                {productosDia.sort((a, b) => {
                  const ordenCategorias = { 'promosDia': 1, 'menuDelDia': 2, 'comidasFijas': 3, 'pizzas': 4, 'empanadas': 5, 'desayunos': 6, 'bebidas': 7 }
                  const ordenA = ordenCategorias[a.categoria] || 999
                  const ordenB = ordenCategorias[b.categoria] || 999
                  if (ordenA !== ordenB) return ordenA - ordenB
                  return Number(a.orden || 999) - Number(b.orden || 999)
                }).map((prod) => {
                  const productId = prod.firestoreId || prod.id;
                  const tieneFotos = prod.imagenes && prod.imagenes.toString().trim().length > 0;
                  
                  return (
                    <div key={productId} className="producto-admin-card">
                      <div className="producto-admin-info">
                        <strong>{prod.nombre || 'Sin nombre'}</strong>
                        <div className="precio">${prod.precio ? Number(prod.precio).toLocaleString('es-AR') : '0'}</div>
                        <div className="meta">📂 {prod.categoria || 'sin categoría'}</div>
                        {tieneFotos && <div className="meta" style={{ color: '#00b894', marginTop: '0.25rem' }}>📷 Tiene fotos</div>}
                      </div>
                      <div className="producto-admin-botones">
                        <button onClick={() => { const n = prompt('Nuevo nombre:', prod.nombre); if (n && n.trim()) editarProducto(productId, { nombre: n.trim() }) }} className="btn-small azul">✏️ Nombre</button>
                        <button onClick={() => { const p = prompt('Nuevo precio:', prod.precio); if (p && !isNaN(Number(p))) editarProducto(productId, { precio: Number(p) }) }} className="btn-small verde">💰 Precio</button>
                        <button onClick={() => { const c = prompt('Nueva categoría:', prod.categoria); if (c && c.trim()) editarProducto(productId, { categoria: c.trim() }) }} className="btn-small purpura">📂 Categoría</button>
                        <button onClick={() => { const imgs = prompt('URLs de imágenes (separadas por coma):', prod.imagenes || ''); if (imgs !== null) editarProducto(productId, { imagenes: imgs.trim() }) }} className={`btn-small ${tieneFotos ? 'naranja' : 'gris'}`}>📷 Fotos</button>
                        <button onClick={() => toggleDisponibilidad(productId)} className={`btn-small ${prod.disponible !== false ? 'verde' : 'rojo'}`}>{prod.disponible !== false ? '✅ Disponible' : '🔴 Agotado'}</button>
                        <button onClick={() => cambiarTurnoProducto(productId, 'noche')} className="btn-small purpura">🌙 Mover a Noche</button>
                        <button onClick={() => eliminarProducto(productId)} className="btn-small rojo">🗑️ Eliminar</button>
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
            <h2 className="panel-titulo">🌙 Agregar Producto - Turno Noche</h2>
            <form onSubmit={handleSubmit} className="form-producto">
              <input type="text" placeholder="Nombre" value={nuevoProducto.nombre} onChange={(e) => setNuevoProducto({...nuevoProducto, nombre: e.target.value})} className="input-neumo" required />
              <input type="number" placeholder="Precio" value={nuevoProducto.precio} onChange={(e) => setNuevoProducto({...nuevoProducto, precio: e.target.value})} className="input-neumo" required />
              <textarea placeholder="📷 URLs de imágenes (separadas por coma)" value={nuevoProducto.imagenes || ''} onChange={(e) => setNuevoProducto({...nuevoProducto, imagenes: e.target.value})} className="input-neumo textarea-neumo" rows="2" />
              <select value={nuevoProducto.categoria} onChange={(e) => setNuevoProducto({...nuevoProducto, categoria: e.target.value})} className="input-neumo">
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
            
            <div style={{ marginBottom: '1rem', padding: '1rem', background: 'rgba(139, 92, 246, 0.2)', borderRadius: '10px', border: '2px solid #8b5cf6', textAlign: 'center' }}>
              <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#a78bfa' }}>🌙 Turno Noche</span>
              <span style={{ marginLeft: '10px', color: '#94a3b8' }}>({productosNoche.length} productos)</span>
            </div>

            <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <button onClick={recargarProductos} className="btn-primary" style={{ margin: 0 }}>🔄 Recargar Productos</button>
              <span style={{ color: '#00b894', fontWeight: 'bold' }}>{productosFirebase.length} productos totales</span>
            </div>
            
            {productosNoche.length === 0 ? (
              <div className="sin-productos">
                <p>⚠️ No hay productos de noche</p>
                <p style={{ fontSize: '0.9rem', color: '#888' }}>Agregá tu primer producto con el formulario de arriba</p>
              </div>
            ) : (
              <div className="productos-admin-grid">
                {productosNoche.sort((a, b) => {
                  const ordenCategorias = { 'promosNoche': 1, 'cocteles': 2, 'ginTonic': 3, 'medidas': 4, 'jarras': 5, 'whiskys': 6, 'tequilas': 7, 'cervezas': 8, 'vinos': 9, 'espumantes': 10, 'sinAlcohol': 11, 'pizzas': 12, 'empanadas': 13, 'minutas': 14, 'extras': 15 }
                  const ordenA = ordenCategorias[a.categoria] || 999
                  const ordenB = ordenCategorias[b.categoria] || 999
                  if (ordenA !== ordenB) return ordenA - ordenB
                  return Number(a.orden || 999) - Number(b.orden || 999)
                }).map((prod) => {
                  const productId = prod.firestoreId || prod.id;
                  const tieneFotos = prod.imagenes && prod.imagenes.toString().trim().length > 0;
                  
                  return (
                    <div key={productId} className="producto-admin-card">
                      <div className="producto-admin-info">
                        <strong>{prod.nombre || 'Sin nombre'}</strong>
                        <div className="precio">${prod.precio ? Number(prod.precio).toLocaleString('es-AR') : '0'}</div>
                        <div className="meta">📂 {prod.categoria || 'sin categoría'}</div>
                        {tieneFotos && <div className="meta" style={{ color: '#00b894', marginTop: '0.25rem' }}>📷 Tiene fotos</div>}
                      </div>
                      <div className="producto-admin-botones">
                        <button onClick={() => { const n = prompt('Nuevo nombre:', prod.nombre); if (n && n.trim()) editarProducto(productId, { nombre: n.trim() }) }} className="btn-small azul">✏️ Nombre</button>
                        <button onClick={() => { const p = prompt('Nuevo precio:', prod.precio); if (p && !isNaN(Number(p))) editarProducto(productId, { precio: Number(p) }) }} className="btn-small verde">💰 Precio</button>
                        <button onClick={() => { const c = prompt('Nueva categoría:', prod.categoria); if (c && c.trim()) editarProducto(productId, { categoria: c.trim() }) }} className="btn-small purpura">📂 Categoría</button>
                        <button onClick={() => { const imgs = prompt('URLs de imágenes (separadas por coma):', prod.imagenes || ''); if (imgs !== null) editarProducto(productId, { imagenes: imgs.trim() }) }} className={`btn-small ${tieneFotos ? 'naranja' : 'gris'}`}>📷 Fotos</button>
                        <button onClick={() => toggleDisponibilidad(productId)} className={`btn-small ${prod.disponible !== false ? 'verde' : 'rojo'}`}>{prod.disponible !== false ? '✅ Disponible' : '🔴 Agotado'}</button>
                        <button onClick={() => cambiarTurnoProducto(productId, 'dia')} className="btn-small verde">☀️ Mover a Día</button>
                        <button onClick={() => eliminarProducto(productId)} className="btn-small rojo">🗑️ Eliminar</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ... (resto del panel de fidelidad y reservas se mantiene igual) ... */}
      </div>
    )
  }

  // ============================================
  // RENDER PRINCIPAL
  // ============================================
  return (
    <div className={`app-container ${turnoActual === 'noche' ? 'tema-noche' : turnoActual === 'prevent' ? 'tema-prevent' : 'tema-dia'}`} role="application" aria-label="Aplicación de pedidos Ineva Resto-Bar">
      {/* ... (todo el JSX del return se mantiene igual) ... */}
      
      {esAdmin && mostrarPanelAdmin ? (
        <PanelAdministracion />
      ) : turnoActual !== 'prevent' ? (
        <>
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
          
          {/* ... (resto del formulario de pedido, carrito, contacto, footer, etc.) ... */}
        </>
      ) : null}
    </div>
  )
}

export default App