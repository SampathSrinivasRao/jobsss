import { useEffect, useRef, useState } from 'react';
import { Building2, Check, Globe2, ImagePlus, Save } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button, Field, PageHeader, Spinner } from '../../components/ui';

const emptyCompany = { name: '', website: '', industry: '', description: '', location: '', logo: '' };

export default function CompanyProfile() {
  const { refreshUser } = useAuth();
  const { toast } = useToast();
  const fileInput = useRef(null);
  const [company, setCompany] = useState(emptyCompany);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    api.get('/company').then((data) => { if (current) setCompany({ ...emptyCompany, ...(data || {}) }); }).catch((err) => { if (current) setError(err.message); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [retry]);

  const update = (event) => setCompany((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  const saveCompany = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const saved = await api.put('/company', Object.fromEntries(Object.keys(emptyCompany).filter((key) => key !== 'logo').map((key) => [key, company[key]])));
      setCompany((prev) => ({ ...prev, ...saved }));
      toast('Company profile saved.');
      await refreshUser();
    } catch (err) { toast(err.message || 'Could not save your company profile.', 'error'); }
    finally { setSaving(false); }
  };
  const uploadLogo = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return toast('Choose a JPG, PNG, or WebP image.', 'error');
    if (file.size > 5 * 1024 * 1024) return toast('Your logo must be smaller than 5 MB.', 'error');
    setUploading(true);
    try {
      const result = await api.upload('/company/logo', file);
      setCompany((prev) => ({ ...prev, logo: result.logo || result.url || result.company?.logo || prev.logo }));
      toast('Company logo updated.');
    } catch (err) { toast(err.message || 'Could not upload your logo.', 'error'); }
    finally { setUploading(false); }
  };

  return <div className="page-stack">
    <PageHeader eyebrow="MAKE A FIRST IMPRESSION" title="Company profile" description="Introduce your team, your mission, and what makes your workplace special." />
    {loading ? <div className="card p-12"><Spinner /></div> : error ? <div className="card p-6" role="alert"><p className="mb-4">{error}</p><Button variant="secondary" onClick={() => setRetry((n) => n + 1)}>Try again</Button></div> : <div className="grid gap-6 xl:grid-cols-[1fr_300px] items-start">
      <form onSubmit={saveCompany} className="card p-6 sm:p-8 space-y-7">
        <div><h2 className="font-semibold text-lg">Company details</h2><p className="text-sm text-slate-500 mt-1">This information is shown alongside your job openings.</p></div>
        <div className="flex flex-wrap gap-5 items-center pb-7 border-b border-slate-100"><div className="size-20 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">{company.logo ? <img src={typeof company.logo === 'string' ? company.logo : company.logo.url} alt={`${company.name || 'Company'} logo`} className="size-full object-contain p-2" /> : <Building2 size={30} className="text-slate-400" />}</div><div><input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadLogo} className="sr-only" aria-label="Upload company logo" /><Button type="button" variant="secondary" disabled={uploading || saving} onClick={() => fileInput.current?.click()}><ImagePlus size={16} />{uploading ? 'Uploading…' : 'Upload company logo'}</Button><p className="text-xs text-slate-500 mt-2">JPG, PNG, or WebP. Maximum 5 MB.</p></div></div>
        <div className="grid gap-5 sm:grid-cols-2"><Field label="Company name"><input className="input" name="name" value={company.name} onChange={update} placeholder="e.g. Acme Studio" required maxLength={120} /></Field><Field label="Industry"><input className="input" name="industry" value={company.industry} onChange={update} placeholder="e.g. Technology & design" required maxLength={100} /></Field><Field label="Website"><input className="input" type="url" name="website" value={company.website} onChange={update} placeholder="https://your-company.com" maxLength={500} /></Field><Field label="Headquarters"><input className="input" name="location" value={company.location} onChange={update} placeholder="e.g. Bengaluru, India" maxLength={150} /></Field></div>
        <Field label="About your company" hint="Share your mission, culture, and what candidates can look forward to."><textarea className="input resize-y min-h-44" name="description" value={company.description} onChange={update} rows={7} placeholder="We’re building…" maxLength={8000} required /></Field>
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center pt-5 border-t border-slate-100"><p className="text-xs text-slate-500">Your profile helps candidates get to know you.</p><Button type="submit" disabled={saving || uploading}><Save size={16} />{saving ? 'Saving…' : 'Save changes'}</Button></div>
      </form>
      <aside className="space-y-5"><div className="card p-6"><span className="text-[11px] font-semibold tracking-widest text-slate-500">PROFILE PREVIEW</span><div className="mt-5 size-14 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center overflow-hidden">{company.logo ? <img src={typeof company.logo === 'string' ? company.logo : company.logo.url} alt="" className="size-full object-contain p-1" /> : <Building2 size={25} />}</div><h2 className="font-semibold text-xl mt-4 break-words">{company.name || 'Your company'}</h2><p className="text-sm text-slate-500 mt-1">{company.industry || 'Your industry'}{company.location ? ` · ${company.location}` : ''}</p><p className="text-sm text-slate-600 mt-5 leading-relaxed whitespace-pre-line break-words">{company.description || 'Your story will appear here. Tell people what you’re building and why it matters.'}</p>{/^https?:\/\//i.test(company.website) && <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-sm text-emerald-700 font-medium inline-flex items-center gap-2 mt-5"><Globe2 size={15} />Visit website</a>}</div><div className="rounded-2xl bg-[#eaf4ee] p-6"><h3 className="font-semibold text-sm">A profile that connects</h3><ul className="mt-4 space-y-3 text-sm text-slate-600">{['Add a recognizable company logo', 'Describe the impact of your work', 'Show what makes your culture yours'].map((tip) => <li key={tip} className="flex gap-2"><Check size={16} className="text-emerald-700 shrink-0 mt-0.5" />{tip}</li>)}</ul></div></aside>
    </div>}
  </div>;
}
