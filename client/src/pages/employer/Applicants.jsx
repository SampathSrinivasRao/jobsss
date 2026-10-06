import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowUpRight, BriefcaseBusiness, Download, GraduationCap, GripVertical, Mail, MapPin, Search, Users } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { Badge, Button, EmptyState, Modal, PageHeader, Spinner } from '../../components/ui';

const stages = [
  { name: 'Applied', tone: 'blue', dot: 'bg-blue-500', background: 'bg-blue-50/50' },
  { name: 'Shortlisted', tone: 'amber', dot: 'bg-amber-500', background: 'bg-amber-50/50' },
  { name: 'Interviewing', tone: 'green', dot: 'bg-emerald-500', background: 'bg-emerald-50/50' },
  { name: 'Hired', tone: 'green', dot: 'bg-teal-700', background: 'bg-teal-50/50' },
  { name: 'Rejected', tone: 'gray', dot: 'bg-slate-400', background: 'bg-slate-100/60' },
];
const initials = (name = '') => name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?';
const displayDate = (date) => date ? new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date unavailable';
const person = (application) => ({ ...(application.applicant?.profile || {}), ...(application.snapshot || {}), name: application.snapshot?.name || application.applicant?.name || 'Applicant', email: application.snapshot?.email || application.applicant?.email || '' });

