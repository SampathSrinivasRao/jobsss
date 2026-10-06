import { NavLink, Link, Outlet, useLocation } from 'react-router-dom';
import { BriefcaseBusiness, Search, LayoutDashboard, FileText, UserRound, Building2, UsersRound, LogOut, Menu, X, ChevronRight, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { initials } from '../lib/utils';

export function Brand() { return <Link to="/" className="brand"><span className="brand-mark"><BriefcaseBusiness size={22} strokeWidth={2.2} /></span><span>hirelane<span className="brand-dot">.</span></span></Link>; }
export default function Layout() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const employer = user?.role === 'employer';
  const location = useLocation();
  const links = employer ? [
    { to: '/employer', title: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/employer/jobs', title: 'Job openings', icon: BriefcaseBusiness },
    { to: '/employer/applicants', title: 'Applicant pipeline', icon: UsersRound },
    { to: '/employer/company', title: 'Company profile', icon: Building2 },
  ] : [
    { to: '/', title: 'Find jobs', icon: Search, end: true },
    { to: '/seeker/applications', title: 'My applications', icon: FileText },
    { to: '/seeker/profile', title: 'My profile', icon: UserRound },
  ];
  const active = links.find((item) => item.end ? location.pathname === item.to : location.pathname.startsWith(item.to));
  async function signOut() { try { await logout(); window.location.assign('/'); } catch (error) { toast(error.message, 'error'); } }
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to content</a>
    {menuOpen && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
    <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
      <div className="sidebar-brand"><Brand /><button className="icon-button mobile-only" aria-label="Close navigation" onClick={() => setMenuOpen(false)}><X size={20} /></button></div>
      <div className="workspace-label">{employer ? 'HIRING WORKSPACE' : 'YOUR NEXT CHAPTER'}</div>
      <nav className="sidebar-nav" aria-label="Main navigation">{links.map(({ to, title, icon: Icon, end }) => <NavLink key={to} to={to} end={end} onClick={() => setMenuOpen(false)} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><Icon size={20} /><span>{title}</span>{to === '/' && <span className="nav-new">Explore</span>}</NavLink>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-note"><span className="note-icon"><Sparkles size={21} /></span><h3>{employer ? 'Great teams start here.' : 'A little more you.'}</h3><p>{employer ? 'Create opportunities. Find the people who make a difference.' : 'Tell your story. A complete profile helps you find a better fit.'}</p><Link to={employer ? '/employer/jobs' : '/seeker/profile'}>{employer ? 'Manage openings' : 'Build your profile'}<ChevronRight size={16} /></Link></div>
      {user ? <div className="sidebar-user"><div className="avatar">{initials(user.name)}</div><div className="min-w-0 flex-1"><strong className="block truncate">{user.name}</strong><span>{employer ? 'Employer account' : 'Job seeker account'}</span></div><button className="icon-button" onClick={signOut} aria-label="Sign out"><LogOut size={18} /></button></div> : <Link className="sidebar-signin" to="/auth/seeker/login"><UserRound size={19} />Sign in to your account</Link>}</div>
    </aside>
    <div className="main-shell"><header className="topbar"><div className="flex items-center gap-3"><button className="icon-button mobile-only" onClick={() => setMenuOpen(true)} aria-label="Open navigation" aria-expanded={menuOpen}><Menu size={22} /></button><span className="breadcrumb">Workspace <ChevronRight size={14} /><strong>{active?.title || 'Job details'}</strong></span></div><div className="topbar-actions">{user ? <><span className="account-pill">{employer ? 'Employer' : 'Job seeker'}</span><div className="avatar avatar-small" aria-label={user.name}>{initials(user.name)}</div></> : <><Link className="employer-link" to="/auth/employer/login">For employers</Link><Link className="btn btn-primary btn-small" to="/auth/seeker/login">Sign in</Link></>}</div></header><main id="main-content" className="main-content"><Outlet /></main><footer className="app-footer"><span>© {new Date().getFullYear()} Hirelane</span><span>A better fit. A brighter future.</span></footer></div>
  </div>;
}
