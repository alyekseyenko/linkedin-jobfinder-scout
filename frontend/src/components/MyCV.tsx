import React, { useState, useEffect } from 'react';
import { 
  User, 
  Briefcase, 
  GraduationCap, 
  Code2, 
  ShieldCheck, 
  Mail, 
  Phone, 
  MapPin, 
  Globe, 
  FileText, 
  Download,
  Upload,
  Sparkles,
  RefreshCw,
  FileUp,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Edit3,
  Save,
  X
} from 'lucide-react';
import { mcpService } from '../lib/mcp-service';

export default function MyCV() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isCrawling, setIsCrawling] = useState(false);
  const [isDeepMapping, setIsDeepMapping] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Edit Profile Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    title: '',
    email: '',
    phone: '',
    location: '',
    website: '',
    summary: ''
  });

  const loadNeuralProfile = async () => {
    try {
      const data = await mcpService.fetchNeuralCV();
      if (data.success) {
        setProfile(data.profile);
      }
    } catch (err) {
      console.error('Failed to load neural profile:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNeuralProfile();
  }, []);

  const openEditModal = () => {
    if (!profile) return;
    setEditForm({
      name: profile.personal_info?.name || '',
      title: profile.personal_info?.title || '',
      email: profile.personal_info?.email || '',
      phone: profile.personal_info?.phone || '',
      location: profile.personal_info?.location || '',
      website: profile.personal_info?.website || '',
      summary: profile.summary || ''
    });
    setIsEditModalOpen(true);
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const payload = {
        personal_info: {
          name: editForm.name,
          title: editForm.title,
          email: editForm.email,
          phone: editForm.phone,
          location: editForm.location,
          website: editForm.website
        },
        summary: editForm.summary
      };
      await mcpService.updateCV(payload);
      setStatusMsg('Perfil atualizado com sucesso!');
      await loadNeuralProfile();
      setIsEditModalOpen(false);
    } catch (err: any) {
      alert(`Erro ao guardar perfil: ${err.message}`);
    } finally {
      setIsSaving(false);
      setTimeout(() => setStatusMsg(null), 5000);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploading(true);
    setStatusMsg('A analisar e sintetizar ficheiro de CV com IA Gemini...');
    try {
      for (let i = 0; i < files.length; i++) {
        const res = await mcpService.uploadCV(files[i]);
        if (res && res.profile) {
          setProfile(res.profile);
        }
      }
      setStatusMsg('CV absorvido e perfil adaptado com sucesso!');
      await loadNeuralProfile();
    } catch (err: any) {
      setStatusMsg(`Erro ao carregar CV: ${err.message}`);
    } finally {
      setIsUploading(false);
      setTimeout(() => setStatusMsg(null), 5000);
    }
  };

  const handleLearnUrl = async () => {
    if (!urlInput.trim()) return;
    setIsCrawling(true);
    setStatusMsg(`A extrair competências de ${urlInput}...`);
    try {
      await mcpService.learnFromUrl(urlInput.trim());
      setStatusMsg('Página indexada com sucesso! A recarregar perfil...');
      setUrlInput('');
      await loadNeuralProfile();
    } catch (err: any) {
      setStatusMsg(`Erro ao ler URL: ${err.message}`);
    } finally {
      setIsCrawling(false);
      setTimeout(() => setStatusMsg(null), 5000);
    }
  };

  const handleDeepMapping = async () => {
    setIsDeepMapping(true);
    setStatusMsg('A executar síntese profunda de identidade com Gemini...');
    try {
      await mcpService.deepMap();
      setStatusMsg('Síntese profunda concluída com sucesso!');
      await loadNeuralProfile();
    } catch (err: any) {
      setStatusMsg(`Erro na síntese: ${err.message}`);
    } finally {
      setIsDeepMapping(false);
      setTimeout(() => setStatusMsg(null), 5000);
    }
  };

  if (loading) return <div className="p-8 text-center text-white/50 text-sm font-medium animate-pulse">A carregar o teu perfil de carreira...</div>;
  if (!profile) return null;

  const formatEdu = (edu: any) => typeof edu === 'string' ? edu : `${edu.degree} @ ${edu.institution}${edu.details ? ` (${edu.details})` : ''}`;

  const exportATS = () => {
    if (!profile) return;
    const content = `
${profile.personal_info.name}
${profile.personal_info.title}
${profile.personal_info.location} | ${profile.personal_info.email} | ${profile.personal_info.website}

PROFESSIONAL SUMMARY
${profile.summary}

EXPERIENCE
${(profile.experience || []).map((exp: any) => `${exp.role} @ ${exp.company} (${exp.period})\n${(exp.bullets || []).map((b: string) => `• ${b}`).join('\n')}`).join('\n\n')}

SKILLS
${(profile.hard_skills || []).join(', ')}

EDUCATION
${(profile.education || []).map(formatEdu).join('\n')}
    `.trim();
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `CV_${profile.personal_info.name.replace(/\s+/g, '_')}_ATS.txt`;
    link.click();
  };

  const exportPDF = async () => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    let y = 20;
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    
    const addText = (text: string, size: number, bold = false, color = '#000000') => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(size);
      doc.setTextColor(color);
      const splitText = doc.splitTextToSize(text, pageWidth - (margin * 2));
      doc.text(splitText, margin, y);
      y += (splitText.length * (size * 0.5)) + 4;
    };

    addText(profile.personal_info.name, 22, true);
    addText(profile.personal_info.title, 14, false, '#444444');
    addText(`${profile.personal_info.email} | ${profile.personal_info.location} | ${profile.personal_info.website || ''}`, 10);
    y += 5;

    addText('PROFESSIONAL SUMMARY', 12, true);
    addText(profile.summary || '', 10);
    y += 5;

    addText('EXPERIENCE', 12, true);
    (profile.experience || []).forEach((exp: any) => {
      addText(`${exp.role} @ ${exp.company}`, 11, true);
      addText(exp.period, 10, false, '#666666');
      (exp.bullets || []).forEach((b: string) => addText(`- ${b}`, 10));
      y += 2;
    });

    addText('EDUCATION', 12, true);
    (profile.education || []).forEach((edu: any) => addText(formatEdu(edu), 10));
    y += 5;

    addText('TECHNICAL SKILLS', 12, true);
    const skills = Array.isArray(profile.hard_skills) ? profile.hard_skills.join(', ') : '';
    addText(skills, 10);

    doc.save(`CV_${profile.personal_info.name.replace(/\s+/g, '_')}.pdf`);
  };

  // Semantic Categorization for the Skills Cloud
  const categories = [
    { name: 'Intelligence (AI & Data)', keywords: ['AI', 'n8n', 'Python', 'ML', 'RAG', 'Prompt', 'LLM', 'Vector', 'NLP', 'Automation', 'Chroma', 'Pinecone', 'Learning'] },
    { name: 'Aura (Frontend & UI/UX)', keywords: ['React', 'Three.js', 'UI/UX', 'Figma', 'CSS', 'Tailwind', 'Design Systems', 'Motion', 'GSAP', 'Framer', 'Photography', '3D'] },
    { name: 'Core (Engineering)', keywords: ['Node.js', 'TypeScript', 'Docker', 'AWS', 'GCP', 'Vercel', 'PostgreSQL', 'SQL', 'FastAPI', 'REST', 'GraphQL', 'PHP', 'WordPress', 'Git'] },
    { name: 'Strategy (Business)', keywords: ['SEO', 'Scrum', 'Agile', 'B2B', 'CRO', 'CRM', 'Analytics', 'Growth', 'Storytelling', 'Management', 'KPI'] }
  ];

  const getCategory = (skill: string) => {
    for (const cat of categories) {
      if (cat.keywords.some(k => skill.toLowerCase().includes(k.toLowerCase()))) return cat.name;
    }
    return 'General Expertise';
  };

  const groupedSkills = (profile.hard_skills || []).reduce((acc: any, skill: string) => {
    const cat = getCategory(skill);
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(skill);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[#050505] text-white/90 selection:bg-green-500/30 font-sans">
      {/* Ambient background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-green-500/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/5 blur-[120px] rounded-full" />
      </div>

      <div className="relative max-w-6xl mx-auto px-6 py-12 lg:py-24">
        {/* Modern Header */}
        <header className="mb-20">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-10">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-[10px] font-black uppercase tracking-[0.2em] text-green-400">
                <ShieldCheck size={12} /> Active & Calibrated Professional Profile
              </div>
              <h1 className="text-6xl lg:text-8xl font-black tracking-tighter text-white leading-[0.85]">
                {profile.personal_info.name.split(' ')[0]}<span className="text-green-500">.</span><br />
                <span className="opacity-20">{profile.personal_info.name.split(' ').slice(1).join(' ')}</span>
              </h1>
              <p className="text-xl lg:text-2xl font-light text-white/60 max-w-2xl leading-relaxed">
                {profile.personal_info.title}
              </p>
            </div>
            
            <div className="flex flex-wrap gap-4">
              <button 
                onClick={openEditModal}
                className="flex items-center gap-2 px-6 py-4 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/30 font-black uppercase text-xs tracking-widest rounded-full transition-all duration-300 transform hover:-translate-y-1 active:scale-95 shadow-xl shadow-green-500/5 cursor-pointer"
              >
                <Edit3 size={16} /> Edit Profile
              </button>
              <button 
                onClick={exportPDF}
                className="flex items-center gap-2 px-8 py-4 bg-white text-black font-black uppercase text-xs tracking-widest rounded-full hover:bg-green-400 transition-all duration-300 transform hover:-translate-y-1 active:scale-95 shadow-xl shadow-white/5 cursor-pointer"
              >
                <Download size={18} /> Download CV PDF
              </button>
              <button 
                onClick={exportATS}
                className="flex items-center gap-2 px-8 py-4 bg-white/5 text-white/60 border border-white/10 font-black uppercase text-xs tracking-widest rounded-full hover:bg-white/10 transition-all duration-300 cursor-pointer"
              >
                <FileText size={18} /> Download ATS Text
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 mt-16 pt-12 border-t border-white/5">
            <div className="group flex items-center gap-4">
              <div className="p-2 bg-white/5 rounded-lg border border-white/10 group-hover:border-green-500/50 transition-colors">
                <Mail size={16} className="text-green-500" />
              </div>
              <div className="text-xs text-white/40 font-mono">{profile.personal_info.email}</div>
            </div>
            <div className="group flex items-center gap-4">
              <div className="p-2 bg-white/5 rounded-lg border border-white/10 group-hover:border-green-500/50 transition-colors">
                <Phone size={16} className="text-green-500" />
              </div>
              <div className="text-xs text-white/40 font-mono">{profile.personal_info.phone}</div>
            </div>
            <div className="group flex items-center gap-4">
              <div className="p-2 bg-white/5 rounded-lg border border-white/10 group-hover:border-green-500/50 transition-colors">
                <MapPin size={16} className="text-green-500" />
              </div>
              <div className="text-xs text-white/40 font-mono">{profile.personal_info.location}</div>
            </div>
            <div className="group flex items-center gap-4">
              <div className="p-2 bg-white/5 rounded-lg border border-white/10 group-hover:border-green-500/50 transition-colors">
                <Globe size={16} className="text-green-500" />
              </div>
              <div className="text-xs text-white/40 font-mono">{profile.personal_info.website}</div>
            </div>
          </div>
        </header>

        {/* Knowledge Ingestion & AI Tuning Bar */}
        <div className="mb-16 p-6 md:p-8 rounded-[2.5rem] bg-gradient-to-r from-white/[0.03] to-white/[0.01] border border-white/10 backdrop-blur-xl relative overflow-hidden shadow-2xl">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-green-400">
                <Sparkles size={14} /> Profile Enhancement & Neural Ingestion
              </div>
              <p className="text-xs text-white/50">
                Feed your agent with real experience data and skills to calibrate job matching in real-time.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Web Crawler Input */}
              <div className="flex items-center bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 focus-within:border-green-500/50 transition-colors">
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="LinkedIn / GitHub URL..."
                  className="bg-transparent border-none text-xs text-white placeholder:text-white/20 outline-none w-44 md:w-56 font-mono"
                />
                <button
                  onClick={handleLearnUrl}
                  disabled={isCrawling || !urlInput.trim()}
                  className="flex items-center gap-1.5 px-3 py-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all disabled:opacity-40 cursor-pointer"
                >
                  {isCrawling ? <Loader2 size={12} className="animate-spin" /> : <Globe size={12} />}
                  Sync
                </button>
              </div>

              {/* Upload CV */}
              <label className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-white uppercase tracking-wider cursor-pointer transition-all hover:border-green-500/30">
                {isUploading ? <Loader2 size={14} className="animate-spin text-green-400" /> : <FileUp size={14} className="text-green-400" />}
                Upload CV
                <input type="file" className="hidden" accept=".pdf,.docx,.txt" multiple onChange={handleFileUpload} />
              </label>

              {/* Deep Mapping Gemini */}
              <button
                onClick={handleDeepMapping}
                disabled={isDeepMapping}
                className="flex items-center gap-2 px-5 py-2.5 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-400 rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-40 cursor-pointer"
              >
                {isDeepMapping ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                Gemini Synthesis
              </button>
            </div>
          </div>

          {/* Status Toast */}
          {statusMsg && (
            <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2 text-xs font-medium text-green-400 animate-pulse">
              <CheckCircle2 size={14} /> {statusMsg}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-20">
          {/* Main Body (Left) */}
          <div className="lg:col-span-8 space-y-24">
            
            {/* Summary */}
            <section>
              <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-green-500 mb-8 flex items-center gap-4">
                <span className="w-12 h-[1px] bg-green-500/30" /> Professional Summary
              </h3>
              <div className="text-2xl lg:text-3xl text-white/90 font-light leading-relaxed tracking-tight">
                {profile.summary}
              </div>
            </section>

            {/* Experience */}
            <section>
              <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-green-500 mb-12 flex items-center gap-4">
                <span className="w-12 h-[1px] bg-green-500/30" /> Experience History
              </h3>
              <div className="space-y-16">
                {(profile.experience || []).map((exp: any, i: number) => (
                  <div key={i} className="group relative pl-10 border-l border-white/10 hover:border-green-500/30 transition-all duration-500">
                    <div className="absolute w-3 h-3 bg-white/20 rounded-full -left-[6.5px] top-1.5 group-hover:bg-green-500 group-hover:scale-125 transition-all shadow-[0_0_15px_rgba(74,222,128,0)] group-hover:shadow-[0_0_15px_rgba(74,222,128,0.4)]" />
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
                      <div>
                        <h4 className="text-2xl font-bold text-white group-hover:text-green-400 transition-colors">{exp.role}</h4>
                        <div className="text-sm font-black text-white/30 uppercase tracking-[0.2em] mt-1">{exp.company}</div>
                      </div>
                      <div className="text-xs font-mono px-4 py-2 bg-white/5 rounded-full border border-white/10 text-white/40 group-hover:text-white/80 transition-colors">{exp.period}</div>
                    </div>
                    <ul className="space-y-4">
                      {(exp.bullets || []).map((bullet: string, idx: number) => (
                        <li key={idx} className="text-lg text-white/50 leading-relaxed flex gap-4 group/item">
                          <span className="text-green-500/20 mt-2 group-hover/item:text-green-500 transition-colors">•</span>
                          <span className="group-hover/item:text-white/80 transition-colors">{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>

            {/* Education */}
            <section>
              <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-green-500 mb-12 flex items-center gap-4">
                <span className="w-12 h-[1px] bg-green-500/30" /> Education Path
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {(profile.education || []).map((edu: any, i: number) => {
                  const isObject = typeof edu === 'object' && edu !== null;
                  return (
                    <div key={i} className="p-8 rounded-3xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all group">
                      <GraduationCap size={24} className="text-green-500/30 mb-6 group-hover:text-green-500 transition-colors" />
                      <h4 className="text-lg font-bold text-white mb-2">{isObject ? edu.degree : edu}</h4>
                      {isObject && edu.institution && <div className="text-sm text-white/40 font-medium uppercase tracking-wider">{edu.institution}</div>}
                      {isObject && edu.details && <div className="mt-4 inline-block text-[10px] font-black text-green-500/50 bg-green-500/5 px-2 py-1 rounded border border-green-500/10 uppercase tracking-widest">{edu.details}</div>}
                    </div>
                  );
                })}
              </div>
            </section>
            {/* Flagship Projects - NEW SECTION */}
            <section>
              <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-green-500 mb-12 flex items-center gap-4">
                <span className="w-12 h-[1px] bg-green-500/30" /> Strategic Projects
              </h3>
              <div className="space-y-12">
                {(profile.projects || []).map((project: any, i: number) => (
                  <div key={i} className="p-8 rounded-[32px] bg-white/[0.02] border border-white/5 hover:border-green-500/30 transition-all group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-20 transition-opacity">
                      <Code2 size={40} />
                    </div>
                    <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6">
                      <h4 className="text-2xl font-bold text-white">{project.title}</h4>
                      <span className="text-[9px] font-black text-green-500 bg-green-500/10 px-3 py-1 rounded-full border border-green-500/20 uppercase tracking-[0.2em]">
                        {project.strategic_weight || 'Core Node'}
                      </span>
                    </div>
                    <p className="text-lg text-white/50 mb-8 leading-relaxed max-w-3xl">
                      {project.context}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(project.edges_skills || []).map((s: string, idx: number) => (
                        <span key={idx} className="text-[10px] font-mono text-white/30 bg-white/5 px-2 py-1 rounded">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Sidebar (Right) */}
          <div className="lg:col-span-4 space-y-16">
            
            {/* Hard Skills - Simplified for Elite Profile */}
            <section className="p-8 rounded-[40px] bg-green-500/[0.03] border border-green-500/10 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 blur-3xl rounded-full" />
              <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-green-500 mb-8">Intelligence Nodes</h3>
              <div className="flex flex-wrap gap-2">
                {(profile.hard_skills || []).map((skill: string, i: number) => (
                  <span key={i} className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-[12px] text-white/70 hover:border-green-500/30 hover:text-white transition-all duration-300">
                    {skill}
                  </span>
                ))}
              </div>
              <div className="mt-8 pt-6 border-t border-white/5">
                <div className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] mb-4">Core Ecosystem</div>
                <div className="text-[11px] text-white/40 leading-relaxed italic">
                  +100 nodes accessible via RAG-driven job adaptation engine.
                </div>
              </div>
            </section>

            {/* Certifications */}
            <section className="p-8 rounded-[40px] bg-white/[0.02] border border-white/5">
              <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40 mb-8">Certifications</h3>
              <ul className="space-y-6">
                {(profile.certifications || []).map((cert: any, i: number) => (
                  <li key={i} className="flex gap-4 items-start group">
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center shrink-0 border border-white/10 group-hover:border-green-500/50 transition-colors">
                      <ShieldCheck size={14} className="text-green-500/30 group-hover:text-green-500 transition-colors" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white/80 group-hover:text-white transition-colors leading-snug">{typeof cert === 'string' ? cert : (cert.name || cert.title)}</div>
                      {typeof cert === 'object' && cert.issuer && <div className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] mt-1.5">{cert.issuer}</div>}
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {/* Languages & Soft Skills */}
            <section className="p-8 space-y-12">
              <div>
                <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30 mb-6">Languages</h3>
                <div className="text-sm text-white/60 font-medium tracking-wide">
                  {Array.isArray(profile.languages) ? profile.languages.join(' \u2022 ') : profile.languages}
                </div>
              </div>
              <div>
                <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30 mb-8">Soft Dynamics</h3>
                <div className="flex flex-wrap gap-2">
                  {(Array.isArray(profile.soft_skills) ? profile.soft_skills : (profile.soft_skills || '').split(', ')).map((skill: string, i: number) => (
                    <span key={i} className="text-[11px] font-mono text-white/20 hover:text-green-400 transition-colors cursor-default">
                      #{skill.trim().replace(/\s+/g, '')}
                    </span>
                  ))}
                </div>
              </div>
            </section>

          </div>
        </div>

        {/* Footer */}
        <footer className="mt-40 pt-16 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="text-[10px] font-mono text-white/10 tracking-[0.8em] uppercase">
            Neural Matrix Synthesis v4.5 // 2026
          </div>
          <div className="flex gap-8 text-[10px] font-black text-white/20 uppercase tracking-widest">
            <span>Encrypted Data</span>
            <span>Real-time Sync</span>
            <span>Verified Identity</span>
          </div>
        </footer>
      </div>

      {/* Edit Profile Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#111115] border border-white/10 rounded-3xl max-w-2xl w-full p-8 shadow-2xl overflow-y-auto max-h-[90vh] space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-xl text-green-400 border border-green-500/20">
                  <Edit3 size={18} />
                </div>
                <h3 className="text-lg font-bold text-white tracking-wide">Editar Perfil Profissional</h3>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-white/40 hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1.5 block">Nome Completo</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-green-500/50 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1.5 block">Título Profissional / Headline</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-green-500/50 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1.5 block">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-green-500/50 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1.5 block">Telefone</label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-green-500/50 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1.5 block">Localização</label>
                <input
                  type="text"
                  value={editForm.location}
                  onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-green-500/50 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1.5 block">Website / LinkedIn</label>
                <input
                  type="text"
                  value={editForm.website}
                  onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-green-500/50 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1.5 block">Resumo Profissional</label>
              <textarea
                rows={4}
                value={editForm.summary}
                onChange={(e) => setEditForm({ ...editForm, summary: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-white focus:border-green-500/50 outline-none resize-none leading-relaxed"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-2.5 bg-green-500 hover:bg-green-400 text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all disabled:opacity-50"
              >
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Guardar Alterações
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

