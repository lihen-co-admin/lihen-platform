import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { Purchase } from '@lihen/procurement';
import type { Supplier, SupplierStatus } from '@lihen/suppliers';
import { AdminPageHero } from '../components/AdminPageHero';
import { IntelligencePanel, type IntelligenceInsight } from '../components/IntelligencePanel';
import { OperationalNotice } from '../components/OperationalNotice';
import { SummaryStrip } from '../components/SummaryStrip';
import { suppliersComposition } from '../composition/suppliers';
import { procurementComposition } from '../composition/procurement';

interface FormState { id: string | null; businessName: string; contactName: string; whatsapp: string; email: string; city: string; averageDeliveryDays: string; notes: string; status: SupplierStatus; }
const emptyForm: FormState = { id:null, businessName:'', contactName:'', whatsapp:'', email:'', city:'', averageDeliveryDays:'', notes:'', status:'ACTIVE' };

export function SuppliersPage() {
  const [rows,setRows]=useState<readonly Supplier[]>([]); const [purchases,setPurchases]=useState<readonly Purchase[]>([]); const [form,setForm]=useState<FormState>(emptyForm); const [query,setQuery]=useState(''); const [message,setMessage]=useState(''); const [error,setError]=useState('');
  async function refresh(){ const [supplierRows,purchaseRows]=await Promise.all([suppliersComposition.getSuppliers.execute(),procurementComposition.getPurchases.execute()]); setRows(supplierRows); setPurchases(purchaseRows); }
  useEffect(()=>{ refresh().catch((e)=>setError(e instanceof Error?e.message:'No fue posible cargar proveedores.')); },[]);
  const filtered=useMemo(()=>{const q=query.trim().toLowerCase(); return rows.filter((r)=>!q||r.businessName.toLowerCase().includes(q)||r.contactName?.toLowerCase().includes(q)||r.city?.toLowerCase().includes(q));},[rows,query]);
  const activeCount=useMemo(()=>rows.filter((row)=>row.status==='ACTIVE').length,[rows]);
  const withDeliveryDays=useMemo(()=>rows.filter((row)=>row.averageDeliveryDays!==null).length,[rows]);
  const openPurchasesBySupplier=useMemo(()=>{const counts=new Map<string,number>(); for(const purchase of purchases){if(['CONFIRMED','PARTIALLY_RECEIVED'].includes(purchase.status)) counts.set(purchase.supplierId,(counts.get(purchase.supplierId)??0)+1);} return counts;},[purchases]);
  const openSupplyCount=useMemo(()=>Array.from(openPurchasesBySupplier.values()).reduce((sum,count)=>sum+count,0),[openPurchasesBySupplier]);
  const intelligence=useMemo<readonly IntelligenceInsight[]>(()=>{
    const insights:IntelligenceInsight[]=[];
    const withoutContact=rows.filter((row)=>!row.whatsapp&&!row.email).length;
    if(withoutContact>0) insights.push({id:'supplier-contact',severity:'WARNING',title:`${withoutContact} proveedores sin canal de contacto`,explanation:'Completar WhatsApp o email mejora seguimiento de compras sin alterar Product Master.',source:'proveedores canónicos'});
    if(rows.length>0&&withDeliveryDays<rows.length) insights.push({id:'supplier-lead-time',severity:'INFO',title:`${rows.length-withDeliveryDays} proveedores sin plazo promedio`,explanation:'Registrar días promedio permite enriquecer la lectura operativa de compras y entregas.',source:'proveedores canónicos'});
    const inactiveWithOpenPurchases=rows.filter((row)=>row.status==='INACTIVE'&&(openPurchasesBySupplier.get(row.id)??0)>0);
    if(inactiveWithOpenPurchases.length>0) insights.push({id:'supplier-inactive-open-purchases',severity:'WARNING',title:`${inactiveWithOpenPurchases.length} proveedor${inactiveWithOpenPurchases.length===1?'':'es'} inactivo${inactiveWithOpenPurchases.length===1?'':'s'} con compras abiertas`,explanation:'La compra histórica conserva su proveedor, pero no deberían originarse nuevas decisiones de abastecimiento sin revisar el Supplier Master.',actionLabel:'Abrir compras',targetRoute:'/purchases',source:'Supplier Master + Purchase Master'});
    return insights;
  },[rows,withDeliveryDays,openPurchasesBySupplier]);
  function edit(row:Supplier){setForm({id:row.id,businessName:row.businessName,contactName:row.contactName??'',whatsapp:row.whatsapp??'',email:row.email??'',city:row.city??'',averageDeliveryDays:row.averageDeliveryDays==null?'':String(row.averageDeliveryDays),notes:row.notes??'',status:row.status}); setMessage(''); setError('');}
  async function submit(event:FormEvent){ event.preventDefault(); setMessage(''); setError(''); const days=form.averageDeliveryDays.trim()===''?null:Number(form.averageDeliveryDays); if(days!==null&&(!Number.isInteger(days)||days<0)){setError('Los días promedio deben ser un entero mayor o igual a cero.');return;} try{const supplierId=form.id??suppliersComposition.ids.generate(); const command={operationKey:`supplier:${form.id?'update':'create'}:${crypto.randomUUID()}`,supplierId,businessName:form.businessName,contactName:form.contactName.trim()||null,whatsapp:form.whatsapp.trim()||null,email:form.email.trim()||null,city:form.city.trim()||null,averageDeliveryDays:days,notes:form.notes.trim()||null,status:form.status} as const; if(form.id) await suppliersComposition.updateSupplier.execute(command); else await suppliersComposition.createSupplier.execute(command); setForm(emptyForm); setMessage('Proveedor guardado mediante operación controlada.'); await refresh(); }catch(e){setError(e instanceof Error?e.message:'No fue posible guardar el proveedor.');}}
  return <section className="stack">
    <AdminPageHero title="Proveedores" description="Administra la identidad canónica de proveedores y su información operativa sin mezclar compras, inventario o finanzas." accent="gold" status={<span className={`status-badge ${suppliersComposition.canWrite?'status-badge--success':'status-badge--warning'}`}>{suppliersComposition.canWrite?'Escritura controlada':'Solo lectura'}</span>}/>
    <SummaryStrip items={[{label:'Proveedores',value:rows.length},{label:'Activos',value:activeCount},{label:'Compras abiertas',value:openSupplyCount,detail:'Confirmadas / parciales'},{label:'Con plazo registrado',value:withDeliveryDays}]}/>
    <OperationalNotice title="Responsabilidad separada" meta="Supplier Master → Compras">Crear o editar un proveedor no modifica productos, inventario, compras ni caja. Los efectos operativos pertenecen a sus propios comandos de dominio.</OperationalNotice>
    {intelligence.length>0?<IntelligencePanel title="Señales de proveedores" description="Recomendaciones read-only basadas en completitud operativa." insights={intelligence}/>:null}
    {suppliersComposition.canWrite?<form className="card stack admin-form-card" onSubmit={submit}><div className="card-heading"><div><span className="card-label">Supplier Master</span><h2>{form.id?'Editar proveedor':'Nuevo proveedor'}</h2></div>{form.id?<button type="button" className="button-link button-link--secondary" onClick={()=>setForm(emptyForm)}>Cancelar edición</button>:null}</div><div className="form-grid">
      <label><span>Razón / nombre comercial</span><input required value={form.businessName} onChange={(e)=>setForm({...form,businessName:e.target.value})}/></label>
      <label><span>Contacto</span><input value={form.contactName} onChange={(e)=>setForm({...form,contactName:e.target.value})}/></label>
      <label><span>WhatsApp</span><input value={form.whatsapp} onChange={(e)=>setForm({...form,whatsapp:e.target.value})}/></label>
      <label><span>Email</span><input type="email" value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})}/></label>
      <label><span>Ciudad</span><input value={form.city} onChange={(e)=>setForm({...form,city:e.target.value})}/></label>
      <label><span>Días promedio de entrega</span><input type="number" min="0" step="1" value={form.averageDeliveryDays} onChange={(e)=>setForm({...form,averageDeliveryDays:e.target.value})}/></label>
      <label><span>Estado</span><select value={form.status} onChange={(e)=>setForm({...form,status:e.target.value as SupplierStatus})}><option value="ACTIVE">Activo</option><option value="INACTIVE">Inactivo</option></select></label>
      <label className="form-field--wide"><span>Notas</span><input value={form.notes} onChange={(e)=>setForm({...form,notes:e.target.value})}/></label>
    </div><div className="form-actions"><button type="submit">{form.id?'Guardar cambios':'Crear proveedor'}</button></div></form>:<OperationalNotice title="Escritura protegida" tone="warning">Activa únicamente el modo controlado correspondiente en DEV para crear o editar proveedores.</OperationalNotice>}
    {message?<OperationalNotice title="Cambio registrado" tone="success">{message}</OperationalNotice>:null}{error?<div className="error-state" role="alert">{error}</div>:null}
    <div className="table-card"><div className="table-summary"><strong>{filtered.length} proveedores</strong><span>Identidad y datos operativos</span></div><div className="table-toolbar"><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Buscar nombre, contacto o ciudad"/></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Proveedor</th><th>Contacto</th><th>Ciudad</th><th>Entrega</th><th>Compras abiertas</th><th>Estado</th><th></th></tr></thead><tbody>{filtered.map((r)=><tr key={r.id}><td><strong>{r.businessName}</strong></td><td>{r.contactName??'—'}<br/><small>{r.whatsapp??r.email??'Sin canal'}</small></td><td>{r.city??'—'}</td><td>{r.averageDeliveryDays==null?'—':`${r.averageDeliveryDays} días`}</td><td>{openPurchasesBySupplier.get(r.id)??0}</td><td><span className={`product-status product-status--${r.status==='ACTIVE'?'active':'inactive'}`}>{r.status==='ACTIVE'?'Activo':'Inactivo'}</span></td><td className="align-right">{suppliersComposition.canWrite?<button type="button" className="table-action" onClick={()=>edit(r)}>Editar</button>:null}</td></tr>)}</tbody></table></div></div>
  </section>;
}
