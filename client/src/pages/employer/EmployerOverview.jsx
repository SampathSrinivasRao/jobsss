import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BriefcaseBusiness, Building2, CalendarDays, Check, Plus, Users } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { Badge, Button, EmptyState, PageHeader, Spinner } from '../../components/ui';

const statusTone = { Applied: 'blue', Shortlisted: 'amber', Interviewing: 'green', Rejected: 'red', Hired: 'green' };

export default function EmployerOverview() {
  const { user } = useAuth();
  const [data, setData] = useState({ jobs: [], applications: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    Promise.all([api.get('/employer/jobs'), api.get('/employer/applications')])
      .then(([jobs, applications]) => { if (current) setData({ jobs, applications }); })
      .catch((err) => { if (current) setError(err.message || 'Your dashboard could not be loaded.'); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [retry]);

  const stats = [
    { label: 'Active jobs', value: data.jobs.filter((job) => job.status === 'active').length, icon: BriefcaseBusiness, detail: 'Open for applications', tint: 'bg-emerald-50 text-emerald-700' },
    { label: 'Total applicants', value: data.jobs.reduce((total, job) => total + (job.applicantsCount || 0), 0), icon: Users, detail: 'Across all your openings', tint: 'bg-blue-50 text-blue-600' },
    { label: 'In interviews', value: data.applications.filter((app) => app.status === 'Interviewing').length, icon: CalendarDays, detail: data.applications.length >= 500 ? 'Among the latest 500 applications' : 'Getting to know your team', tint: 'bg-amber-50 text-amber-600' },
    { label: 'Hired', value: data.applications.filter((app) => app.status === 'Hired').length, icon: Check, detail: data.applications.length >= 500 ? 'Among the latest 500 applications' : 'New beginnings', tint: 'bg-violet-50 text-violet-600' },
  ];

  return (
    <div className="page-stack">
      <PageHeader eyebrow="YOUR HIRING WORKSPACE" title={`Welcome back, ${user?.name?.split(' ')[0] || 'there'}`} description="Great teams start with the right connection. Here’s where your hiring stands." actions={<Link className="btn btn-primary" to="/employer/jobs?new=1"><Plus size={17} /> Post a job</Link>} />
      {error ? <div role="alert" className="card p-6 flex flex-wrap items-center justify-between gap-4"><p>{error}</p><Button variant="secondary" onClick={() => setRetry((n) => n + 1)}>Try again</Button></div> : loading ? <div className="card p-12"><Spinner /></div> : <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats.map(({ label, value, icon: Icon, detail, tint }) => <div key={label} className="card p-5"><div className="flex items-center justify-between"><span className="text-sm text-slate-500">{label}</span><span className={`p-2.5 rounded-xl ${tint}`}><Icon size={19} /></span></div><p className="text-3xl font-semibold tracking-tight mt-4">{value}</p><p className="text-xs text-slate-500 mt-2">{detail}</p></div>)}</div>
        <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
          <section className="card overflow-hidden"><div className="px-6 py-5 border-b border-slate-100 flex flex-wrap justify-between items-center gap-3"><div><h2 className="font-semibold text-lg">Your job openings</h2><p className="text-sm text-slate-500 mt-1">Keep good opportunities moving.</p></div><Link to="/employer/jobs" className="text-sm font-semibold text-emerald-700 flex items-center gap-2">View all <ArrowRight size={15} /></Link></div>
            {data.jobs.length ? <div className="divide-y divide-slate-100">{data.jobs.slice(0, 5).map((job) => <Link key={job._id} to={`/employer/applicants?jobId=${job._id}`} className="flex items-center gap-4 px-6 py-5 hover:bg-slate-50 transition-colors"><span className="hidden sm:flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><BriefcaseBusiness size={20} /></span><div className="min-w-0 flex-1"><h3 className="font-medium truncate">{job.title}</h3><p className="text-xs text-slate-500 mt-1">{job.location || 'Location flexible'} · {job.jobType}</p></div><div className="text-right shrink-0"><Badge tone={job.status === 'active' ? 'green' : 'gray'}>{job.status}</Badge><p className="text-xs text-slate-500 mt-2">{job.applicantsCount || 0} applicants</p></div><ArrowRight size={16} className="text-slate-400" /></Link>)}</div> : <EmptyState icon={BriefcaseBusiness} title="Your next great hire starts here" description="Publish your first opening and give talented people a reason to join." action={<Link to="/employer/jobs?new=1" className="btn btn-primary">Create a job</Link>} />}
          </section>
          <section className="card overflow-hidden"><div className="px-6 py-5 border-b border-slate-100"><h2 className="font-semibold text-lg">Recent applicants</h2><p className="text-sm text-slate-500 mt-1">Meet the people behind the profiles.</p></div>
            {data.applications.length ? <div className="divide-y divide-slate-100">{[...data.applications].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5).map((application) => <Link key={application._id} to={`/employer/applicants?jobId=${application.job?._id || ''}`} className="px-6 py-4 flex items-center gap-3 hover:bg-slate-50"><div className="size-10 rounded-full bg-amber-50 text-amber-800 flex items-center justify-center font-semibold shrink-0">{application.applicant?.name?.slice(0, 1) || '?'}</div><div className="flex-1 min-w-0"><p className="font-medium text-sm truncate">{application.applicant?.name || 'Applicant'}</p><p className="text-xs text-slate-500 truncate mt-1">{application.job?.title || 'Job opening'}</p></div><Badge tone={statusTone[application.status]}>{application.status}</Badge></Link>)}</div> : <EmptyState icon={Users} title="A little quiet, for now" description="Applications will appear here as soon as people apply to your jobs." />}
          </section>
        </div>
        <section className="rounded-2xl bg-[#eaf4ee] border border-[#d9e8df] px-6 py-6 flex flex-col sm:flex-row items-start sm:items-center gap-5"><span className="rounded-2xl bg-white p-3 text-emerald-800"><Building2 size={26} /></span><div className="flex-1"><h2 className="font-semibold">Tell your company’s story</h2><p className="text-sm text-slate-600 mt-1">A thoughtful company profile helps the right people picture their future with you.</p></div><Link to="/employer/company" className="btn btn-secondary bg-white whitespace-nowrap">Edit company profile <ArrowRight size={16} /></Link></section>
      </>}
    </div>
  );
}
