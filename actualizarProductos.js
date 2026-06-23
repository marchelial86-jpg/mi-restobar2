// Script para actualizar productos de Firebase
// Ejecutar con: node actualizarProductos.js

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';

// Configuración de Firebase (copiá la de tu firebase.js)
const firebaseConfig = {
  apiKey: "AIzaSyDQ0ttmojsPWvLmO5_zQbEtcDZU-kdyrA4",
  authDomain: "ineva-resto-bar.firebaseapp.com",
  projectId: "ineva-resto-bar",
  storageBucket: "ineva-resto-bar.firebasestorage.app",
  messagingSenderId: "187881514354",
  appId: "1:187881514354:web:5e1b8e3b0428afb6c769eb"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Mapeo de categorías día → noche
const categoriasMap = {
  'pizzas': 'pizzasNoche',
  'empanadas': 'empanadasNoche',
  'bebidas': 'bebidas', // Se mantiene igual
  'comidasFijas': 'minutas',
  'menuDelDia': 'minutas',
  'desayunos': 'minutas'
};

// Precios sugeridos para la noche
const preciosNoche = {
  'Empanada de Carne': 1100,
  'Empanada de Pollo': 1100,
  'Empanada Árabe': 1100,
  'Empanada Jamón y Queso': 1100,
  'Empanada de Queso y Cebolla': 1100,
  'Empanada de Verdura': 1100,
  'Empanada de Choclo': 1100,
  'Pizza Muzza': 7000,
  'Pizza Napolitana': 8500,
  'Pizza Especial': 9000,
  'Pizza Doble Muzza': 8000,
  'Pizza Fugazza': 7500,
  'Pizza Fugazzeta': 8000,
  'Pizza Calabresa': 8500,
  'Pizza Doble Queso': 7000
};

async function actualizarProductos() {
  console.log('🔍 Obteniendo todos los productos...');
  
  const querySnapshot = await getDocs(collection(db, 'productos'));
  const productos = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  console.log(`📦 Total productos: ${productos.length}`);
  
  let actualizados = 0;
  
  for (const producto of productos) {
    // Solo actualizar productos sin campo turno o con turno 'dia'
    const turnoActual = producto.turno || 'ambos';
    
    if (turnoActual === 'dia' || !producto.turno) {
      const categoriaActual = producto.categoria;
      const nuevaCategoria = categoriasMap[categoriaActual] || categoriaActual;
      
      // Si es una categoría que debe cambiar
      if (nuevaCategoria !== categoriaActual) {
        const nuevosDatos = {
          categoria: nuevaCategoria,
          turno: 'noche'
        };
        
        // Actualizar precio si existe en la lista
        if (preciosNoche[producto.nombre]) {
          nuevosDatos.precio = preciosNoche[producto.nombre];
        }
        
        try {
          await updateDoc(doc(db, 'productos', producto.id), nuevosDatos);
          console.log(`✅ ${producto.nombre}: ${categoriaActual} → ${nuevaCategoria}`);
          actualizados++;
        } catch (error) {
          console.error(`❌ Error con ${producto.nombre}:`, error.message);
        }
      }
    }
  }
  
  console.log(`\n✨ Total actualizados: ${actualizados} productos`);
  console.log('🎉 ¡Proceso completado!');
}

actualizarProductos().catch(console.error);