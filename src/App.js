import React, { useState, useEffect } from 'react';
import { Plus, Trash2, AlertTriangle, Cloud, Loader2, MessageCircle, Edit2, Download, X } from 'lucide-react';
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from 'firebase/firestore';

// ---------------------------------------------------------
// TUS CLAVES DE FIREBASE (Ya integradas)
// ---------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyBzSU1E9Vu2PuYNodwcEjK2V0qk0y2CCYk",
  authDomain: "certplanner-e48a0.firebaseapp.com",
  projectId: "certplanner-e48a0",
  storageBucket: "certplanner-e48a0.firebasestorage.app",
  messagingSenderId: "592925313290",
  appId: "1:592925313290:web:08fb67e3b66eb4eea692f3",
  measurementId: "G-CTCB3W1WYX"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'registro-incidencias-spei'; 

export default function App() {
  const [user, setUser] = useState(null);
  const [incidencias, setIncidencias] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Estados del Formulario
  const [fecha, setFecha] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [enviadas, setEnviadas] = useState('NA');
  const [recibidas, setRecibidas] = useState('0');
  const [devoluciones, setDevoluciones] = useState('-');
  const [quejas, setQuejas] = useState('0');
  const [totalOperaciones, setTotalOperaciones] = useState('0');
  
  // Estado para la edición
  const [editingId, setEditingId] = useState(null);

  // 1. Autenticación
  useEffect(() => {
    const initAuth = async () => {
      try { await signInAnonymously(auth); } catch (e) { console.error("Error Auth:", e); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 2. Sincronización con Base de Datos
  useEffect(() => {
    if (!user) return;
    const q = collection(db, 'artifacts', appId, 'users', user.uid, 'incidencias');
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => b.createdAt - a.createdAt);
      setIncidencias(list);
      setLoading(false);
    }, (e) => setLoading(false));
    return () => unsub();
  }, [user]);

  // 3. Agregar o Actualizar Incidencia
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fecha || !descripcion.trim() || !user) {
      alert("Por favor llena al menos la fecha y la descripción.");
      return;
    }

    const data = {
      fecha,
      descripcion,
      enviadas,
      recibidas,
      devoluciones,
      quejas,
      totalOperaciones
    };

    try {
      if (editingId) {
        // ACTUALIZAR REGISTRO EXISTENTE
        const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'incidencias', editingId);
        await updateDoc(docRef, data);
        alert("Incidencia actualizada correctamente.");
      } else {
        // CREAR REGISTRO NUEVO
        await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'incidencias'), {
          ...data,
          createdAt: Date.now()
        });
      }
      limpiarFormulario();
    } catch (e) { 
      console.error(e); 
      alert("Error al guardar: " + e.message);
    }
  };

  // 4. Preparar para Editar
  const iniciarEdicion = (inc) => {
    setFecha(inc.fecha);
    setDescripcion(inc.descripcion);
    setEnviadas(inc.enviadas);
    setRecibidas(inc.recibidas);
    setDevoluciones(inc.devoluciones);
    setQuejas(inc.quejas);
    setTotalOperaciones(inc.totalOperaciones);
    setEditingId(inc.id);
    window.scrollTo({ top: 0, behavior: 'smooth' }); // Sube al formulario
  };

  // Limpiar y Cancelar
  const limpiarFormulario = () => {
    setFecha(''); setDescripcion(''); setEnviadas('NA'); setRecibidas('0'); 
    setDevoluciones('-'); setQuejas('0'); setTotalOperaciones('0');
    setEditingId(null);
  };

  // 5. Borrar
  const deleteIncidencia = async (id) => {
    if (!user) return;
    if(window.confirm("¿Estás seguro de borrar este registro?")) {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'incidencias', id));
    }
  };

  // 6. Generador de PDF
  const exportarPDF = () => {
    const element = document.getElementById('tabla-reporte');
    
    // Función que usa la librería para generar el PDF
    const generar = () => {
      const opt = {
        margin:       0.5,
        filename:     `Reporte_SPEI_${new Date().toLocaleDateString().replace(/\//g, '-')}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'in', format: 'a4', orientation: 'landscape' } // Horizontal
      };
      window.html2pdf().set(opt).from(element).save();
    };

    // Cargamos la librería html2pdf dinámicamente si no existe
    if (!window.html2pdf) {
      const script = document.createElement('script');
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
      script.onload = generar;
      document.body.appendChild(script);
    } else {
      generar();
    }
  };

  // 7. Reporte WhatsApp
  const shareWhatsApp = () => {
    let msg = "*🚨 Reporte de Incidencias*\n\n";
    if (incidencias.length === 0) msg += "Sin incidencias registradas.\n";
    incidencias.forEach(i => {
      const [y, m, d] = i.fecha.split('-');
      msg += `📅 *${d}/${m}/${y}*\n📝 ${i.descripcion}\n📉 Afectaciones: ${i.recibidas} | Quejas: ${i.quejas}\n\n`;
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Auxiliar Cálculos
  const calcularTotal = (campo) => {
    return incidencias.reduce((acc, current) => {
      const valor = parseInt(current[campo].toString().replace(/,/g, ''));
      return acc + (isNaN(valor) ? 0 : valor);
    }, 0).toLocaleString('en-US');
  };

  return (
    <div className="flex flex-col h-screen bg-slate-100 font-sans text-slate-800">
      
      {/* Header Fijo */}
      <div className="bg-[#0f2441] text-white px-4 pt-6 pb-4 flex justify-between items-center shadow-md z-10">
        <div>
          <h1 className="text-lg font-bold flex gap-2 items-center">
            <AlertTriangle className="text-red-400" size={20}/> 
            Incidencias SPEI
          </h1>
          <p className="text-xs text-slate-300">Registro y Control</p>
        </div>
        <div className="flex gap-2">
          {user ? (
            <span className="text-[10px] bg-slate-800 px-2 py-1 rounded border border-slate-700 text-green-400 flex items-center gap-1"><Cloud size={10}/> Online</span>
          ) : (
            <span className="text-[10px] bg-slate-800 px-2 py-1 rounded border border-slate-700 text-orange-400 flex items-center gap-1"><Loader2 size={10} className="animate-spin"/> Conectando</span>
          )}
          <button onClick={shareWhatsApp} className="bg-green-600 p-2 rounded-full shadow border border-green-500 active:scale-95" title="WhatsApp"><MessageCircle size={18}/></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-20">
        
        {/* Formulario */}
        <div className={`p-4 rounded-xl shadow-sm border ${editingId ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'}`}>
          <h2 className="text-sm font-bold text-slate-700 mb-3 border-b pb-2 flex items-center justify-between">
            {editingId ? <span className="text-blue-700 flex items-center gap-2"><Edit2 size={16}/> Editando Registro</span> : "Nueva Incidencia"}
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500">FECHA</label>
                <input type="date" required className="w-full bg-white rounded text-sm p-2 border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" value={fecha} onChange={e=>setFecha(e.target.value)}/>
              </div>
              <div className="md:col-span-2">
                <label className="text-[10px] font-bold text-slate-500">DESCRIPCIÓN</label>
                <input type="text" required placeholder="Ej: Error en el límite de transacciones..." className="w-full bg-white rounded text-sm p-2 border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" value={descripcion} onChange={e=>setDescripcion(e.target.value)}/>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500">AFECTACIÓN ENVIADAS</label>
                <input type="text" className="w-full bg-white rounded text-sm p-2 border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" value={enviadas} onChange={e=>setEnviadas(e.target.value)}/>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500">AFECTACIÓN RECIBIDAS</label>
                <input type="text" className="w-full bg-white rounded text-sm p-2 border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" value={recibidas} onChange={e=>setRecibidas(e.target.value)}/>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500">DEVOLUCIONES RECIBIDAS</label>
                <input type="text" className="w-full bg-white rounded text-sm p-2 border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" value={devoluciones} onChange={e=>setDevoluciones(e.target.value)}/>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500">QUEJAS</label>
                <input type="number" className="w-full bg-white rounded text-sm p-2 border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" value={quejas} onChange={e=>setQuejas(e.target.value)}/>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500">TOTAL DE OPERACIONES</label>
                <input type="number" className="w-full bg-white rounded text-sm p-2 border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" value={totalOperaciones} onChange={e=>setTotalOperaciones(e.target.value)}/>
              </div>
            </div>
            
            <div className="flex gap-2 mt-4">
              <button type="submit" disabled={!user} className={`flex-1 font-bold text-sm p-3 rounded-lg flex justify-center items-center gap-2 active:scale-95 transition-transform disabled:opacity-50 text-white ${editingId ? 'bg-blue-600' : 'bg-[#0f2441] hover:bg-[#1a365d]'}`}>
                {editingId ? <><Edit2 size={18} /> Actualizar</> : <><Plus size={18} /> Registrar</>}
              </button>
              
              {editingId && (
                <button type="button" onClick={limpiarFormulario} className="bg-red-50 text-red-600 font-bold text-sm p-3 rounded-lg flex justify-center items-center gap-2 active:scale-95 transition-transform hover:bg-red-100">
                  <X size={18} /> Cancelar
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Botonera de Exportación */}
        <div className="flex justify-end">
          <button 
            onClick={exportarPDF} 
            disabled={incidencias.length === 0}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold px-4 py-2 rounded shadow-md transition-colors disabled:opacity-50"
          >
            <Download size={16} /> Exportar a PDF
          </button>
        </div>

        {/* CONTENEDOR DE LA TABLA A EXPORTAR */}
        <div id="tabla-reporte" className="bg-white rounded shadow-sm border border-slate-200 overflow-hidden p-2">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] border-collapse bg-white">
              <thead>
                <tr>
                  <th colSpan="8" className="bg-[#0f2441] text-white p-2 text-center text-sm font-bold border border-slate-600">
                    INCIDENCIA SPEI
                  </th>
                </tr>
                <tr className="bg-[#1a365d] text-white text-[10px] uppercase tracking-wider text-center">
                  <th className="border border-slate-600 p-2 w-24">Fecha</th>
                  <th className="border border-slate-600 p-2 min-w-[200px]">Descripción</th>
                  <th className="border border-slate-600 p-2">Afectación Enviadas</th>
                  <th className="border border-slate-600 p-2">Afectación Recibidas</th>
                  <th className="border border-slate-600 p-2">Afectación Devoluciones</th>
                  <th className="border border-slate-600 p-2">Quejas</th>
                  <th className="border border-slate-600 p-2">Total Operaciones</th>
                  {/* Esta columna se oculta al imprimir/exportar porque tiene los botones */}
                  <th className="border border-slate-600 p-2 w-20" data-html2canvas-ignore>Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white text-sm text-slate-700 text-center">
                {loading ? (
                  <tr><td colSpan="8" className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-blue-500"/></td></tr>
                ) : incidencias.length === 0 ? (
                  <tr><td colSpan="8" className="p-8 text-center text-slate-400">No hay incidencias registradas.</td></tr>
                ) : (
                  incidencias.map((inc) => {
                    const [y, m, d] = inc.fecha.split('-');
                    return (
                      <tr key={inc.id} className={`${editingId === inc.id ? 'bg-blue-50' : 'hover:bg-slate-50'} transition-colors`}>
                        <td className="border border-slate-300 p-2">{d}/{m}/{y}</td>
                        <td className="border border-slate-300 p-2 text-left">{inc.descripcion}</td>
                        <td className="border border-slate-300 p-2">{inc.enviadas}</td>
                        <td className="border border-slate-300 p-2">{inc.recibidas}</td>
                        <td className="border border-slate-300 p-2">{inc.devoluciones}</td>
                        <td className="border border-slate-300 p-2">{inc.quejas}</td>
                        <td className="border border-slate-300 p-2">{inc.totalOperaciones}</td>
                        
                        {/* Columna ignorada por el PDF */}
                        <td className="border border-slate-300 p-1" data-html2canvas-ignore>
                          <div className="flex justify-center gap-2">
                            <button onClick={() => iniciarEdicion(inc)} className="text-blue-500 hover:text-blue-700 p-1 rounded" title="Editar">
                              <Edit2 size={16}/>
                            </button>
                            <button onClick={() => deleteIncidencia(inc.id)} className="text-red-400 hover:text-red-600 p-1 rounded" title="Borrar">
                              <Trash2 size={16}/>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
                
                {/* Fila de Totales */}
                {!loading && incidencias.length > 0 && (
                  <tr className="bg-[#0f2441] text-white font-bold text-center text-sm">
                    <td colSpan="2" className="border border-slate-600 p-2 uppercase text-right pr-4">Total General</td>
                    <td className="border border-slate-600 p-2">{calcularTotal('enviadas')}</td>
                    <td className="border border-slate-600 p-2">{calcularTotal('recibidas')}</td>
                    <td className="border border-slate-600 p-2">{calcularTotal('devoluciones')}</td>
                    <td className="border border-slate-600 p-2">{calcularTotal('quejas')}</td>
                    <td className="border border-slate-600 p-2">{calcularTotal('totalOperaciones')}</td>
                    <td className="border border-slate-600 p-2" data-html2canvas-ignore></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
