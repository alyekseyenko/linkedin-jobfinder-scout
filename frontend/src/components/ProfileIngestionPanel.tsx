import { useState, type ChangeEvent } from 'react';
import {
  Sparkles,
  Globe,
  FileUp,
  Loader2,
  CheckCircle2,
  Send,
  Briefcase,
  FileText,
  Target
} from 'lucide-react';
import { mcpService } from '../lib/mcp-service';

type TabId = 'cv' | 'project' | 'experience' | 'text';

const EMPTY_PROJECT = {
  title: '',
  context: '',
  role: '',
  stack: '',
  result: '',
  link: '',
  period: '',
  company: '',
  attach_to_experience: false
};

const EMPTY_EXP = {
  company: '',
  role: '',
  period: '',
  bullet: ''
};

export default function ProfileIngestionPanel({
  onIngested
}: {
  onIngested: () => Promise<void> | void;
}) {
  const [tab, setTab] = useState<TabId>('project');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isCrawling, setIsCrawling] = useState(false);
  const [isDeepMapping, setIsDeepMapping] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [project, setProject] = useState(EMPTY_PROJECT);
  const [experience, setExperience] = useState(EMPTY_EXP);
  const [lessonKind, setLessonKind] = useState<'project_notes' | 'preferences' | 'screening'>('project_notes');
  const [lessonText, setLessonText] = useState('');

  const flash = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(null), 6000);
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setIsUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        await mcpService.uploadCV(files[i]);
      }
      flash('CV absorvido para user_cv.json e memória semântica.');
      await onIngested();
    } catch (err: any) {
      flash(`Erro no CV: ${err.message}`);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleLearnUrl = async () => {
    if (!urlInput.trim()) return;
    setIsCrawling(true);
    try {
      await mcpService.learnFromUrl(urlInput.trim());
      setUrlInput('');
      flash('URL indexada. Usa síntese só depois de os factos estarem certos.');
      await onIngested();
    } catch (err: any) {
      flash(`Erro no URL: ${err.message}`);
    } finally {
      setIsCrawling(false);
    }
  };

  const handleDeepMapping = async () => {
    setIsDeepMapping(true);
    try {
      await mcpService.deepMap();
      flash('Síntese concluída a partir do CV + knowledge base.');
      await onIngested();
    } catch (err: any) {
      flash(`Erro na síntese: ${err.message}`);
    } finally {
      setIsDeepMapping(false);
    }
  };

  const handleSaveProject = async () => {
    if (!project.title.trim()) return;
    setIsSaving(true);
    try {
      const res = await mcpService.ingestProject(project);
      setProject(EMPTY_PROJECT);
      flash(res.message || 'Projeto gravado.');
      await onIngested();
    } catch (err: any) {
      flash(`Erro no projeto: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveExperience = async () => {
    if (!experience.company.trim() || !experience.role.trim() || !experience.bullet.trim()) return;
    setIsSaving(true);
    try {
      const res = await mcpService.ingestExperience(experience);
      setExperience(EMPTY_EXP);
      flash(res.message || 'Experiência gravada.');
      await onIngested();
    } catch (err: any) {
      flash(`Erro na experiência: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveText = async () => {
    if (!lessonText.trim()) return;
    setIsSaving(true);
    try {
      const res = await mcpService.ingestText(lessonText.trim(), lessonKind);
      setLessonText('');
      flash(res.message || 'Texto indexado.');
      await onIngested();
    } catch (err: any) {
      flash(`Erro no texto: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const tabs: { id: TabId; label: string; icon: typeof Sparkles }[] = [
    { id: 'cv', label: '1. CV', icon: FileUp },
    { id: 'experience', label: '2. Emprego', icon: Briefcase },
    { id: 'project', label: '3. Projeto', icon: Target },
    { id: 'text', label: '4. Texto / regras', icon: FileText }
  ];

  const inputClass =
    'w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-green-500/50 outline-none';
  const labelClass = 'text-[10px] font-black uppercase tracking-widest text-white/40 mb-1.5 block';

  return (
    <div className="mb-16 p-6 md:p-8 rounded-[2.5rem] bg-gradient-to-r from-white/[0.03] to-white/[0.01] border border-white/10 backdrop-blur-xl relative overflow-hidden shadow-2xl">
      <div className="flex flex-col gap-2 mb-6">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-green-400">
          <Sparkles size={14} /> Enviar informação estruturada
        </div>
        <p className="text-xs text-white/50 max-w-3xl">
          Envia um bloco de cada vez. O ATS usa <span className="text-white/80 font-mono">user_cv.json</span>.
          Projetos vão também para a memória Postgres. Sem métrica inventada — deixa o resultado vazio se não tiveres número.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
              tab === id
                ? 'bg-green-500 text-black'
                : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Icon size={12} /> {label}
          </button>
        ))}
      </div>

      {tab === 'cv' && (
        <div className="space-y-4">
          <p className="text-xs text-white/45">
            Mínimo obrigatório: um CV textual (PDF/DOCX/TXT). Depois corrige o perfil. URL e síntese são extra — síntese só no fim.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-white uppercase tracking-wider cursor-pointer transition-all hover:border-green-500/30">
              {isUploading ? <Loader2 size={14} className="animate-spin text-green-400" /> : <FileUp size={14} className="text-green-400" />}
              Upload CV
              <input type="file" className="hidden" accept=".pdf,.docx,.txt" multiple onChange={handleFileUpload} />
            </label>
            <div className="flex items-center bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 focus-within:border-green-500/50">
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="GitHub / portefólio URL..."
                className="bg-transparent border-none text-xs text-white placeholder:text-white/20 outline-none w-44 md:w-56 font-mono"
              />
              <button
                onClick={handleLearnUrl}
                disabled={isCrawling || !urlInput.trim()}
                className="flex items-center gap-1.5 px-3 py-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 text-[10px] font-black uppercase tracking-wider rounded-lg disabled:opacity-40"
              >
                {isCrawling ? <Loader2 size={12} className="animate-spin" /> : <Globe size={12} />}
                Sync
              </button>
            </div>
            <button
              onClick={handleDeepMapping}
              disabled={isDeepMapping}
              className="flex items-center gap-2 px-5 py-2.5 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-400 rounded-xl text-xs font-black uppercase tracking-wider disabled:opacity-40"
            >
              {isDeepMapping ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              Síntese (no fim)
            </button>
          </div>
        </div>
      )}

      {tab === 'experience' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Empresa</label>
            <input className={inputClass} value={experience.company} onChange={(e) => setExperience({ ...experience, company: e.target.value })} placeholder="TECH ENTERPRISE LABS" />
          </div>
          <div>
            <label className={labelClass}>Cargo</label>
            <input className={inputClass} value={experience.role} onChange={(e) => setExperience({ ...experience, role: e.target.value })} placeholder="Lead Automation Architect" />
          </div>
          <div>
            <label className={labelClass}>Período</label>
            <input className={inputClass} value={experience.period} onChange={(e) => setExperience({ ...experience, period: e.target.value })} placeholder="2024 – Presente" />
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>Bullet (ação + stack + impacto)</label>
            <textarea
              rows={3}
              className={`${inputClass} resize-none leading-relaxed`}
              value={experience.bullet}
              onChange={(e) => setExperience({ ...experience, bullet: e.target.value })}
              placeholder="Arquitetei pipeline n8n + React que reduziu tempo de onboarding em 40%; stack: TypeScript, PostgreSQL, Docker."
            />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button
              onClick={handleSaveExperience}
              disabled={isSaving || !experience.company.trim() || !experience.bullet.trim()}
              className="flex items-center gap-2 px-6 py-2.5 bg-green-500 hover:bg-green-400 text-black font-black text-xs uppercase tracking-wider rounded-xl disabled:opacity-40"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Enviar emprego
            </button>
          </div>
        </div>
      )}

      {tab === 'project' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Nome</label>
            <input className={inputClass} value={project.title} onChange={(e) => setProject({ ...project, title: e.target.value })} placeholder="Neural Scout – job automation" />
          </div>
          <div>
            <label className={labelClass}>Período</label>
            <input className={inputClass} value={project.period} onChange={(e) => setProject({ ...project, period: e.target.value })} placeholder="2024 – Presente" />
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>Contexto (para quem / problema)</label>
            <textarea rows={2} className={`${inputClass} resize-none`} value={project.context} onChange={(e) => setProject({ ...project, context: e.target.value })} placeholder="Agente local que casa o CV com vagas e redige candidaturas." />
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>O que fizeste / papel</label>
            <textarea rows={2} className={`${inputClass} resize-none`} value={project.role} onChange={(e) => setProject({ ...project, role: e.target.value })} placeholder="Solo — arquitectura, memória RAG e UI" />
          </div>
          <div>
            <label className={labelClass}>Stack</label>
            <input className={inputClass} value={project.stack} onChange={(e) => setProject({ ...project, stack: e.target.value })} placeholder="React, Groq, LangGraph, PostgreSQL" />
          </div>
          <div>
            <label className={labelClass}>Resultado (só se for factual)</label>
            <input className={inputClass} value={project.result} onChange={(e) => setProject({ ...project, result: e.target.value })} placeholder="Reduzi o tempo de redação em 40%" />
          </div>
          <div>
            <label className={labelClass}>Link (opcional)</label>
            <input className={inputClass} value={project.link} onChange={(e) => setProject({ ...project, link: e.target.value })} placeholder="https://github.com/..." />
          </div>
          <div>
            <label className={labelClass}>Empresa no CV (opcional)</label>
            <input className={inputClass} value={project.company} onChange={(e) => setProject({ ...project, company: e.target.value })} placeholder="Se foi feito no emprego" />
          </div>
          <label className="md:col-span-2 flex items-center gap-2 text-xs text-white/50">
            <input
              type="checkbox"
              checked={project.attach_to_experience}
              onChange={(e) => setProject({ ...project, attach_to_experience: e.target.checked })}
              className="accent-green-500"
            />
            Também criar bullet na experiência (só se preencheres empresa)
          </label>
          <div className="md:col-span-2 flex justify-end">
            <button
              onClick={handleSaveProject}
              disabled={isSaving || !project.title.trim()}
              className="flex items-center gap-2 px-6 py-2.5 bg-green-500 hover:bg-green-400 text-black font-black text-xs uppercase tracking-wider rounded-xl disabled:opacity-40"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Enviar projeto
            </button>
          </div>
        </div>
      )}

      {tab === 'text' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['project_notes', 'Notas de projeto'],
                ['preferences', 'Regras de vaga'],
                ['screening', 'Respostas screening']
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setLessonKind(id)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                  lessonKind === id ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-white/5 text-white/40'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <textarea
            rows={7}
            className={`${inputClass} resize-none font-mono text-xs leading-relaxed`}
            value={lessonText}
            onChange={(e) => setLessonText(e.target.value)}
            placeholder={
              lessonKind === 'preferences'
                ? 'Remote-first. EU timezone. Sem roles só de suporte. Salário mínimo: …'
                : lessonKind === 'screening'
                  ? 'Notice period: 30 days. English C1. Authorized to work in Portugal / EU.'
                  : 'PROJECT: …\nCONTEXT: …\nWHAT I DID: …\nSTACK: …\nRESULT: …'
            }
          />
          <div className="flex justify-end">
            <button
              onClick={handleSaveText}
              disabled={isSaving || !lessonText.trim()}
              className="flex items-center gap-2 px-6 py-2.5 bg-green-500 hover:bg-green-400 text-black font-black text-xs uppercase tracking-wider rounded-xl disabled:opacity-40"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Enviar texto
            </button>
          </div>
        </div>
      )}

      {statusMsg && (
        <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2 text-xs font-medium text-green-400">
          <CheckCircle2 size={14} /> {statusMsg}
        </div>
      )}
    </div>
  );
}
