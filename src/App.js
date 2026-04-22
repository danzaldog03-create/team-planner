import React, { useState, useEffect } from 'react';
import { Plus, Trash2, AlertTriangle, Cloud, Loader2, MessageCircle, Edit2, Printer, X, FileSpreadsheet, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from 'firebase/firestore';

// ---------------------------------------------------------
// TUS CLAVES DE FIREBASE 
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
  
  // Estados de Interfaz
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
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

  // 3. Agregar o Actualizar
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fecha || !descripcion.trim() || !user) {
      alert("Por favor llena al menos la fecha y la descripción.");
      return;
    }

    const data = {
      fecha, descripcion, enviadas, recibidas, devoluciones, quejas, totalOperaciones
    };

    try {
      if (editingId) {
        const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'incidencias', editingId);
        await updateDoc(docRef, data);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'incidencias'), {
          ...data, createdAt: Date.now()
        });
      }
      limpiarFormulario();
      setShowForm(false);
    } catch (e) { 
      console.error(e); 
      alert("Error al guardar: " + e.message);
    }
  };

  const iniciarEdicion = (inc) => {
    setFecha(inc.fecha); setDescripcion(inc.descripcion); setEnviadas(inc.enviadas);
    setRecibidas(inc.recibidas); setDevoluciones(inc.devoluciones); setQuejas(inc.quejas);
    setTotalOperaciones(inc.totalOperaciones); setEditingId(inc.id);
    setShowForm(true); window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const limpiarFormulario = () => {
    setFecha(''); setDescripcion(''); setEnviadas('NA'); setRecibidas('0'); 
    setDevoluciones('-'); setQuejas('0'); setTotalOperaciones('0'); setEditingId(null);
  };

  const deleteIncidencia = async (id) => {
    if (!user) return;
    if(window.confirm("¿Estás seguro de borrar este registro?")) {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'incidencias', id));
    }
  };

  const incidenciasFiltradas = incidencias.filter(inc => 
    inc.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) || 
    inc.fecha.includes(searchTerm)
  );

  // --- NUEVA OPCIÓN: IMPRESIÓN NATIVA ---
  const imprimirNativo = () => {
    window.print();
  };

  const exportarExcel = () => {
    const headers = ['Fecha', 'Descripción', 'Afectación Enviadas', 'Afectación Recibidas', 'Afectación Devoluciones', 'Quejas', 'Total Operaciones'];
    const csvRows = incidenciasFiltradas.map(inc => {
      const [y, m, d] = inc.fecha.split('-');
      return [
        `${d}/${m}/${y}`, `"${inc.descripcion.replace(/"/g, '""')}"`,
        inc.enviadas, inc.recibidas, inc.devoluciones, inc.quejas, inc.totalOperaciones
      ].join(',');
    });

    const filaTotales = [
      'Total General', '""', 
      calcularTotal('enviadas').replace(/,/g, ''), calcularTotal('recibidas').replace(/,/g, ''),
      calcularTotal('devoluciones').replace(/,/g, ''), calcularTotal('quejas').replace(/,/g, ''),
      calcularTotal('totalOperaciones').replace(/,/g, '')
    ].join(',');

    const csvContent = '\uFEFF' + headers.join(',') + '\n' + csvRows.join('\n') + '\n' + filaTotales;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `Reporte_SPEI_${new Date().toLocaleDateString().replace(/\//g, '-')}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const shareWhatsApp = () => {
    let msg = "*🚨 Reporte de Incidencias*\n\n";
    if (incidenciasFiltradas.length === 0) msg += "Sin incidencias que reportar.\n";
    incidenciasFiltradas.slice(0, 10).forEach(i => {
      const [y, m, d] = i.fecha.split('-');
      msg += `📅 *${d}/${m}/${y}*\n📝 ${i.descripcion}\n📉 Afectaciones: ${i.recibidas} | Quejas: ${i.quejas}\n\n`;
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const calcularTotal = (campo) => {
    return incidenciasFiltradas.reduce((acc, current) => {
      const valor = parseInt(current[campo].toString().replace(/,/g, ''));
      return acc + (isNaN(valor) ? 0 : valor);
    }, 0).toLocaleString('en-US');
  };

  return (
    // Agregamos print:bg-white para asegurar fondo blanco al imprimir
    <div className="flex flex-col h-screen bg-slate-100 font-sans text-slate-800 print:bg-white print:h-auto print:block">
      
      {/* Header Fijo (Se oculta al imprimir con print:hidden) */}
      <div className="bg-[#0f2441] text-white px-4 pt-6 pb-4 flex justify-between items-center shadow-md z-20 print:hidden">
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
          <button onClick={shareWhatsApp} className="bg-green-600 p-2 rounded-full shadow border border-green-500 active:scale-95"><MessageCircle size={18}/></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20 print:p-0 print:overflow-visible">
        
        {/* Botón y Formulario (Se ocultan al imprimir con print:hidden) */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden print:hidden">
          <button 
            onClick={() => { setShowForm(!showForm); if(editingId) limpiarFormulario(); }} 
            className={`w-full p-4 flex justify-between items-center font-bold text-sm transition-colors ${showForm ? 'bg-slate-50 border-b border-slate-200 text-[#0f2441]' : 'text-slate-600'}`}
          >
            <span className="flex items-center gap-2">
              {editingId ? <Edit2 size={18} className="text-blue-500" /> : <Plus size={18} className="text-[#0f2441]" />}
              {editingId ? 'Editando Incidencia' : 'Capturar Nueva Incidencia'}
            </span>
            {showForm ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
          </button>

          {showForm && (
            <div className={`p-4 ${editingId ? 'bg-blue-50/50' : 'bg-white'}`}>
              <form onSubmit={handleSubmit} className="space-y-3 animate-in slide-in-from-top-2 duration-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500">FECHA</label>
                    <input type="date" required className="w-full bg-white rounded-lg text-sm p-2.5 border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" value={fecha} onChange={e=>setFecha(e.target.value)}/>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[10px] font-bold text-slate-500">DESCRIPCIÓN</label>
                    <input type="text" required placeholder="Ej: Error en el límite de transacciones..." className="w-full bg-white rounded-lg text-sm p-2.5 border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" value={descripcion} onChange={e=>setDescripcion(e.target.value)}/>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500">AFECTACIÓN ENVIADAS</label>
                    <input type="text" className="w-full bg-white rounded-lg text-sm p-2.5 border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" value={enviadas} onChange={e=>setEnviadas(e.target.value)}/>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500">AFECTACIÓN RECIBIDAS</label>
                    <input type="text" className="w-full bg-white rounded-lg text-sm p-2.5 border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" value={recibidas} onChange={e=>setRecibidas(e.target.value)}/>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500">DEVOLUCIONES RECIBIDAS</label>
                    <input type="text" className="w-full bg-white rounded-lg text-sm p-2.5 border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" value={devoluciones} onChange={e=>setDevoluciones(e.target.value)}/>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500">QUEJAS</label>
                    <input type="number" className="w-full bg-white rounded-lg text-sm p-2.5 border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" value={quejas} onChange={e=>setQuejas(e.target.value)}/>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500">TOTAL DE OPERACIONES</label>
                    <input type="number" className="w-full bg-white rounded-lg text-sm p-2.5 border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" value={totalOperaciones} onChange={e=>setTotalOperaciones(e.target.value)}/>
                  </div>
                </div>
                
                <div className="flex gap-2 mt-4 pt-2">
                  <button type="submit" disabled={!user} className={`flex-1 font-bold text-sm p-3 rounded-lg flex justify-center items-center gap-2 active:scale-95 transition-transform disabled:opacity-50 text-white shadow-md ${editingId ? 'bg-blue-600' : 'bg-[#0f2441] hover:bg-[#1a365d]'}`}>
                    {editingId ? <><Edit2 size={18} /> Guardar Cambios</> : <><Plus size={18} /> Registrar Incidencia</>}
                  </button>
                  {editingId && (
                    <button type="button" onClick={() => { limpiarFormulario(); setShowForm(false); }} className="bg-red-50 text-red-600 font-bold text-sm p-3 rounded-lg flex justify-center items-center gap-2 active:scale-95 transition-transform hover:bg-red-100">
                      <X size={18} /> Cancelar
                    </button>
                  )}
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Buscador y Botones (Se ocultan al imprimir con print:hidden) */}
        <div className="flex flex-col md:flex-row justify-between gap-3 items-center mt-6 print:hidden">
          <div className="relative w-full md:w-auto flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por fecha o descripción..." 
              className="w-full bg-white pl-10 pr-4 py-2 rounded-full text-sm border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex gap-2 w-full md:w-auto justify-end">
            <button onClick={exportarExcel} disabled={incidenciasFiltradas.length === 0} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-4 py-2 rounded-lg shadow-sm transition-colors disabled:opacity-50">
              <FileSpreadsheet size={16} /> Excel
            </button>
            <button onClick={imprimirNativo} disabled={incidenciasFiltradas.length === 0} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold px-4 py-2 rounded-lg shadow-sm transition-colors disabled:opacity-50">
              <Printer size={16} /> Imprimir / PDF
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* ÁREA DEL REPORTE (Ajustado para verse bien en hoja A4)    */}
        {/* ========================================================= */}
        <div className="bg-slate-100 p-2 space-y-4 print:bg-white print:p-0">
          
          {/* Título Oficial del Reporte */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center print:border-none print:shadow-none print:px-0">
             <div>
                <h2 className="text-xl font-bold text-[#0f2441] print:text-2xl print:text-black">Reporte de Incidencias SPEI</h2>
                <p className="text-sm text-slate-500 print:text-black">Generado el: {new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
             </div>
             {searchTerm && <div className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded font-bold border border-yellow-200 print:hidden">Filtro Activo</div>}
          </div>

          {/* Tarjetas KPI */}
          {!loading && incidenciasFiltradas.length > 0 && (
            <div className="grid grid-cols-3 gap-3 print:gap-1">
               <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-sm text-center print:border-gray-300 print:shadow-none print:p-2">
                 <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 print:text-[10px] print:text-gray-600">Enviadas</p>
                 <p className="text-2xl font-bold text-blue-600 print:text-lg print:text-black">{calcularTotal('enviadas')}</p>
               </div>
               <div className="bg-white p-4 rounded-xl border border-orange-200 shadow-sm text-center print:border-gray-300 print:shadow-none print:p-2">
                 <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 print:text-[10px] print:text-gray-600">Recibidas</p>
                 <p className="text-2xl font-bold text-orange-600 print:text-lg print:text-black">{calcularTotal('recibidas')}</p>
               </div>
               <div className="bg-white p-4 rounded-xl border border-red-200 shadow-sm text-center print:border-gray-300 print:shadow-none print:p-2">
                 <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 print:text-[10px] print:text-gray-600">Quejas</p>
                 <p className="text-2xl font-bold text-red-600 print:text-lg print:text-black">{calcularTotal('quejas')}</p>
               </div>
            </div>
          )}

          {/* Contenedor de la Tabla */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden print:border-none print:shadow-none">
            
            {/* Se elimina el overflow-x-auto nativamente al imprimir (print:overflow-visible) para que la tabla use el ancho de la hoja completa */}
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full min-w-[900px] print:min-w-full border-collapse bg-white">
                <thead>
                  <tr className="bg-[#1a365d] text-white text-[10px] uppercase tracking-wider text-center print:bg-gray-200 print:text-black print:text-[9px]">
                    <th className="border border-slate-600 p-3 w-24 print:border-gray-400 print:p-1">Fecha</th>
                    <th className="border border-slate-600 p-3 min-w-[250px] print:border-gray-400 print:p-1">Descripción</th>
                    <th className="border border-slate-600 p-3 print:border-gray-400 print:p-1">Enviadas</th>
                    <th className="border border-slate-600 p-3 print:border-gray-400 print:p-1">Recibidas</th>
                    <th className="border border-slate-600 p-3 print:border-gray-400 print:p-1">Devoluciones</th>
                    <th className="border border-slate-600 p-3 print:border-gray-400 print:p-1">Quejas</th>
                    <th className="border border-slate-600 p-3 print:border-gray-400 print:p-1">Total Op.</th>
                    {/* Se oculta la columna acciones al imprimir */}
                    <th className="border border-slate-600 p-3 w-20 print:hidden">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white text-sm text-slate-700 text-center print:text-[10px] print:text-black">
                  {loading ? (
                    <tr><td colSpan="8" className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-blue-500"/></td></tr>
                  ) : incidenciasFiltradas.length === 0 ? (
                    <tr><td colSpan="8" className="p-8 text-center text-slate-400">No hay incidencias para mostrar.</td></tr>
                  ) : (
                    incidenciasFiltradas.map((inc) => {
                      const [y, m, d] = inc.fecha.split('-');
                      return (
                        <tr key={inc.id} className={`${editingId === inc.id ? 'bg-blue-50' : 'hover:bg-slate-50'} transition-colors print:bg-white print:hover:bg-white`}>
                          <td className="border border-slate-300 p-2 print:border-gray-400 print:p-1">{d}/{m}/{y}</td>
                          <td className="border border-slate-300 p-2 text-left print:border-gray-400 print:p-1">{inc.descripcion}</td>
                          <td className="border border-slate-300 p-2 font-medium print:border-gray-400 print:p-1">{inc.enviadas}</td>
                          <td className="border border-slate-300 p-2 font-medium print:border-gray-400 print:p-1">{inc.recibidas}</td>
                          <td className="border border-slate-300 p-2 print:border-gray-400 print:p-1">{inc.devoluciones}</td>
                          <td className="border border-slate-300 p-2 print:border-gray-400 print:p-1">{inc.quejas}</td>
                          <td className="border border-slate-300 p-2 print:border-gray-400 print:p-1">{inc.totalOperaciones}</td>
                          
                          {/* Botones de acción ocultos al imprimir */}
                          <td className="border border-slate-300 p-1 print:hidden">
                            <div className="flex justify-center gap-2">
                              <button onClick={() => iniciarEdicion(inc)} className="text-blue-500 hover:bg-blue-100 p-1.5 rounded transition-colors" title="Editar"><Edit2 size={16}/></button>
                              <button onClick={() => deleteIncidencia(inc.id)} className="text-red-400 hover:bg-red-50 p-1.5 rounded transition-colors" title="Borrar"><Trash2 size={16}/></button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                  
                  {/* Fila de Totales */}
                  {!loading && incidenciasFiltradas.length > 0 && (
                    <tr className="bg-[#0f2441] text-white font-bold text-center text-sm print:bg-gray-200 print:text-black print:text-[10px]">
                      <td colSpan="2" className="border border-slate-600 p-3 uppercase text-right pr-4 print:border-gray-400 print:p-1">Total General</td>
                      <td className="border border-slate-600 p-3 text-blue-200 print:border-gray-400 print:text-black print:p-1">{calcularTotal('enviadas')}</td>
                      <td className="border border-slate-600 p-3 text-orange-200 print:border-gray-400 print:text-black print:p-1">{calcularTotal('recibidas')}</td>
                      <td className="border border-slate-600 p-3 print:border-gray-400 print:p-1">{calcularTotal('devoluciones')}</td>
                      <td className="border border-slate-600 p-3 text-red-200 print:border-gray-400 print:text-black print:p-1">{calcularTotal('quejas')}</td>
                      <td className="border border-slate-600 p-3 print:border-gray-400 print:p-1">{calcularTotal('totalOperaciones')}</td>
                      <td className="border border-slate-600 p-3 print:hidden"></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
