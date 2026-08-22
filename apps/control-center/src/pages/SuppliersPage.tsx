import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { Supplier, SupplierStatus } from '@lihen/suppliers';
import { PageHeader } from '../components/PageHeader';
import { suppliersComposition } from '../composition/suppliers';

interface FormState { id: string | null; businessName: string; contactName: string; whatsapp: string; email: string; city: string; averageDeliveryDays: string; notes: string; status: SupplierStatus; }
const emptyForm: FormState = { id:null, businessName:'', contactName:'', whatsapp:'', email:'', city:'', averageDeliveryDays:'', notes:'', status:'ACTIVE' };

export function SuppliersPage() {
  const [rows,setRows]=useState<readonly Supplier[]>([]); const [form,setForm]=useState<FormState>(emptyForm); const [query,setQuery]=useState(''); const [message,setMessage]=useState(''); const [error,setError]=useState('');
  async function refresh(){ setRows(await suppliersComposition.getSuppliers.execute()); }
  useEffect(()=>{ refresh().catch((e)=>setError(e instanceof Error?e.message:'No fue posible cargar proveedores.')); },[]);
  const filtered=useMemo(()=>{const q=query.trim().toLowerCase(); return rows.filter((r)=>!q||r.businessName.toLowerCase().includes(q)||r.contactName?.toLowerCase().includes(q)||r.city?.toLowerCase().includes(q));},[rows,query]);
  function edit(row:Supplier){setForm({id:row.id,businessName:row.businessName,contactName:row.contactName??'',whatsapp:row.whatsapp??'',email:row.email??'',city:row.city??'',averageDeliveryDays:row.averageDeliveryDays==null?'':String(row.averageDeliveryDays),notes:row.notes??'',status:row.status}); setMessage(''); setError('');}
  async function submit(event:FormEvent){ event.preventDefault(); setMessage(''); setError(''); const days=form.averageDeliveryDays.trim()===''?null:Number(form.averageDeliveryDays); if(days!==null&&(!Number.isInteger(days)||days<0)){setError('Los días promedio deben ser un entero mayor o igual a cero.');return;} try{const supplierId=form.id??suppliersComposition.ids.generate(); const command={operationKey:`supplier:${form.id?'update':'create'}:${crypto.randomUUID()}`,supplierId,businessName:form.businessName,contactName:form.contactName.trim()||null,whatsapp:form.whatsapp.trim()||null,email:form.email.trim()||null,city:form.city.trim()||null,averageDeliveryDays:days,notes:form.notes.trim()||null,status:form.status} as const; if(form.id) await suppliersComposition.updateSupplier.execute(command); else await suppliersComposition.createSupplier.execute(command); setForm(emptyForm); setMessage('Proveedor guardado mediante operación controlada.'); await refresh(); }catch(e){setError(e instanceof Error?e.message:'No fue posible guardar el proveedor.');}}
  return <section className="stack"><PageHeader title="Proveedores" description="FASE 2.5A · identidad canónica de proveedores. No importa ni enlaza automáticamente registros legacy." />
    <div className="info-state"><strong>Fuente controlada</strong><p>Crear o editar un proveedor no modifica productos, inventario, compras ni caja.</p></div>
    {suppliersComposition.canWrite?<form className="card stack" onSubmit={submit}><h2>{form.id?'Editar proveedor':'Nuevo proveedor'}</h2><div className="form-grid">
      <label><span>Razón / nombre comercial</span><input required value={form.businessName} onChange={(e)=>setForm({...form,businessName:e.target.value})}/></label>
      <label><span>Contacto</span><input value={form.contactName} onChange={(e)=>setForm({...form,contactName:e.target.value})}/></label>
      <label><span>WhatsApp</span><input value={form.whatsapp} onChange={(e)=>setForm({...form,whatsapp:e.target.value})}/></label>
      <label><span>Email</span><input type="email" value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})}/></label>
      <label><span>Ciudad</span><input value={form.city} onChange={(e)=>setForm({...form,city:e.target.value})}/></label>
      <label><span>Días promedio de entrega</span><input type="number" min="0" step="1" value={form.averageDeliveryDays} onChange={(e)=>setForm({...form,averageDeliveryDays:e.target.value})}/></label>
      <label><span>Estado</span><select value={form.status} onChange={(e)=>setForm({...form,status:e.target.value as SupplierStatus})}><option value="ACTIVE">Activo</option><option value="INACTIVE">Inactivo</option></select></label>
      <label><span>Notas</span><input value={form.notes} onChange={(e)=>setForm({...form,notes:e.target.value})}/></label>
    </div><div className="toolbar"><button type="submit">{form.id?'Guardar cambios':'Crear proveedor'}</button>{form.id?<button type="button" onClick={()=>setForm(emptyForm)}>Cancelar edición</button>:null}</div></form>:<div className="warning-state">Escritura de proveedores bloqueada.</div>}
    {message?<div className="info-state" role="status">{message}</div>:null}{error?<div className="error-state" role="alert">{error}</div>:null}
    <div className="card stack"><div className="toolbar"><input placeholder="Buscar proveedor" value={query} onChange={(e)=>setQuery(e.target.value)}/></div><div className="table-wrap"><table><thead><tr><th>Proveedor</th><th>Contacto</th><th>Ciudad</th><th>Entrega</th><th>Estado</th><th></th></tr></thead><tbody>{filtered.map((r)=><tr key={r.id}><td><strong>{r.businessName}</strong></td><td>{r.contactName??'—'}<br/><small>{r.whatsapp??r.email??''}</small></td><td>{r.city??'—'}</td><td>{r.averageDeliveryDays==null?'—':`${r.averageDeliveryDays} días`}</td><td>{r.status}</td><td><button type="button" onClick={()=>edit(r)}>Editar</button></td></tr>)}</tbody></table></div>{filtered.length===0?<p>No hay proveedores canónicos todavía.</p>:null}</div>
  </section>;
}
