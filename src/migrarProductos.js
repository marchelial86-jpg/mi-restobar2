import { collection, addDoc, getDocs, query, where } from 'firebase/firestore'
import { db } from './firebase'

// Productos estáticos para migrar
const productosAMigrar = [
  // Menú del Día
  { id: 'menu1', nombre: 'Menú del Día #1 - Milanesa con Puré', precio: 12000, categoria: 'menuDelDia', orden: 1 },
  { id: 'menu2', nombre: 'Menú del Día #2 - Pollo al Horno con Arroz', precio: 12000, categoria: 'menuDelDia', orden: 2 },
  { id: 'menu3', nombre: 'Menú del Día #3 - Pasta con Salsa Bolognesa', precio: 11000, categoria: 'menuDelDia', orden: 3 },
  
  // Comidas Fijas
  { id: 'fija1', nombre: 'Milanesa con Guarnición', precio: 11000, categoria: 'comidasFijas', orden: 4 },
  { id: 'fija2', nombre: 'Costeleta con Guarnición', precio: 9500, categoria: 'comidasFijas', orden: 5 },
  { id: 'fija3', nombre: 'Mila Napo', precio: 7000, categoria: 'comidasFijas', orden: 6 },
  { id: 'fija4', nombre: 'Mila a Caballo', precio: 7000, categoria: 'comidasFijas', orden: 7 },
  { id: 'fija5', nombre: 'Hamburguesa con Guarnición', precio: 7000, categoria: 'comidasFijas', orden: 8 },
  { id: 'fija6', nombre: 'Sándwich de Lomito', precio: 7000, categoria: 'comidasFijas', orden: 9 },
  { id: 'fija7', nombre: 'Sándwich de Milanesa', precio: 7000, categoria: 'comidasFijas', orden: 10 },
  { id: 'fija8', nombre: 'Hamburguesa', precio: 7000, categoria: 'comidasFijas', orden: 11 },
  
  // Pizzas
  { id: 'pizza1', nombre: 'Muzza', precio: 7000, categoria: 'pizzas', orden: 12 },
  { id: 'pizza2', nombre: 'Napo', precio: 8500, categoria: 'pizzas', orden: 13 },
  { id: 'pizza3', nombre: 'Especial', precio: 9000, categoria: 'pizzas', orden: 14 },
  { id: 'pizza4', nombre: 'Fugazza', precio: 7500, categoria: 'pizzas', orden: 15 },
  { id: 'pizza5', nombre: 'Fugazzeta', precio: 8000, categoria: 'pizzas', orden: 16 },
  { id: 'pizza6', nombre: 'Calabresa', precio: 8500, categoria: 'pizzas', orden: 17 },
  
  // Empanadas
  { id: 'empa1', nombre: 'Carne', precio: 11000, categoria: 'empanadas', orden: 18 },
  { id: 'empa2', nombre: 'Pollo', precio: 11000, categoria: 'empanadas', orden: 19 },
  { id: 'empa3', nombre: 'Jamón y Queso', precio: 11000, categoria: 'empanadas', orden: 20 },
  { id: 'empa4', nombre: 'Queso y Cebolla', precio: 11000, categoria: 'empanadas', orden: 21 },
  { id: 'empa5', nombre: 'Árabe', precio: 11000, categoria: 'empanadas', orden: 22 },
  { id: 'empa6', nombre: 'Verdura', precio: 11000, categoria: 'empanadas', orden: 23 },
  { id: 'empa7', nombre: 'Choclo', precio: 11000, categoria: 'empanadas', orden: 24 },
  
  // Desayunos
  { id: 'desa1', nombre: 'Desayuno (Mate Cocido)', precio: 8500, categoria: 'desayunos', orden: 25 },
  { id: 'desa2', nombre: 'Desayuno (Té)', precio: 5000, categoria: 'desayunos', orden: 26 },
  { id: 'desa3', nombre: 'Licuados', precio: 4500, categoria: 'desayunos', orden: 27 },
  { id: 'desa4', nombre: 'Jugos Naturales', precio: 6000, categoria: 'desayunos', orden: 28 },
  
  // Bebidas
  { id: 'beb1', nombre: 'Coca Cola 2 lts', precio: 7500, categoria: 'bebidas', orden: 29 },
  { id: 'beb2', nombre: 'Coca Cola 1.5 lts', precio: 2500, categoria: 'bebidas', orden: 30 },
  { id: 'beb3', nombre: 'Coca Cola 1 lts', precio: 4500, categoria: 'bebidas', orden: 31 },
  { id: 'beb4', nombre: 'Agua Saborizada', precio: 2500, categoria: 'bebidas', orden: 32 },
  { id: 'beb5', nombre: 'Agua Mineral', precio: 2000, categoria: 'bebidas', orden: 33 },
  { id: 'beb6', nombre: 'Vino Viña de Balbo', precio: 2500, categoria: 'bebidas', orden: 34 },
]

export const migrarProductos = async () => {
  try {
    console.log('🚀 Iniciando migración de productos...')
    
    for (const producto of productosAMigrar) {
      // Verificar si ya existe
      const q = query(
        collection(db, 'productos'),
        where('id', '==', producto.id)
      )
      const querySnapshot = await getDocs(q)
      
      if (querySnapshot.empty) {
        // No existe, lo creamos
        await addDoc(collection(db, 'productos'), {
          ...producto,
          disponible: true,
          fechaCreacion: new Date().toISOString()
        })
        console.log(`✅ Agregado: ${producto.nombre}`)
      } else {
        console.log(`⏭️  Ya existe: ${producto.nombre}`)
      }
    }
    
    console.log('✅ Migración completada!')
    alert('✅ Productos migrados correctamente a Firebase!')
  } catch (error) {
    console.error('❌ Error en migración:', error)
    alert('❌ Error al migrar productos: ' + error.message)
  }
}