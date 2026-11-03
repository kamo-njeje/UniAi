import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode, type RefObject } from 'react'
import './App.css'

type ApiHealth = { status: string; service: string }
type ConnectionState = 'checking' | 'connected' | 'offline'
type View = 'overview' | 'modules' | 'timeline' | 'settings' | 'signup'
type CourseModule = { id: string; name: string; code: string }
type LocalDocument = { name: string; size: number; file: File }
type FormMode = 'add' | 'edit' | null
type StudyMode = 'summary' | 'broaden' | null
type StudyDepth = 'quick' | 'deep'
type StudyCitation = { title: string; url: string }
type QuizQuestion = { type: 'single_choice' | 'multiple_select' | 'true_false' | 'short_answer'; prompt: string; options: string[]; correctAnswers: string[]; answer: string; explanation: string; sourceReference: string }
type StudyQuiz = { title: string; depth: StudyDepth; questions: QuizQuestion[] }
type StudyResult = { mode: Exclude<StudyMode, null>; text?: string; citations: StudyCitation[]; quiz?: StudyQuiz; error?: string }

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5008'
const modulesStorageKey = 'uniai.guest.modules.v1'
const startedStorageKey = 'uniai.guest.started.v1'
const themeStorageKey = 'uniai.theme.v1'
const maxFileSize = 20 * 1024 * 1024
const supportedExtensions = ['.pdf', '.pptx', '.docx', '.txt']

const upcomingItems = [
  { day: 'TODAY', time: '16:30', title: 'Review a topic', module: 'Study session', type: 'Study session' },
  { day: 'THU, 12 NOV', time: '10:00', title: 'Assessment reminder', module: 'My timeline', type: 'Assessment' },
  { day: 'FRI, 13 NOV', time: '14:00', title: 'Project draft due', module: 'My timeline', type: 'Deadline' },
]

function readSavedModules(): CourseModule[] {
  try {
    const saved = sessionStorage.getItem(modulesStorageKey)
    if (!saved) return []
    const parsed: unknown = JSON.parse(saved)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is CourseModule =>
      typeof item?.id === 'string' && typeof item?.name === 'string' && typeof item?.code === 'string',
    )
  } catch {
    return []
  }
}

