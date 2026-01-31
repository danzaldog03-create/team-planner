import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Award, Bell, CheckCircle, Cloud, Loader2, Sparkles, X, Brain, CalendarPlus, MessageCircle, User, Calendar, AlertCircle } from 'lucide-react';

// --- IMPORTANTE: Los imports de Firebase van AQUÍ ARRIBA ---
import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot 
} from 'firebase/firestore';

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

// Inicializamos Firebase con tus datos
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ID global para la colección de datos
const appId = 'cert-planner-team'; 
const apiKey = ""; // Tu API Key de Gemini (Opcional, para la IA)

export default function App() {
  const [user, setUser] = useState(null);
  const [certs, setCerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null); // Nuevo estado para errores
  
  // Estados del Formulario
  const [newCert, setNewCert] = useState('');
  const [provider, setProvider] = useState('Google');
  const [targetDate, setTargetDate] = useState('');
  const [assignee, setAssignee] = useState(''); 
  const [filter, setFilter] = useState('all');

  // Estados de IA
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [selectedCertForAI, setSelectedCertForAI] = useState(null);
  const [aiContent, setAiContent] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // 1. Autenticación Anónima (Para que no pida login al inicio)
  useEffect(() => {
    const initAuth = async () => {
      try { 
        await signInAnonymously(auth); 
        setAuthError(null);
      } 
      catch (e) { 
        console.error("Error Auth:", e); 
        setAuthError("Error de conexión. Revisa tu internet.");
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if(currentUser) setAuthError(null);
    });
    return () => unsubscribe();
  }, []);

  // 2. Sincronización en Tiempo Real con tu Base de Datos
  useEffect(() => {
    if (!user) return;
    // Conectamos a tu proyecto 'certplanner-e48a0'
    const q = collection(db, 'artifacts', appId, 'users', user.uid, 'certifications');
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => b.createdAt - a.createdAt);
      setCerts(list);
      setLoading(false);
    }, (e) => {
      console.error("Error DB:", e);
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  // 3. Funciones (Agregar, Editar, Borrar)
  const addCert = async (e) => {
    if (e) e.preventDefault(); // Prevenir recarga si está en form
    
    if (!user) {
      alert("Esperando conexión con la base de datos...");
      return;
    }
    if (!newCert.trim()) {
      alert("Por favor escribe el nombre de la meta.");
      return;
    }

    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'certifications'), {
        text: newCert, 
        provider, 
        assignee: assignee || 'Sin asignar',
        status: 'studying', 
        date: targetDate || 'Sin fecha', 
        createdAt: Date.now()
      });
      setNewCert(''); setTargetDate(''); setAssignee('');
    } catch (e) { 
      console.error(e); 
      alert("Error al guardar: " + e.message);
    }
  };

  const toggleStatus = async (id, status) => {
    if (!user) return;
    const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'certifications', id);
    await updateDoc(ref, { status: status === 'studying' ? 'passed' : 'studying' });
  };

  const deleteCert = async (id) => {
    if (!user) return;
    await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'certifications', id));
  };

  // 4. Utilidades
  const getDaysRemaining = (dateStr) => {
    if (!dateStr || dateStr === 'Sin fecha') return null;
    const [y, m, d] = dateStr.split('-').map(Number);
    const target = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0,0,0,0);
    return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
  };

  const getCalendarUrl = (cert) => {
    if (!cert.date || cert.date === 'Sin fecha') return null;
    const [year, month, day] = cert.date.split('-').map(Number);
    const start = new Date(year, month - 1, day); 
    const end = new Date(year, month - 1, day + 1);
    const fmt = (d) => d.toISOString().replace(/-|:|\.\d\d\d/g, "").split("T")[0];
    const title = encodeURIComponent(`Examen: ${cert.text} (${cert.assignee})`);
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${fmt(start)}/${fmt(end)}`;
  };

  const shareWhatsApp = () => {
    const active = certs.filter(c => c.status === 'studying');
    let msg = "*🚀 Reporte de Equipo*\n\n";
    if (active.length === 0) msg += "¡Todo al día!\n";
    
    active.forEach(c => {
      const days = getDaysRemaining(c.date);
      const dayText = days !== null ? `(${days} días)` : '';
      msg += `🔥 *${c.text}*\n   👤 ${c.assignee} ${dayText}\n\n`;
    });
    
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // 5. Interfaz Gráfica (UI)
  const urgent = certs.filter(c => {
    const d = getDaysRemaining(c.date);
    return c.status === 'studying' && d !== null && d <= 7 && d >= 0;
  });

  const getProviderColor = (p) => ({
    'Google': 'bg-blue-100 text-blue-700', 'AWS': 'bg-orange-100 text-orange-700', 'Microsoft': 'bg-sky-100 text-sky-700'
  }[p] || 'bg-gray-100 text-gray-700');

  // Lógica IA
  const callGemini = async (type) => {
    if (!selectedCertForAI) return;
    setAiLoading(true); setAiContent('');
    const p = type === 'plan' ? `Plan de estudio 4 semanas para ${selectedCertForAI.text}` : `3 preguntas quiz sobre ${selectedCertForAI.text}`;
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ contents: [{ parts: [{ text: p }] }] })
      });
      const d = await res.json();
      setAiContent(d.candidates?.[0]?.content?.parts?.[0]?.text || "Error");
    } catch { setAiContent("Error conexión"); } finally { setAiLoading(false); }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans text-slate-800">
      
      {/* Header Fijo */}
      <div className="bg-slate-900 text-white px-4 pt-6 pb-4 flex justify-between items-center shadow-lg z-10">
        <div><h1 className="text-lg font-bold flex gap-2"><Award className="text-yellow-400" size={20}/> Team Planner</h1></div>
        <div className="flex gap-2">
          {user ? (
            <span className="text-[10px] bg-slate-800 px-2 py-1 rounded border border-slate-700 text-green-400 flex items-center gap-1"><Cloud size={10}/> Online</span>
          ) : (
            <span className="text-[10px] bg-slate-800 px-2 py-1 rounded border border-slate-700 text-orange-400 flex items-center gap-1"><Loader2 size={10} className="animate-spin"/> Conectando</span>
          )}
          <button onClick={shareWhatsApp} className="bg-green-600 p-2 rounded-full shadow border border-green-500 active:scale-95"><MessageCircle size={18}/></button>
        </div>
      </div>

      {/* Contenido Scrollable */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20">
        
        {/* Aviso de Error de Conexión */}
        {authError && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r shadow-sm flex gap-3">
            <AlertCircle className="text-red-500 mt-1" size={16}/>
            <div><h3 className="font-bold text-sm text-red-800">Error de Conexión</h3><p className="text-xs text-red-600">{authError}</p></div>
          </div>
        )}

        {urgent.length > 0 && (
          <div className="bg-white border-l-4 border-orange-500 p-3 rounded-r shadow-sm flex gap-3 animate-pulse">
            <Bell className="text-orange-500 mt-1" size={16}/>
            <div><h3 className="font-bold text-sm text-orange-800">Urgente</h3><p className="text-xs text-orange-600">{urgent.length} entregas cerca.</p></div>
          </div>
        )}

        {/* Formulario */}
        <div className="bg-white p-4 rounded-xl shadow-sm space-y-3">
          <div className="flex gap-2">
            <select className="bg-slate-50 rounded-lg text-xs p-2 flex-1 border border-slate-100" value={provider} onChange={e=>setProvider(e.target.value)}><option>Google</option><option>AWS</option><option>Microsoft</option><option>Otro</option></select>
            <input type="date" className="bg-slate-50 rounded-lg text-xs p-2 flex-1 border border-slate-100" value={targetDate} onChange={e=>setTargetDate(e.target.value)}/>
          </div>
          <div className="relative">
            <User size={14} className="absolute left-3 top-3 text-slate-400"/>
            <input type="text" placeholder="¿Responsable? (Ej: Ana)" className="w-full bg-slate-50 rounded-lg pl-8 p-2.5 text-xs border border-slate-100" value={assignee} onChange={e=>setAssignee(e.target.value)}/>
          </div>
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="Nueva Meta..." 
              className="bg-slate-50 rounded-lg p-3 flex-1 text-sm border border-slate-100" 
              value={newCert} 
              onChange={e=>setNewCert(e.target.value)}
            />
            {/* BOTÓN CON ESTADOS VISUALES */}
            <button 
              onClick={addCert} 
              disabled={!newCert || !user} 
              className={`p-3 rounded-lg transition-all ${
                !user 
                  ? 'bg-gray-300 cursor-not-allowed text-gray-500' 
                  : !newCert 
                    ? 'bg-blue-300 text-white' 
                    : 'bg-blue-600 text-white active:scale-95 shadow-lg shadow-blue-200'
              }`}
            >
              {!user ? <Loader2 size={20} className="animate-spin"/> : <Plus size={20}/>}
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {['all','studying','passed'].map(f=>(<button key={f} onClick={()=>setFilter(f)} className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap border ${filter===f?'bg-slate-800 text-white':'bg-white text-slate-500'}`}>{f==='all'?'Todas':f==='studying'?'En Curso':'Listas'}</button>))}
        </div>

        {/* Lista */}
        <div className="space-y-3">
          {loading ? <div className="text-center"><Loader2 className="animate-spin mx-auto text-blue-500"/></div> : 
           certs.filter(c=>filter==='all'?true:c.status===filter).map(c=>{
            const d = getDaysRemaining(c.date);
            return (
              <div key={c.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 active:scale-[0.99] transition-transform">
                <div className="flex justify-between mb-2">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${getProviderColor(c.provider)}`}>{c.provider}</span>
                  <div className="flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-full border"><User size={10}/><span className="text-[10px] font-bold text-slate-600">{c.assignee}</span></div>
                </div>
                <h3 className={`font-bold text-sm ${c.status==='passed'?'line-through text-slate-400':'text-slate-800'}`}>{c.text}</h3>
                {d!==null && c.status==='studying' && <span className={`text-[10px] px-1.5 rounded ${d<=7?'text-red-600 bg-red-50':'text-slate-500 bg-slate-50'}`}>{d<0?'Vencida':`${d} días`}</span>}
                
                <div className="flex justify-between mt-3 pt-2 border-t border-slate-50">
                  <div className="flex gap-2">
                    <button onClick={()=>toggleStatus(c.id,c.status)} className={`p-1.5 rounded-full ${c.status==='passed'?'bg-green-100 text-green-600':'bg-slate-100 text-slate-400'}`}><CheckCircle size={16}/></button>
                    {getCalendarUrl(c) && <a href={getCalendarUrl(c)} target="_blank" rel="noreferrer" className="p-1.5 rounded-full bg-blue-50 text-blue-500"><CalendarPlus size={16}/></a>}
                    <button onClick={()=>{setSelectedCertForAI(c);setAiContent('');setAiModalOpen(true)}} className="p-1.5 rounded-full bg-purple-50 text-purple-500"><Sparkles size={16}/></button>
                  </div>
                  <button onClick={()=>deleteCert(c.id)} className="p-1.5 text-slate-300 hover:text-red-400"><Trash2 size={16}/></button>
                </div>
              </div>
            )})}
           {!loading && certs.length === 0 && <div className="text-center text-slate-400 text-xs py-8">No hay metas activas.</div>}
        </div>
      </div>

      {/* Modal IA */}
      {aiModalOpen && (
        <div className="absolute inset-0 z-50 bg-white flex flex-col animate-in slide-in-from-bottom">
          <div className="p-4 border-b flex justify-between"><h2 className="font-bold text-sm flex gap-2"><Sparkles size={16} className="text-purple-600"/> AI</h2><button onClick={()=>setAiModalOpen(false)}><X size={16}/></button></div>
          <div className="p-4 grid grid-cols-2 gap-3"><button onClick={()=>callGemini('plan')} className="bg-slate-50 p-3 rounded-lg text-xs font-bold flex flex-col items-center gap-2"><Calendar size={18} className="text-purple-500"/> Plan</button><button onClick={()=>callGemini('quiz')} className="bg-slate-50 p-3 rounded-lg text-xs font-bold flex flex-col items-center gap-2"><Brain size={18} className="text-pink-500"/> Quiz</button></div>
          <div className="flex-1 p-6 overflow-y-auto prose prose-sm">{aiLoading?<Loader2 className="animate-spin mx-auto text-purple-600"/>:<div className="whitespace-pre-wrap text-sm">{aiContent}</div>}</div>
        </div>
      )}
    </div>
  );
}