export default function Applicants() {
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const jobId = params.get('jobId') || '';
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [changing, setChanging] = useState('');
  const [selected, setSelected] = useState(null);
  const [downloading, setDownloading] = useState('');
  const [dropTarget, setDropTarget] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    const filters = new URLSearchParams();
    if (jobId) filters.set('jobId', jobId);
    if (query) filters.set('q', query);
    if (status) filters.set('status', status);
    Promise.all([api.get('/employer/jobs'), api.get(`/employer/applications?${filters}`)])
      .then(([jobData, applicationData]) => { if (current) { setJobs(jobData); setApplications(applicationData); } })
      .catch((err) => { if (current) setError(err.message || 'Could not load your hiring pipeline.'); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [jobId, query, status, refresh]);

  const changeStatus = async (application, nextStatus) => {
    if (changing || application.status === nextStatus) return;
    setChanging(application._id);
    try {
      const saved = await api.patch(`/applications/${application._id}/status`, { status: nextStatus });
      setApplications((prev) => prev.map((item) => item._id === application._id ? { ...item, status: nextStatus, statusHistory: saved.statusHistory } : item));
      setSelected((prev) => prev?._id === application._id ? { ...prev, status: nextStatus, statusHistory: saved.statusHistory } : prev);
      toast(`${person(application).name} moved to ${nextStatus.toLowerCase()}.`);
      setRefresh((value) => value + 1);
    } catch (err) { toast(err.message || 'Could not update this application.', 'error'); }
    finally { setChanging(''); }
  };
  const downloadResume = async (application) => {
    setDownloading(application._id);
    try {
      const result = await api.get(`/applications/${application._id}/resume`);
      if (!result.url) throw new Error('This application does not have a downloadable resume.');
      const link = document.createElement('a');
      link.href = result.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.download = person(application).resume?.originalName || 'resume';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) { toast(err.message || 'Could not download this resume.', 'error'); }
    finally { setDownloading(''); }
  };
  const drop = (event, nextStatus) => {
    event.preventDefault();
    setDropTarget('');
    const application = applications.find((item) => item._id === event.dataTransfer.getData('application/id'));
    if (application) changeStatus(application, nextStatus);
  };
  const candidate = selected ? person(selected) : null;
  const visibleStages = status ? stages.filter((stage) => stage.name === status) : stages;

  return <div className="page-stack">
    <PageHeader eyebrow="PEOPLE, NOT JUST APPLICATIONS" title="Applicant pipeline" description="Keep every conversation moving. Find, review, and connect with your next teammate." actions={<span className="inline-flex gap-2 items-center text-sm font-medium rounded-full bg-white border border-slate-200 px-4 py-2.5"><Users size={17} className="text-emerald-700" />{loading ? '…' : applications.length} applicants</span>} />
    <div className="card p-4 flex flex-col xl:flex-row gap-3"><div className="relative flex-1"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input className="input pl-10" value={search} onChange={(event) => setSearch(event.target.value)} maxLength={100} placeholder="Search applicants by name, email, or skill" aria-label="Search applicants" /></div><select className="input xl:w-64" value={jobId} onChange={(event) => setParams(event.target.value ? { jobId: event.target.value } : {})} aria-label="Filter by job"><option value="">All job openings</option>{jobs.map((job) => <option value={job._id} key={job._id}>{job.title}</option>)}</select><select className="input xl:w-48" value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by application status"><option value="">All stages</option>{stages.map((stage) => <option key={stage.name}>{stage.name}</option>)}</select></div>
    {loading ? <div className="card p-12"><Spinner /></div> : error ? <div className="card p-6" role="alert"><p className="mb-4">{error}</p><Button variant="secondary" onClick={() => setRefresh((value) => value + 1)}>Try again</Button></div> : <>
      <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-500"><span>Drag a card between stages, or use its status menu.</span><span>Application profiles reflect the information submitted.</span></div>
      {applications.length >= 500 && <p className="text-sm text-amber-800 bg-amber-50 rounded-xl p-3" role="status">Showing the latest 500 matching applications. Narrow your filters to find other applicants.</p>}
      <div className="overflow-x-auto pb-4 -mx-1 px-1" aria-label="Applicant kanban board"><div className={`grid gap-4 ${status ? 'grid-cols-1 max-w-md' : 'grid-cols-5 min-w-[1340px]'}`}>{visibleStages.map((stage) => {
        const cards = applications.filter((application) => application.status === stage.name);
        return <section key={stage.name} onDragOver={(event) => { event.preventDefault(); if (!changing) setDropTarget(stage.name); }} onDragLeave={() => setDropTarget('')} onDrop={(event) => drop(event, stage.name)} className={`rounded-2xl border p-3 min-h-96 transition-colors ${stage.background} ${dropTarget === stage.name ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-slate-200/70'}`} aria-label={`${stage.name} applicants`}><div className="flex items-center justify-between px-1 py-2 mb-3"><div className="flex items-center gap-2"><span className={`size-2 rounded-full ${stage.dot}`} /><h2 className="text-sm font-semibold">{stage.name}</h2><span className="text-xs text-slate-500 bg-white rounded px-1.5 py-0.5 border border-slate-200/60">{cards.length}</span></div></div>
          <div className="space-y-3">{cards.map((application) => {
            const applicant = person(application);
            return <article key={application._id} draggable={!changing} onDragStart={(event) => { event.dataTransfer.setData('application/id', application._id); event.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => setDropTarget('')} className="bg-white rounded-xl border border-slate-200 p-4 shadow-[0_2px_4px_rgba(20,40,30,0.02)]"><div className="flex items-start gap-3"><span className="size-10 shrink-0 rounded-full bg-[#edf3ef] text-emerald-800 flex items-center justify-center text-xs font-semibold">{initials(applicant.name)}</span><button type="button" onClick={() => setSelected(application)} className="text-left min-w-0 flex-1 group"><h3 className="text-sm font-semibold truncate group-hover:text-emerald-700">{applicant.name}</h3><p className="text-xs text-slate-500 mt-1 truncate">{applicant.headline || application.job?.title || 'Candidate'}</p></button><GripVertical size={15} className="text-slate-300 shrink-0 cursor-grab" aria-hidden="true" /></div><p className="text-xs text-slate-500 mt-4 flex gap-1.5 items-center"><BriefcaseBusiness size={13} className="shrink-0" /><span className="truncate">{application.job?.title || 'Job opening'}</span></p>{applicant.location && <p className="text-xs text-slate-500 mt-2 flex gap-1.5 items-center"><MapPin size={13} className="shrink-0" /><span className="truncate">{applicant.location}</span></p>}
              {!!applicant.skills?.length && <div className="flex flex-wrap gap-1.5 mt-3">{applicant.skills.slice(0, 3).map((skill) => <span key={skill} className="text-[10px] rounded px-2 py-1 bg-slate-50 text-slate-600 border border-slate-100">{skill}</span>)}{applicant.skills.length > 3 && <span className="text-[10px] py-1 text-slate-400">+{applicant.skills.length - 3}</span>}</div>}
              <div className="border-t border-slate-100 mt-4 pt-3 space-y-3"><p className="text-[10px] text-slate-400">Applied {displayDate(application.createdAt)}</p><select value={application.status} onChange={(event) => changeStatus(application, event.target.value)} disabled={!!changing} className="input text-xs! py-2!" aria-label={`Application status for ${applicant.name}`}>{stages.map((item) => <option key={item.name}>{item.name}</option>)}</select><div className="flex justify-between gap-2"><button type="button" onClick={() => setSelected(application)} className="text-xs text-emerald-700 font-medium inline-flex items-center gap-1">View profile <ArrowUpRight size={13} /></button><button type="button" onClick={() => downloadResume(application)} disabled={!!downloading} className="text-xs text-slate-500 hover:text-emerald-700 inline-flex items-center gap-1 disabled:opacity-50" aria-label={`Download resume for ${applicant.name}`}><Download size={13} />{downloading === application._id ? 'Loading…' : 'Resume'}</button></div></div>
            </article>;
          })}{!cards.length && <div className="border border-dashed border-slate-300/70 rounded-xl text-center px-3 py-10"><p className="text-xs text-slate-400">No applicants in this stage</p></div>}</div>
        </section>;
      })}</div></div>
      {!applications.length && <div className="card"><EmptyState icon={Users} title={query || status || jobId ? 'No applicants match these filters' : 'Your next teammate is out there'} description={query || status || jobId ? 'Try another job, stage, or search term.' : 'When candidates apply to your openings, you can review them and manage their progress here.'} action={(query || status || jobId) ? <Button variant="secondary" onClick={() => { setSearch(''); setQuery(''); setStatus(''); setParams({}); }}>Clear filters</Button> : undefined} /></div>}
    </>}
    <Modal open={!!selected} onClose={() => setSelected(null)} title="Applicant profile">{candidate && <div className="space-y-6"><div className="flex items-start gap-4"><div className="size-16 shrink-0 rounded-2xl bg-emerald-50 text-emerald-800 text-xl font-semibold flex items-center justify-center">{initials(candidate.name)}</div><div className="min-w-0"><h2 className="text-xl font-semibold break-words">{candidate.name}</h2><p className="text-sm text-slate-500 mt-1">{candidate.headline || 'Applicant'}</p><div className="flex flex-wrap gap-3 text-xs text-slate-500 mt-3">{candidate.email && <a href={`mailto:${candidate.email}`} className="flex gap-1 items-center break-all"><Mail size={13} />{candidate.email}</a>}{candidate.location && <span className="flex gap-1 items-center"><MapPin size={13} />{candidate.location}</span>}</div></div></div><div className="rounded-xl bg-slate-50 p-4 flex flex-wrap gap-3 justify-between items-center"><div><p className="text-xs text-slate-500">Applied for</p><p className="text-sm font-medium mt-1">{selected.job?.title}</p><p className="text-xs text-slate-500 mt-1">{displayDate(selected.createdAt)}</p></div><Badge tone={stages.find((stage) => stage.name === selected.status)?.tone}>{selected.status}</Badge></div>
      {candidate.summary && <section><h3 className="text-sm font-semibold mb-2">About</h3><p className="text-sm leading-relaxed text-slate-600 whitespace-pre-line">{candidate.summary}</p></section>}
      {!!candidate.skills?.length && <section><h3 className="text-sm font-semibold mb-3">Skills</h3><div className="flex flex-wrap gap-2">{candidate.skills.map((skill) => <Badge key={skill} tone="gray">{skill}</Badge>)}</div></section>}
      {!!candidate.experience?.length && <section><h3 className="text-sm font-semibold mb-3">Experience</h3><div className="space-y-4">{candidate.experience.map((item, index) => <div key={item._id || index} className="flex gap-3"><BriefcaseBusiness size={18} className="text-slate-400 mt-1 shrink-0" /><div><p className="text-sm font-medium">{item.title || item.role || item.position}</p><p className="text-sm text-slate-500">{item.company}</p>{(item.startDate || item.endDate || item.current) && <p className="text-xs text-slate-400 mt-1">{item.startDate ? displayDate(item.startDate) : ''} – {item.current ? 'Present' : item.endDate ? displayDate(item.endDate) : 'Present'}</p>}{item.description && <p className="text-sm text-slate-600 whitespace-pre-line mt-2">{item.description}</p>}</div></div>)}</div></section>}
      {!!candidate.education?.length && <section><h3 className="text-sm font-semibold mb-3">Education</h3><div className="space-y-4">{candidate.education.map((item, index) => <div key={item._id || index} className="flex gap-3"><GraduationCap size={18} className="text-slate-400 mt-1 shrink-0" /><div><p className="text-sm font-medium">{item.degree}{item.field ? ` · ${item.field}` : ''}</p><p className="text-sm text-slate-500">{item.institution || item.school}</p></div></div>)}</div></section>}
      <div className="border-t border-slate-100 pt-5 flex flex-wrap gap-3 items-end"><label className="text-xs font-medium text-slate-500 flex-1 min-w-40">Application status<select className="input mt-2" value={selected.status} disabled={!!changing} onChange={(event) => changeStatus(selected, event.target.value)}>{stages.map((stage) => <option key={stage.name}>{stage.name}</option>)}</select></label><Button onClick={() => downloadResume(selected)} disabled={!!downloading}><Download size={16} />{downloading === selected._id ? 'Loading…' : 'Download resume'}</Button></div>
    </div>}</Modal>
  </div>;
}