function App() {
  const [connection, setConnection] = useState<ConnectionState>('checking')
  const [modules, setModules] = useState<CourseModule[]>(readSavedModules)
  const [hasStarted, setHasStarted] = useState(() => {
    try { return sessionStorage.getItem(startedStorageKey) === 'true' } catch { return false }
  })
  const [view, setView] = useState<View>('overview')
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem(themeStorageKey) === 'dark' } catch { return false }
  })
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null)
  const [documents, setDocuments] = useState<Record<string, LocalDocument[]>>({})
  const [studyModes, setStudyModes] = useState<Record<string, StudyMode>>({})
  const [studyResults, setStudyResults] = useState<Record<string, StudyResult>>({})
  const [generatingModuleId, setGeneratingModuleId] = useState<string | null>(null)
  const [uploadMessage, setUploadMessage] = useState('')
  const [formMode, setFormMode] = useState<FormMode>(null)
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null)
  const [moduleName, setModuleName] = useState('')
  const [moduleCode, setModuleCode] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const uploadModuleId = useRef<string | null>(null)
  const nameInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try { sessionStorage.setItem(modulesStorageKey, JSON.stringify(modules)) } catch { /* Browser storage may be unavailable. */ }
  }, [modules])

  useEffect(() => {
    try { if (hasStarted) sessionStorage.setItem(startedStorageKey, 'true') } catch { /* Browser storage may be unavailable. */ }
  }, [hasStarted])

  useEffect(() => {
    try { localStorage.setItem(themeStorageKey, darkMode ? 'dark' : 'light') } catch { /* Browser storage may be unavailable. */ }
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light'
  }, [darkMode])

  useEffect(() => {
    try {
      localStorage.removeItem('uniai.modules.v1')
      localStorage.removeItem('uniai.started.v1')
    } catch { /* Remove prior prototype data when browser storage is available. */ }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 4000)
    fetch(`${apiBaseUrl}/health`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('API health request failed')
        return response.json() as Promise<ApiHealth>
      })
      .then((health) => setConnection(health.status === 'ok' ? 'connected' : 'offline'))
      .catch(() => setConnection('offline'))
      .finally(() => window.clearTimeout(timeout))
    return () => { controller.abort(); window.clearTimeout(timeout) }
  }, [])

  useEffect(() => { if (formMode) nameInput.current?.focus() }, [formMode])

  const selectedModule = modules.find((item) => item.id === selectedModuleId) ?? null

  function showAddForm() {
    setModuleName('')
    setModuleCode('')
    setEditingModuleId(null)
    setFormMode('add')
  }

  function showEditForm(item: CourseModule) {
    setModuleName(item.name)
    setModuleCode(item.code)
    setEditingModuleId(item.id)
    setFormMode('edit')
  }

  function saveModule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cleanName = moduleName.trim()
    const cleanCode = moduleCode.trim()
    if (!cleanName || !cleanCode) return

    if (formMode === 'edit' && editingModuleId) {
      setModules((current) => current.map((item) => item.id === editingModuleId
        ? { ...item, name: cleanName, code: cleanCode }
        : item))
      setSelectedModuleId(editingModuleId)
    } else {
      const newModule = { id: crypto.randomUUID(), name: cleanName, code: cleanCode }
      setModules((current) => [...current, newModule])
      setHasStarted(true)
      setSelectedModuleId(null)
      setView('overview')
    }
    setFormMode(null)
  }

  function deleteModule(item: CourseModule) {
    if (!window.confirm(`Delete “${item.name}”? This also removes it from this browser's module list.`)) return
    setModules((current) => current.filter((module) => module.id !== item.id))
    setDocuments((current) => { const next = { ...current }; delete next[item.id]; return next })
    setStudyResults((current) => { const next = { ...current }; delete next[item.id]; return next })
    setSelectedModuleId(null)
    setUploadMessage('')
    setView('modules')
  }

  function openModule(item: CourseModule) {
    setSelectedModuleId(item.id)
    setView('modules')
    setUploadMessage('')
  }

  function startFileSelection(moduleId: string) {
    uploadModuleId.current = moduleId
    fileInput.current?.click()
  }

  function handleFilesSelected(event: ChangeEvent<HTMLInputElement>) {
    const moduleId = uploadModuleId.current
    const files = Array.from(event.currentTarget.files ?? [])
    event.currentTarget.value = ''
    if (!moduleId || files.length === 0) return

    const accepted: LocalDocument[] = []
    const rejected: string[] = []
    for (const file of files) {
      const extension = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`
      if (!supportedExtensions.includes(extension)) rejected.push(`${file.name}: file type not supported`)
      else if (file.size > maxFileSize) rejected.push(`${file.name}: larger than 20 MB`)
      else accepted.push({ name: file.name, size: file.size, file })
    }
    const currentCount = documents[moduleId]?.length ?? 0
    const availableSlots = Math.max(0, 3 - currentCount)
    const selected = accepted.slice(0, availableSlots)
    if (accepted.length > selected.length) rejected.push('Only three documents can be processed together in this preview.')
    setDocuments((current) => ({ ...current, [moduleId]: [...(current[moduleId] ?? []), ...selected] }))
    if (selected.length > 0) {
      setStudyModes((current) => ({ ...current, [moduleId]: null }))
      setStudyResults((current) => { const next = { ...current }; delete next[moduleId]; return next })
    }
    setUploadMessage([
      selected.length ? `${selected.length} file${selected.length === 1 ? '' : 's'} ready in this browser.` : '',
      ...rejected,
      selected.length ? 'They have not been uploaded or sent to an AI service yet.' : '',
    ].filter(Boolean).join(' '))
  }

  async function generateStudyPack(moduleId: string, mode: Exclude<StudyMode, null>, depth: StudyDepth) {
    const selectedDocuments = documents[moduleId] ?? []
    if (selectedDocuments.length === 0 || generatingModuleId) return

    setGeneratingModuleId(moduleId)
    setStudyResults((current) => ({ ...current, [moduleId]: { mode, citations: [] } }))
    const form = new FormData()
    form.append('mode', mode)
    form.append('depth', depth)
    selectedDocuments.forEach((document) => form.append('files', document.file, document.name))
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 100_000)

    try {
      const response = await fetch(`${apiBaseUrl}/api/study/generate`, { method: 'POST', body: form, signal: controller.signal })
      const body = await response.json() as { text?: string; citations?: StudyCitation[]; quiz?: StudyQuiz; error?: string; detail?: string; title?: string }
      if (!response.ok) throw new Error(body.detail ?? body.error ?? body.title ?? 'Could not generate study material.')
      setStudyResults((current) => ({ ...current, [moduleId]: { mode, text: body.text ?? '', citations: body.citations ?? [], quiz: body.quiz } }))
    } catch (error) {
      const message = error instanceof DOMException && error.name === 'AbortError'
        ? 'This request took too long. Try a shorter document or try again.'
        : error instanceof Error ? error.message : 'Could not generate study material. Check that the API is running.'
      setStudyResults((current) => ({ ...current, [moduleId]: { mode, citations: [], error: message } }))
    } finally {
      window.clearTimeout(timeout)
      setGeneratingModuleId(null)
    }
  }

  const connectionText = {
    checking: 'Checking connection', connected: 'System online', offline: 'API not running',
  }[connection]

  if (!hasStarted && view !== 'signup') {
    return <Welcome onAddModule={showAddForm} onSignUp={() => setView('signup')} form={formMode === 'add' ? <ModuleFormDialog mode="add" name={moduleName} code={moduleCode} setName={setModuleName} setCode={setModuleCode} onSave={saveModule} onClose={() => setFormMode(null)} nameInput={nameInput} /> : null} />
  }

  if (view === 'signup') {
    return <SignupPage onBack={() => setView('overview')} />
  }

  return (
    <main className={darkMode ? 'app-shell theme-dark' : 'app-shell'}>
      <header className="topbar">
        <button className="brand brand-button" onClick={() => { setSelectedModuleId(null); setView('overview') }} aria-label="UniAI home">
          <span className="brand-mark" aria-hidden="true">U</span><span>Uni<span className="brand-accent">AI</span></span>
        </button>
        <nav className="main-nav" aria-label="Main navigation">
          <button className={view === 'overview' ? 'nav-link active' : 'nav-link'} onClick={() => { setSelectedModuleId(null); setView('overview') }}>Overview</button>
          <button className={view === 'modules' ? 'nav-link active' : 'nav-link'} onClick={() => { setSelectedModuleId(null); setView('modules') }}>My modules</button>
          <button className={view === 'timeline' ? 'nav-link active' : 'nav-link'} onClick={() => { setSelectedModuleId(null); setView('timeline') }}>My timeline</button>
          <button className={view === 'settings' ? 'nav-link active' : 'nav-link'} onClick={() => { setSelectedModuleId(null); setView('settings') }}>Settings</button>
        </nav>
        <div className="topbar-right"><span className={`status-dot status-${connection}`} aria-hidden="true" /><span className="connection-label">{connectionText}</span><span className="avatar" aria-label="Student profile">S</span></div>
      </header>
      <div className="guest-session-banner"><strong>Guest preview</strong><span>Your modules are temporary and clear when this tab session ends. Sign up to keep your learning across visits.</span><button onClick={() => setView('signup')}>Sign up <span aria-hidden="true">→</span></button></div>

      {view === 'overview' && <Overview modules={modules} onOpenModule={openModule} onOpenTimeline={() => setView('timeline')} onAddModule={showAddForm} />}
      {view === 'modules' && selectedModule && <ModuleDetail
        courseModule={selectedModule} documents={documents[selectedModule.id] ?? []} uploadMessage={uploadMessage}
        studyMode={studyModes[selectedModule.id] ?? null}
        studyResult={studyResults[selectedModule.id] ?? null}
        isGenerating={generatingModuleId === selectedModule.id}
        onBack={() => { setSelectedModuleId(null); setUploadMessage('') }} onUpload={() => startFileSelection(selectedModule.id)}
        onChooseMode={(mode) => setStudyModes((current) => ({ ...current, [selectedModule.id]: mode }))}
        onGenerate={(mode, depth) => generateStudyPack(selectedModule.id, mode, depth)}
        onEdit={() => showEditForm(selectedModule)} onDelete={() => deleteModule(selectedModule)}
      />}
      {view === 'modules' && !selectedModule && <ModuleList modules={modules} onOpenModule={openModule} onAddModule={showAddForm} />}
      {view === 'timeline' && <Timeline />}
      {view === 'settings' && <Settings darkMode={darkMode} onToggleTheme={() => setDarkMode((current) => !current)} />}

      <input ref={fileInput} className="visually-hidden" type="file" accept={supportedExtensions.join(',')} multiple onChange={handleFilesSelected} aria-label="Choose course documents" />
      <footer className="footer"><span>UniAI · University AI</span><span>Independent student learning concept · Not an official university service</span></footer>

      {formMode && <ModuleFormDialog
        mode={formMode} name={moduleName} code={moduleCode} setName={setModuleName} setCode={setModuleCode}
        onSave={saveModule} onClose={() => setFormMode(null)} nameInput={nameInput}
      />}
    </main>
  )
}

function Welcome({ onAddModule, onSignUp, form }: { onAddModule: () => void; onSignUp: () => void; form: ReactNode }) {
  return <main className="welcome-page">
    <header className="welcome-topbar"><span className="brand"><span className="brand-mark" aria-hidden="true">U</span><span>Uni<span className="brand-accent">AI</span></span></span><span className="welcome-tag">UNIVERSITY AI</span></header>
    <section className="welcome-content" id="home">
      <div className="welcome-orbit" aria-hidden="true"><span>✦</span><i /><b /></div>
      <p className="eyebrow">A LITTLE HELP FOR YOUR BIG IDEAS</p>
      <h1>Welcome to<br /><span>UniAI.</span></h1>
      <div className="welcome-toast" role="status"><span className="toast-sparkle" aria-hidden="true">✳</span><p>UniAI helps you turn your class notes and slides into easier ways to learn—like study notes, quizzes, flashcards, and video lessons. You can also plan your study time in one place.</p></div>
      <button className="primary-button welcome-cta" onClick={onAddModule}>＋ Add a module <span aria-hidden="true">→</span></button>
      <p className="welcome-caption">Start with a class or course. You can add more modules anytime.</p>
      <p className="welcome-privacy-note">Guest preview: your modules are temporary. <button onClick={onSignUp}>Sign up to save your learning</button></p>
    </section>
    <footer className="welcome-footer">UniAI · University AI <span>Independent learning companion</span></footer>
    {form}
  </main>
}

function Overview({ modules, onOpenModule, onOpenTimeline, onAddModule }: {
  modules: CourseModule[]; onOpenModule: (item: CourseModule) => void; onOpenTimeline: () => void; onAddModule: () => void
}) {
  return <>
    <section className="dashboard-welcome"><div><p className="eyebrow">YOUR LEARNING SPACE</p><h1>Good afternoon,<br /><span>Student.</span></h1><p className="welcome-copy">Small steps today make the next big idea easier.</p></div><div className="welcome-mark" aria-hidden="true"><span>✳</span><i /><b /></div></section>
    <section className="dashboard-grid"><div className="main-column">
      <div className="section-heading"><div><p className="eyebrow">KEEP YOUR MOMENTUM</p><h2>Your modules</h2></div><button className="primary-button small-add-button" onClick={onAddModule}>＋ Add module</button></div>
      {modules.length > 0 ? <div className="module-grid">{modules.map((item, index) => <ModuleCard key={item.id} courseModule={item} accent={index} onOpen={() => onOpenModule(item)} />)}</div> : <EmptyModules onAddModule={onAddModule} />}
    </div><aside className="side-column">
      <section className="timeline-preview"><div className="side-heading"><div><p className="eyebrow">STAY ON TRACK</p><h2>Coming up</h2></div><button className="icon-button" onClick={onOpenTimeline} aria-label="Open timeline">↗</button></div><div className="upcoming-list">{upcomingItems.slice(0, 2).map((item) => <UpcomingItem key={item.title} item={item} />)}</div><button className="full-width-link" onClick={onOpenTimeline}>Open my timeline <span aria-hidden="true">→</span></button></section>
      <section className="study-pack-card"><span className="study-pack-icon" aria-hidden="true">✦</span><p className="eyebrow">YOUR MATERIAL, YOUR WAY</p><h2>One document.<br />Many ways to learn.</h2><p>Add course materials to prepare for AI-generated notes, quizzes, flashcards, and video lessons.</p><button className="dark-button" onClick={onAddModule}>Add a module <span aria-hidden="true">→</span></button></section>
    </aside></section>
  </>
}

function EmptyModules({ onAddModule }: { onAddModule: () => void }) {
  return <section className="empty-modules"><span className="empty-module-icon" aria-hidden="true">＋</span><h3>Your learning spaces start here</h3><p>Add a module to keep its materials and study resources together.</p><button className="text-button" onClick={onAddModule}>Add your first module <span aria-hidden="true">→</span></button></section>
}

function ModuleList({ modules, onOpenModule, onAddModule }: { modules: CourseModule[]; onOpenModule: (item: CourseModule) => void; onAddModule: () => void }) {
  return <section className="page-content"><div className="page-heading"><div><p className="eyebrow">YOUR LEARNING SPACES</p><h1>My modules</h1><p className="welcome-copy">Keep course material, topics, and study resources together.</p></div><button className="primary-button small-add-button" onClick={onAddModule}>＋ Add module</button></div>
    {modules.length > 0 ? <div className="module-grid module-grid-page">{modules.map((item, index) => <ModuleCard key={item.id} courseModule={item} accent={index} onOpen={() => onOpenModule(item)} />)}</div> : <EmptyModules onAddModule={onAddModule} />}
  </section>
}

function ModuleCard({ courseModule, accent, onOpen }: { courseModule: CourseModule; accent: number; onOpen: () => void }) {
  const accentName = ['mint', 'gold', 'lavender'][accent % 3]
  return <article className={`module-card accent-${accentName}`}>
    <div className="module-card-top"><span className="module-code">{courseModule.code}</span><span className="module-symbol" aria-hidden="true">{['◈', '⌁', '◇'][accent % 3]}</span></div>
    <p className="module-faculty">YOUR MODULE</p><h3>{courseModule.name}</h3><p className="module-description">Add your slides and notes to build a personal study space.</p>
    <div className="module-card-actions"><button className="module-open" onClick={onOpen}>Open module <span aria-hidden="true">→</span></button></div>
  </article>
}

function ModuleDetail({ courseModule, documents, uploadMessage, studyMode, studyResult, isGenerating, onBack, onUpload, onChooseMode, onGenerate, onEdit, onDelete }: {
  courseModule: CourseModule; documents: LocalDocument[]; uploadMessage: string; studyMode: StudyMode; studyResult: StudyResult | null; isGenerating: boolean; onBack: () => void; onUpload: () => void; onChooseMode: (mode: Exclude<StudyMode, null>) => void; onGenerate: (mode: Exclude<StudyMode, null>, depth: StudyDepth) => void; onEdit: () => void; onDelete: () => void
}) {
  return <section className="page-content module-detail-page">
    <button className="back-link" onClick={onBack}>← <span>Back to modules</span></button>
    <div className="module-detail-heading"><div><p className="eyebrow">{courseModule.code} · YOUR MODULE</p><h1>{courseModule.name}</h1><p className="welcome-copy">Add learning materials and build a study pack for this module.</p></div><div className="module-manage-actions"><button className="secondary-button" onClick={onEdit}>Edit module</button><button className="delete-button" onClick={onDelete}>Delete</button><button className="primary-button upload-button" onClick={onUpload}><span aria-hidden="true">＋</span> Add course material</button></div></div>
    <div className="detail-grid"><section className="detail-panel material-panel"><div className="panel-heading"><div><p className="eyebrow">YOUR COURSE LIBRARY</p><h2>Course materials</h2></div><span className="count-pill">{documents.length} added</span></div>
      {documents.length === 0 ? <button className="upload-dropzone" onClick={onUpload}><span className="upload-cloud" aria-hidden="true">↑</span><strong>Add slides, notes, or readings</strong><span>PDF, PPTX, DOCX, or TXT · up to 20 MB per file</span><span className="dropzone-action">Choose files</span></button> : <div className="document-list">{documents.map((doc, index) => <div className="document-row" key={`${doc.name}-${index}`}><span className="document-icon" aria-hidden="true">▤</span><span className="document-name">{doc.name}</span><span className="document-size">{formatSize(doc.size)}</span></div>)}</div>}
      {uploadMessage && <p className="upload-feedback" role="status">{uploadMessage}</p>}<p className="prototype-notice"><span aria-hidden="true">ⓘ</span> Files stay in this browser until you choose a study mode and confirm generation.</p>
    </section><section className="detail-panel topics-panel"><div className="panel-heading"><div><p className="eyebrow">LEARNING PATH</p><h2>Topics in this module</h2></div><span className="count-pill">Build from materials</span></div>
      <div className="empty-topics"><span aria-hidden="true">✦</span><p>Add course materials and UniAI will help organize them into topics and study resources.</p></div>
      <div className="generation-preview"><span className="generation-sparkle" aria-hidden="true">✦</span><div><strong>Study pack generation</strong><p>Notes, quizzes, flashcards, and video lessons will be created from your materials.</p></div><span className="coming-pill">Coming next</span></div>
    </section></div>
    {documents.length > 0 && <StudyModePanel studyMode={studyMode} studyResult={studyResult} isGenerating={isGenerating} onChooseMode={onChooseMode} onGenerate={onGenerate} />}
  </section>
}

function StudyModePanel({ studyMode, studyResult, isGenerating, onChooseMode, onGenerate }: { studyMode: StudyMode; studyResult: StudyResult | null; isGenerating: boolean; onChooseMode: (mode: Exclude<StudyMode, null>) => void; onGenerate: (mode: Exclude<StudyMode, null>, depth: StudyDepth) => void }) {
  const [consented, setConsented] = useState(false)
  const [summaryDepth, setSummaryDepth] = useState<StudyDepth>('quick')
  useEffect(() => setConsented(false), [studyMode])
  const visibleResult = studyResult?.mode === studyMode ? studyResult : null

  return <section className="study-mode-panel" aria-labelledby="study-mode-title">
    <div className="study-mode-heading"><div><p className="eyebrow">YOUR NEXT STEP</p><h2 id="study-mode-title">How would you like to study this material?</h2><p>Choose the kind of help you want. You can change this choice later.</p></div><span className="preview-label">AI STUDY TOOLS</span></div>
    <div className="study-mode-options">
      <button className={studyMode === 'summary' ? 'study-mode-option selected' : 'study-mode-option'} onClick={() => onChooseMode('summary')} aria-pressed={studyMode === 'summary'}>
        <span className="mode-icon summary-mode-icon" aria-hidden="true">▤</span><span className="mode-text"><strong>Summary and practice</strong><span>A clear summary from your slides, followed by practice questions and a checkpoint exam.</span></span><span className="mode-arrow" aria-hidden="true">→</span>
      </button>
      <button className={studyMode === 'broaden' ? 'study-mode-option selected' : 'study-mode-option'} onClick={() => onChooseMode('broaden')} aria-pressed={studyMode === 'broaden'}>
        <span className="mode-icon broaden-mode-icon" aria-hidden="true">↗</span><span className="mode-text"><strong>Broaden my knowledge</strong><span>Explore related ideas beyond your slides, with visible references to the web sources.</span></span><span className="mode-arrow" aria-hidden="true">→</span>
      </button>
    </div>
    {studyMode === 'summary' && <div className="mode-preview summary-preview"><div className="mode-preview-heading"><span className="generation-sparkle" aria-hidden="true">✦</span><div><strong>Your summary includes an automatic checkpoint</strong><p>Choose a quick recap or a deeper review. Questions appear as soon as the summary is ready.</p></div></div><div className="summary-depth-options" role="group" aria-label="Choose summary and quiz depth"><button className={summaryDepth === 'quick' ? 'depth-option selected' : 'depth-option'} onClick={() => setSummaryDepth('quick')} aria-pressed={summaryDepth === 'quick'}><strong>Quick recap</strong><span>Short summary · 5 simple questions · multiple choice and true/false</span></button><button className={summaryDepth === 'deep' ? 'depth-option selected' : 'depth-option'} onClick={() => setSummaryDepth('deep')} aria-pressed={summaryDepth === 'deep'}><strong>Deep understanding</strong><span>More detail · 8 questions · choices, checkboxes, true/false, and a short written answer</span></button></div></div>}
    {studyMode === 'broaden' && <div className="mode-preview broaden-preview"><div className="mode-preview-heading"><span className="generation-sparkle broaden-sparkle" aria-hidden="true">↗</span><div><strong>Course material + related web research</strong><p>UniAI will keep your uploaded material separate from external sources.</p></div></div><div className="source-preview"><span><b className="source-dot course-source-dot" />Your course material</span><span className="source-plus">+</span><span><b className="source-dot web-source-dot" />Related web sources</span><span className="source-citation-note">Clickable references will appear with the explanation.</span></div></div>}
    {studyMode && <div className="generation-consent"><label><input type="checkbox" checked={consented} onChange={(event) => setConsented(event.target.checked)} /><span>I have permission to use this material. UniAI will send its extracted text to OpenAI to create the selected study resource.</span></label><button className="primary-button generate-button" disabled={!consented || isGenerating} onClick={() => onGenerate(studyMode, summaryDepth)}>{isGenerating ? 'Working on your study resource…' : studyMode === 'summary' ? 'Generate summary and checkpoint' : 'Broaden my knowledge'} {!isGenerating && <span aria-hidden="true">→</span>}</button><p>UniAI does not save a copy of the file. Extracted text is sent to OpenAI for this request. Use material you have permission to share, and use synthetic or sanitized files until the privacy review is complete.</p></div>}
    {isGenerating && <div className="generation-loading" role="status"><span className="loading-spinner" aria-hidden="true" /><span>Reading your material and preparing your study resource. This can take a little while.</span></div>}
    {visibleResult?.error && <p className="generation-error" role="alert">{visibleResult.error}</p>}
    {visibleResult?.text && <section className="generated-result"><div className="generated-result-heading"><div><p className="eyebrow">YOUR GENERATED STUDY RESOURCE</p><h3>{studyMode === 'summary' ? 'Summary' : 'Broader knowledge'}</h3></div><span className="generated-badge">Ready</span></div><StudyResourceText text={visibleResult.text} />{studyMode === 'broaden' && <div className="generated-citations"><strong>Sources</strong>{visibleResult.citations.length > 0 ? <ul>{visibleResult.citations.map((citation) => <li key={citation.url}><a href={citation.url} target="_blank" rel="noreferrer">{citation.title}</a></li>)}</ul> : <p>No clickable web sources were returned with this answer.</p>}</div>}{studyMode === 'summary' && visibleResult.quiz && <CheckpointQuiz key={visibleResult.text} quiz={visibleResult.quiz} />}</section>}
  </section>
}

function Timeline() {
  return <section className="page-content timeline-page"><div className="page-heading"><div><p className="eyebrow">MAKE TIME FOR YOUR GOALS</p><h1>My timeline</h1><p className="welcome-copy">Shape a study rhythm that works for you. Add study sessions, tests, and deadlines in one place.</p></div><button className="primary-button" disabled title="Timeline editing is part of a future build step">＋ Add to timeline</button></div>
    <section className="detail-panel timeline-panel"><div className="panel-heading"><div><p className="eyebrow">YOUR NEXT STEPS</p><h2>Upcoming</h2></div><span className="count-pill">This week</span></div><div className="timeline-list">{upcomingItems.map((item) => <UpcomingItem key={item.title} item={item} expanded />)}</div><p className="prototype-notice"><span aria-hidden="true">ⓘ</span> Timeline items are examples for the preview. Personal schedules and opt-in reminder notifications are planned for a later build step.</p></section>
  </section>
}

function CheckpointQuiz({ quiz }: { quiz: StudyQuiz }) {
  const [answers, setAnswers] = useState<Record<number, string[]>>({})
  const [writtenChecks, setWrittenChecks] = useState<Record<number, boolean>>({})
  const [submitted, setSubmitted] = useState(false)
  const objectiveQuestions = quiz.questions.filter((question) => question.type !== 'short_answer')
  const correctCount = objectiveQuestions.filter((question) => {
    const index = quiz.questions.indexOf(question)
    const selected = answers[index] ?? []
    return selected.length === question.correctAnswers.length && selected.every((answer) => question.correctAnswers.includes(answer))
  }).length
  const writtenQuestions = quiz.questions.map((question, index) => ({ question, index })).filter(({ question }) => question.type === 'short_answer')
  const passed = objectiveQuestions.length > 0 && correctCount >= Math.ceil(objectiveQuestions.length * 0.7) && writtenQuestions.every(({ index }) => writtenChecks[index] === true)

  function selectAnswer(index: number, value: string, multiple: boolean) {
    setAnswers((current) => {
      const selected = current[index] ?? []
      const next = multiple
        ? selected.includes(value) ? selected.filter((answer) => answer !== value) : [...selected, value]
        : [value]
      return { ...current, [index]: next }
    })
  }

  function resetQuiz() {
    setAnswers({})
    setWrittenChecks({})
    setSubmitted(false)
  }

  return <section className="checkpoint-quiz" aria-labelledby="checkpoint-title">
    <div className="checkpoint-quiz-heading"><div><p className="eyebrow">CHECK YOUR UNDERSTANDING</p><h3 id="checkpoint-title">{quiz.title || 'Your checkpoint'}</h3><p>{quiz.depth === 'quick' ? 'A quick knowledge check from your summary.' : 'A deeper checkpoint with different ways to show what you understand.'}</p></div><span className="quiz-count">{quiz.questions.length} questions</span></div>
    <div className="checkpoint-questions">{quiz.questions.map((question, index) => {
      const selected = answers[index] ?? []
      const isWritten = question.type === 'short_answer'
      const isCorrect = !isWritten && selected.length === question.correctAnswers.length && selected.every((answer) => question.correctAnswers.includes(answer))
      const inputType = question.type === 'multiple_select' ? 'checkbox' : 'radio'
      return <article className="checkpoint-question" key={`${index}-${question.prompt}`}>
        <div className="question-topline"><span className="question-number">{String(index + 1).padStart(2, '0')}</span><span className="question-type">{question.type === 'multiple_select' ? 'Choose all that apply' : question.type === 'true_false' ? 'True or false' : isWritten ? 'Short answer' : 'Choose one'}</span></div>
        <h4>{question.prompt}</h4>
        {question.sourceReference && <p className="question-source">From: {question.sourceReference}</p>}
        {isWritten ? <><label className="written-answer-label" htmlFor={`written-${index}`}>Your answer</label><textarea id={`written-${index}`} rows={3} placeholder="Write a brief explanation…" disabled={submitted} value={selected[0] ?? ''} onChange={(event) => setAnswers((current) => ({ ...current, [index]: [event.target.value] }))} />{submitted && <div className="question-feedback"><strong>Suggested answer</strong><p>{question.answer}</p><p>{question.explanation}</p><div className="self-check"><span>Did your answer include the key idea?</span><button className={writtenChecks[index] === true ? 'self-check-choice selected' : 'self-check-choice'} onClick={() => setWrittenChecks((current) => ({ ...current, [index]: true }))}>Yes</button><button className={writtenChecks[index] === false ? 'self-check-choice selected' : 'self-check-choice'} onClick={() => setWrittenChecks((current) => ({ ...current, [index]: false }))}>Not yet</button></div></div>}</>
          : <div className="question-options">{question.options.map((option) => <label className="question-option" key={option}><input type={inputType} name={`question-${index}`} checked={selected.includes(option)} disabled={submitted} onChange={() => selectAnswer(index, option, question.type === 'multiple_select')} /><span>{option}</span></label>)}</div>}
        {submitted && !isWritten && <div className={isCorrect ? 'question-feedback correct' : 'question-feedback needs-review'}><strong>{isCorrect ? 'Correct' : `Review this one${question.correctAnswers.length > 0 ? ` · Answer: ${question.correctAnswers.join(', ')}` : ''}`}</strong><p>{question.explanation}</p></div>}
      </article>
    })}</div>
    {!submitted ? <button className="primary-button quiz-submit" onClick={() => setSubmitted(true)}>Check my understanding <span aria-hidden="true">→</span></button> : <div className={passed ? 'quiz-outcome passed' : 'quiz-outcome review'} role="status"><div><strong>{passed ? 'Checkpoint passed' : 'Keep learning, then try again'}</strong><p>Auto-marked questions: {correctCount} of {objectiveQuestions.length} correct. Compare written answers with the suggested response.</p></div><button className="secondary-button" onClick={resetQuiz}>Try again</button></div>}
  </section>
}

function Settings({ darkMode, onToggleTheme }: { darkMode: boolean; onToggleTheme: () => void }) {
  return <section className="page-content settings-page">
    <div className="page-heading"><div><p className="eyebrow">MAKE UNIAI YOURS</p><h1>Settings</h1><p className="welcome-copy">Choose how your learning space looks and feels.</p></div></div>
    <section className="settings-card">
      <div className="settings-icon" aria-hidden="true">◐</div>
      <div className="settings-description"><h2>Appearance</h2><p>Switch between a light or dark study space. Your choice is saved in this browser.</p></div>
      <button className="theme-toggle" role="switch" aria-checked={darkMode} onClick={onToggleTheme}>
        <span className="theme-toggle-track"><span className="theme-toggle-thumb" /></span>
        <span>{darkMode ? 'Dark mode on' : 'Dark mode off'}</span>
      </button>
    </section>
    <section className="settings-card settings-motion-card">
      <div className="settings-icon motion-icon" aria-hidden="true">✧</div>
      <div className="settings-description"><h2>Motion</h2><p>UniAI uses gentle transitions and loading feedback. Your device’s reduced-motion preference is respected automatically.</p></div>
      <span className="settings-status">Subtle</span>
    </section>
    <p className="settings-note">Appearance settings are stored on this device and are not sent to UniAI.</p>
  </section>
}

function StudyResourceText({ text }: { text: string }) {
  const lines = text.replace(/\r/g, '').split('\n')
  const blocks: ReactNode[] = []
  let index = 0
  let key = 0

  while (index < lines.length) {
    const line = lines[index].trim()
    if (!line) { index += 1; continue }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line)
    if (heading) {
      const content = renderStudyInline(heading[2])
      blocks.push(heading[1].length === 1
        ? <h3 key={key++}>{content}</h3>
        : <h4 key={key++}>{content}</h4>)
      index += 1
      continue
    }

    const unordered = /^[-*+]\s+/.test(line)
    const ordered = /^\d+[.)]\s+/.test(line)
    if (unordered || ordered) {
      const items: ReactNode[] = []
      while (index < lines.length) {
        const itemLine = lines[index].trim()
        const item = unordered ? /^[-*+]\s+(.+)$/.exec(itemLine) : /^\d+[.)]\s+(.+)$/.exec(itemLine)
        if (!item) break
        items.push(<li key={key++}>{renderStudyInline(item[1])}</li>)
        index += 1
      }
      blocks.push(unordered ? <ul key={`list-${key}`}>{items}</ul> : <ol key={`list-${key}`}>{items}</ol>)
      continue
    }

    const paragraph = [line]
    index += 1
    while (index < lines.length && lines[index].trim() && !/^(#{1,3})\s+/.test(lines[index].trim()) && !/^[-*+]\s+|^\d+[.)]\s+/.test(lines[index].trim())) {
      paragraph.push(lines[index].trim())
      index += 1
    }
    blocks.push(<p key={key++}>{renderStudyInline(paragraph.join(' '))}</p>)
  }

  return <div className="generated-result-text">{blocks}</div>
}

function renderStudyInline(value: string): ReactNode[] {
  return value.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index}>{part.slice(1, -1)}</code>
    return part
  })
}

function SignupPage({ onBack }: { onBack: () => void }) {
  const [method, setMethod] = useState<'email' | 'sms'>('email')
  const [notice, setNotice] = useState('')

  function showPreviewNotice() {
    setNotice('Sign-up is a preview right now. No information was sent or saved.')
  }

  return <main className="signup-page">
    <header className="signup-topbar"><button className="brand brand-button" onClick={onBack} aria-label="Back to UniAI"><span className="brand-mark" aria-hidden="true">U</span><span>Uni<span className="brand-accent">AI</span></span></button><button className="back-link signup-back" onClick={onBack}>← <span>Back</span></button></header>
    <section className="signup-card">
      <p className="eyebrow">YOUR LEARNING, SAVED</p><h1>Create your account</h1><p className="signup-intro">Sign up to keep your modules and learning progress across visits.</p>
      <div className="signup-preview-notice" role="note"><strong>Preview only</strong><span>Account services aren’t connected yet. Please don’t enter real personal details.</span></div>
      <button className="google-button" onClick={() => setNotice('Google sign-in is not connected yet. No information was sent or saved.')}><span className="google-g" aria-hidden="true">G</span>Continue with Google</button>
      <div className="signup-divider"><span>or sign up with</span></div>
      <div className="signup-methods" role="tablist" aria-label="Choose sign-up method"><button role="tab" aria-selected={method === 'email'} className={method === 'email' ? 'method-tab selected' : 'method-tab'} onClick={() => { setMethod('email'); setNotice('') }}>Email</button><button role="tab" aria-selected={method === 'sms'} className={method === 'sms' ? 'method-tab selected' : 'method-tab'} onClick={() => { setMethod('sms'); setNotice('') }}>SMS verification</button></div>
      {method === 'email' ? <form className="signup-form" onSubmit={(event) => { event.preventDefault(); showPreviewNotice() }}>
        <label htmlFor="signup-name">Name to show in UniAI</label><input id="signup-name" autoComplete="name" placeholder="Your name" required />
        <label htmlFor="signup-username">Username</label><input id="signup-username" autoComplete="username" placeholder="Choose a username" required />
        <label htmlFor="signup-email">Email address</label><input id="signup-email" type="email" autoComplete="email" placeholder="you@example.com" required />
        <label htmlFor="signup-password">Password</label><input id="signup-password" type="password" autoComplete="new-password" placeholder="Create a password" minLength={8} required />
        <button className="primary-button signup-submit" type="submit">Create account <span aria-hidden="true">→</span></button>
      </form> : <form className="signup-form" onSubmit={(event) => { event.preventDefault(); showPreviewNotice() }}>
        <label htmlFor="sms-name">Name to show in UniAI</label><input id="sms-name" autoComplete="name" placeholder="Your name" required />
        <label htmlFor="sms-username">Username</label><input id="sms-username" autoComplete="username" placeholder="Choose a username" required />
        <label htmlFor="sms-phone">Mobile number</label><input id="sms-phone" type="tel" autoComplete="tel" placeholder="+27 00 000 0000" required />
        <button className="secondary-button send-code-button" type="button" onClick={showPreviewNotice}>Send verification code</button>
        <label htmlFor="sms-code">Verification code</label><input id="sms-code" inputMode="numeric" autoComplete="one-time-code" placeholder="Enter the code" required />
        <button className="primary-button signup-submit" type="submit">Create account <span aria-hidden="true">→</span></button>
      </form>}
      {notice && <p className="signup-feedback" role="status">{notice}</p>}
      <p className="signup-privacy">UniAI will explain what account information is used and how to manage it before real sign-up is enabled.</p>
    </section>
    <footer className="welcome-footer signup-footer">UniAI · University AI <span>Independent learning companion</span></footer>
  </main>
}

function UpcomingItem({ item, expanded = false }: { item: (typeof upcomingItems)[number]; expanded?: boolean }) {
  return <article className={`upcoming-item ${expanded ? 'upcoming-expanded' : ''}`}><div className="upcoming-date"><strong>{item.day.split(',')[0]}</strong><span>{item.day.includes(',') ? item.day.split(',')[1] : item.time}</span></div><span className="timeline-marker" aria-hidden="true" /><div className="upcoming-description"><span className="upcoming-type">{item.type} · {item.module}</span><h3>{item.title}</h3>{expanded && <p>{item.time} · Reminder preferences will be controlled by the learner.</p>}</div><span className="upcoming-time">{expanded ? item.time : '›'}</span></article>
}

function ModuleFormDialog({ mode, name, code, setName, setCode, onSave, onClose, nameInput }: {
  mode: Exclude<FormMode, null>; name: string; code: string; setName: (value: string) => void; setCode: (value: string) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void; onClose: () => void; nameInput: RefObject<HTMLInputElement | null>
}) {
  return <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="module-dialog" role="dialog" aria-modal="true" aria-labelledby="module-dialog-title">
    <button className="dialog-close" onClick={onClose} aria-label="Close">×</button><p className="eyebrow">YOUR LEARNING SPACE</p><h2 id="module-dialog-title">{mode === 'add' ? 'Add a module' : 'Edit module'}</h2><p className="dialog-copy">Use the name and code that make sense to you. You can change them later.</p>
    <form onSubmit={onSave}><label htmlFor="module-name">Module name</label><input ref={nameInput} id="module-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Biology" required maxLength={80} /><label htmlFor="module-code">Module code</label><input id="module-code" value={code} onChange={(event) => setCode(event.target.value)} placeholder="e.g. BIO 101 or Class 7B" required maxLength={30} /><p className="local-save-note">Temporary guest preview: this module clears when the tab session ends. Account saving is coming with sign-up.</p><div className="dialog-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit">{mode === 'add' ? 'Add module' : 'Save changes'}</button></div></form>
  </section></div>
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default App
