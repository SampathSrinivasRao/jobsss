import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Archive, ArrowRight, BriefcaseBusiness, CircleDollarSign, MapPin, Pause, Pencil, Play, Plus, Search, Sparkles, Users } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { Badge, Button, EmptyState, Field, Modal, PageHeader, Spinner } from '../../components/ui';

const blankJob = { title: '', description: '', skills: '', salaryMin: '', salaryMax: '', currency: 'INR', location: '', jobType: 'Remote', experienceLevel: 'Mid', employmentType: 'Full-time', status: 'active' };
const salary = (job) => {
  if (!job.salaryMin && !job.salaryMax) return 'Salary not specified';
  const format = (value) => new Intl.NumberFormat('en', { style: 'currency', currency: job.currency || 'INR', maximumFractionDigits: 0, notation: 'compact' }).format(value);
  return `${format(job.salaryMin || 0)} – ${format(job.salaryMax || job.salaryMin)} / year`;
};

export default function EmployerJobs() {
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [editor, setEditor] = useState(null);
  const [form, setForm] = useState(blankJob);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [changing, setChanging] = useState('');
  const [archiveJob, setArchiveJob] = useState(null);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    api.get('/employer/jobs').then((data) => { if (current) setJobs(data); }).catch((err) => { if (current) setError(err.message); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [retry]);

  useEffect(() => {
    if (params.get('new') === '1') {
      setForm({ ...blankJob });
      setEditor('new');
      setFormError('');
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const startEdit = (job) => {
    setForm(job ? { ...blankJob, ...job, skills: (job.skills || []).join(', ') } : { ...blankJob });
    setEditor(job?._id || 'new');
    setFormError('');
  };
  const update = (event) => setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  const skillsArray = () => [...new Set(form.skills.split(',').map((skill) => skill.trim()).filter(Boolean))];
  const save = async (event) => {
    event.preventDefault();
    setFormError('');
    if (Number(form.salaryMin) > Number(form.salaryMax)) return setFormError('Maximum salary must be at least the minimum salary.');
    if (skillsArray().length === 0) return setFormError('Add at least one required skill.');
    if (skillsArray().length > 50 || skillsArray().some((skill) => skill.length > 60)) return setFormError('Use up to 50 skills, with no more than 60 characters per skill.');
    setSaving(true);
    const payload = Object.fromEntries(Object.keys(blankJob).map((key) => [key, form[key]]));
    payload.skills = skillsArray();
    payload.salaryMin = Number(form.salaryMin);
    payload.salaryMax = Number(form.salaryMax);
    try {
      const saved = editor === 'new' ? await api.post('/jobs', payload) : await api.patch(`/jobs/${editor}`, payload);
      setJobs((prev) => editor === 'new' ? [saved, ...prev] : prev.map((job) => job._id === editor ? { ...job, ...saved } : job));
      setEditor(null);
      toast(editor === 'new' ? 'Your job is published.' : 'Job updated.');
    } catch (err) { setFormError(err.message || 'Could not save this job.'); }
    finally { setSaving(false); }
  };
  const generateDescription = async () => {
    if (!form.title.trim()) return setFormError('Enter a job title before generating a description.');
    setGenerating(true);
    setFormError('');
    try {
      const result = await api.post('/ai/job-description', { title: form.title, skills: skillsArray(), experienceLevel: form.experienceLevel });
      setForm((prev) => ({ ...prev, description: result.description, skills: result.skills?.length ? result.skills.join(', ') : prev.skills }));
      toast('Description drafted. Review it before publishing.');
    } catch (err) { setFormError(err.message || 'The AI service is unavailable. You can write your description below.'); }
    finally { setGenerating(false); }
  };
  const changeStatus = async (job, nextStatus) => {
    setChanging(job._id);
    try {
      const result = nextStatus === 'archived' ? await api.delete(`/jobs/${job._id}`) : await api.patch(`/jobs/${job._id}`, { status: nextStatus });
      setJobs((prev) => prev.map((item) => item._id === job._id ? { ...item, ...(result?._id ? result : {}), status: nextStatus } : item));
      toast(`Job ${nextStatus === 'active' ? 'reopened' : nextStatus}.`);
      setArchiveJob(null);
    } catch (err) { toast(err.message, 'error'); }
    finally { setChanging(''); }
  };
  const filteredJobs = jobs.filter((job) => (status === 'all' || status === job.status) && `${job.title} ${job.location} ${job.skills?.join(' ')}`.toLowerCase().includes(search.toLowerCase()));

  return <div className="page-stack">
    <PageHeader eyebrow="BUILD YOUR NEXT GREAT TEAM" title="Job openings" description="Create opportunities, find your people, and keep your hiring on track." actions={<Button onClick={() => startEdit()}><Plus size={17} />Post a job</Button>} />
    <div className="flex flex-col lg:flex-row lg:items-center gap-4 justify-between"><div className="flex flex-wrap gap-1 rounded-xl bg-white border border-slate-200 p-1.5 w-fit">{['all', 'active', 'paused', 'archived'].map((tab) => <button type="button" key={tab} onClick={() => setStatus(tab)} className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors ${status === tab ? 'bg-[#eaf4ee] text-emerald-800' : 'text-slate-500 hover:bg-slate-50'}`} aria-pressed={status === tab}>{tab[0].toUpperCase() + tab.slice(1)} <span className="ml-1 text-xs opacity-70">{tab === 'all' ? jobs.length : jobs.filter((job) => job.status === tab).length}</span></button>)}</div><div className="relative w-full lg:w-72"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} /><input className="input pl-10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your jobs" aria-label="Search your jobs" /></div></div>
    {loading ? <div className="card p-12"><Spinner /></div> : error ? <div className="card p-6" role="alert"><p className="mb-4">{error}</p><Button variant="secondary" onClick={() => setRetry((n) => n + 1)}>Try again</Button></div> : filteredJobs.length ? <div className="grid gap-4">{filteredJobs.map((job) => <article key={job._id} className="card p-5 sm:p-6"><div className="flex gap-4 items-start"><div className="hidden sm:flex size-12 shrink-0 items-center justify-center bg-emerald-50 rounded-xl text-emerald-700"><BriefcaseBusiness size={22} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-3"><h2 className="font-semibold text-lg">{job.title}</h2><Badge tone={job.status === 'active' ? 'green' : job.status === 'paused' ? 'amber' : 'gray'}>{job.status}</Badge></div><div className="flex flex-wrap text-sm text-slate-500 gap-x-5 gap-y-2 mt-3"><span className="inline-flex gap-1.5 items-center"><MapPin size={15} />{job.location} · {job.jobType}</span><span className="inline-flex gap-1.5 items-center"><BriefcaseBusiness size={15} />{job.employmentType || 'Full-time'} · {job.experienceLevel}</span><span className="inline-flex gap-1.5 items-center"><CircleDollarSign size={15} />{salary(job)}</span></div><div className="flex flex-wrap gap-2 mt-4">{job.skills?.slice(0, 5).map((skill) => <span key={skill} className="bg-slate-50 border border-slate-100 rounded-md px-2.5 py-1 text-xs text-slate-600">{skill}</span>)}{job.skills?.length > 5 && <span className="text-xs text-slate-500 py-1">+{job.skills.length - 5} more</span>}</div></div></div><div className="flex flex-wrap items-center justify-between border-t border-slate-100 pt-4 mt-5 gap-4"><Link to={`/employer/applicants?jobId=${job._id}`} className="text-sm font-medium text-emerald-700 inline-flex gap-2 items-center"><Users size={16} />{job.applicantsCount || 0} applicants <ArrowRight size={15} /></Link><div className="flex gap-2 flex-wrap"><Button variant="ghost" onClick={() => startEdit(job)} disabled={changing === job._id}><Pencil size={15} />Edit</Button><Button variant="secondary" onClick={() => changeStatus(job, job.status === 'active' ? 'paused' : 'active')} disabled={changing === job._id}>{job.status === 'active' ? <Pause size={15} /> : <Play size={15} />}{changing === job._id ? 'Updating…' : job.status === 'active' ? 'Pause' : 'Reopen'}</Button>{job.status !== 'archived' && <Button variant="ghost" onClick={() => setArchiveJob(job)} disabled={changing === job._id} aria-label={`Archive ${job.title}`}><Archive size={16} /></Button>}</div></div></article>)}</div> : <div className="card"><EmptyState icon={BriefcaseBusiness} title={jobs.length ? 'No matching openings' : 'Make room for someone great'} description={jobs.length ? 'Try another search or status to find your job.' : 'Create your first job opening. Your next teammate could be one application away.'} action={jobs.length ? <Button variant="secondary" onClick={() => { setSearch(''); setStatus('all'); }}>Clear filters</Button> : <Button onClick={() => startEdit()}><Plus size={16} />Post your first job</Button>} /></div>}
    <Modal open={!!editor} onClose={() => { if (!saving && !generating) setEditor(null); }} title={editor === 'new' ? 'Create a job opening' : 'Edit job opening'}>
      <form onSubmit={save} className="space-y-5"><p className="text-sm text-slate-500">Be clear about the role, the work, and what success looks like.</p>{formError && <p className="rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm p-3" role="alert">{formError}</p>}<Field label="Job title"><input className="input" name="title" value={form.title} onChange={update} placeholder="e.g. Senior Product Designer" required maxLength={160} disabled={generating} /></Field>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Location"><input className="input" name="location" value={form.location} onChange={update} placeholder="e.g. Bengaluru, India" required maxLength={150} /></Field><Field label="Work arrangement"><select className="input" name="jobType" value={form.jobType} onChange={update}>{['Remote', 'Hybrid', 'Onsite'].map((type) => <option key={type}>{type}</option>)}</select></Field><Field label="Experience level"><select className="input" name="experienceLevel" value={form.experienceLevel} onChange={update} disabled={generating}>{['Entry', 'Mid', 'Senior', 'Lead'].map((level) => <option key={level}>{level}</option>)}</select></Field><Field label="Employment type"><select className="input" name="employmentType" value={form.employmentType} onChange={update}>{['Full-time', 'Part-time', 'Contract', 'Internship'].map((type) => <option key={type}>{type}</option>)}</select></Field></div>
        <Field label="Required skills" hint="Separate skills with commas."><input className="input" name="skills" value={form.skills} onChange={update} placeholder="React, TypeScript, Figma" required maxLength={2000} disabled={generating} /></Field>
        <div className="rounded-xl bg-[#f1f6f3] border border-[#dce8e0] p-4 flex flex-wrap items-center gap-3"><Sparkles size={20} className="text-emerald-700 shrink-0" /><div className="flex-1 min-w-40"><p className="font-medium text-sm">A little help with the first draft</p><p className="text-xs text-slate-500 mt-1">Generate a description from the title and skills above.</p></div><Button type="button" variant="secondary" onClick={generateDescription} disabled={generating || saving}>{generating ? 'Writing…' : 'Draft with AI'}</Button></div>
        <Field label="Job description" hint="Review AI generated content for accuracy before publishing."><textarea className="input min-h-52 resize-y" name="description" rows={8} value={form.description} onChange={update} placeholder="About the role, responsibilities, qualifications, and benefits…" required minLength={50} maxLength={16000} disabled={generating} /></Field>
        <div className="grid gap-4 sm:grid-cols-3"><Field label="Currency"><select className="input" name="currency" value={form.currency} onChange={update}>{['INR', 'USD', 'EUR', 'GBP'].map((currency) => <option key={currency}>{currency}</option>)}</select></Field><Field label="Annual salary from"><input className="input" type="number" name="salaryMin" value={form.salaryMin} onChange={update} min="0" step="1" max="1000000000" required placeholder="500000" /></Field><Field label="Annual salary to"><input className="input" type="number" name="salaryMax" value={form.salaryMax} onChange={update} min={form.salaryMin || 0} step="1" max="1000000000" required placeholder="1000000" /></Field></div>
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100"><Button type="button" variant="secondary" onClick={() => setEditor(null)} disabled={saving || generating}>Cancel</Button><Button type="submit" disabled={saving || generating}>{saving ? 'Saving…' : editor === 'new' ? 'Publish job' : 'Save changes'}<ArrowRight size={16} /></Button></div>
      </form>
    </Modal>
    <Modal open={!!archiveJob} onClose={() => { if (!changing) setArchiveJob(null); }} title="Archive this opening?"><p className="text-sm text-slate-600 leading-relaxed">“{archiveJob?.title}” will stop accepting applications. Existing applications stay in your pipeline, and you can reopen the job later.</p><div className="flex justify-end gap-3 mt-6"><Button variant="secondary" onClick={() => setArchiveJob(null)} disabled={!!changing}>Keep open</Button><Button variant="danger" onClick={() => changeStatus(archiveJob, 'archived')} disabled={!!changing}>{changing ? 'Archiving…' : 'Archive job'}</Button></div></Modal>
  </div>;
}
