(() => {
  const url = window.NEXA_SUPABASE_URL;
  const key = window.NEXA_SUPABASE_PUBLISHABLE_KEY || window.NEXA_SUPABASE_ANON_KEY;
  const configured = Boolean(url && key && !key.startsWith('COLE_'));
  const client = configured ? window.supabase.createClient(url, key) : null;
  const fail = message => { throw new Error(message); };
  const assertClient = () => client || fail('A NEXA ainda não foi conectada ao Supabase. Configure a chave pública em supabase-config.js.');
  const unwrap = ({ data, error }) => { if (error) throw error; return data; };
  const summarySelect = 'id,exam_id,title,introduction,content,content_type,pdf_path,pdf_name,author_id,status,created_at,updated_at,profiles!summaries_author_id_fkey(username),exams!summaries_exam_id_fkey(id,subject,title,class_time)';
  const mapExam = row => row && ({ id: row.id, subject: row.subject, title: row.title, examDate: row.exam_date, classTime: row.class_time });
  const mapSummary = row => row && ({
    id: row.id, examId: row.exam_id, title: row.title, introduction: row.introduction || '', content: row.content || '',
    contentType: row.content_type, pdfPath: row.pdf_path, pdfName: row.pdf_name, authorId: row.author_id,
    authorName: row.profiles?.username || 'NEXA', status: row.status, createdAt: row.created_at,
    updatedAt: row.updated_at, exam: mapExam(row.exams)
  });
  const mapUser = (user, profile) => user && ({ id: user.id, email: user.email, username: profile?.username || user.email?.split('@')[0] || 'Estudante', role: profile?.role || 'student', createdAt: user.created_at });
  const currentUser = async () => {
    const api = assertClient();
    const { data: { user }, error } = await api.auth.getUser();
    if (error || !user) return null;
    const profile = unwrap(await api.from('profiles').select('username,role').eq('id', user.id).maybeSingle());
    return mapUser(user, profile);
  };
  const getExams = async () => (unwrap(await assertClient().from('exams').select('*').order('subject')) || []).map(mapExam);
  const getSummaries = async () => (unwrap(await assertClient().from('summaries').select(summarySelect).order('updated_at', { ascending: false })) || []).map(mapSummary);
  const getSummary = async id => mapSummary(unwrap(await assertClient().from('summaries').select(summarySelect).eq('id', id).maybeSingle()));
  const saveExam = async exam => mapExam(unwrap(await assertClient().from('exams').upsert({ id: exam.id || undefined, subject: exam.subject, title: exam.title, exam_date: exam.examDate || null, class_time: exam.classTime }).select().single()));
  const deleteExam = async id => { unwrap(await assertClient().from('exams').delete().eq('id', id)); };
  const saveSummary = async summary => {
    const user = await currentUser(); if (!user) fail('Entre na sua conta antes de salvar.');
    const row = { id: summary.id || undefined, exam_id: summary.examId, title: summary.title, introduction: summary.introduction || '', content: summary.content || '', content_type: summary.contentType || 'written', pdf_path: summary.pdfPath || null, pdf_name: summary.pdfName || null, author_id: summary.authorId || user.id, status: summary.status || 'draft' };
    return mapSummary(unwrap(await assertClient().from('summaries').upsert(row).select(summarySelect).single()));
  };
  const deleteSummary = async id => { unwrap(await assertClient().from('summaries').delete().eq('id', id)); };
  const favoriteIds = async () => { const user = await currentUser(); if (!user) return []; return (unwrap(await assertClient().from('favorites').select('summary_id').eq('user_id', user.id)) || []).map(row => row.summary_id); };
  const toggleFavorite = async id => { const user = await currentUser(); if (!user) return null; const existing = unwrap(await assertClient().from('favorites').select('summary_id').eq('user_id', user.id).eq('summary_id', id).maybeSingle()); if (existing) { unwrap(await assertClient().from('favorites').delete().eq('user_id', user.id).eq('summary_id', id)); return false; } unwrap(await assertClient().from('favorites').insert({ user_id: user.id, summary_id: id })); return true; };
  const uploadPdf = async file => {
    if (!file || file.size > 10 * 1024 * 1024 || (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf'))) fail('Envie um PDF válido de até 10 MB.');
    const header = await file.slice(0, 4).text(); if (header !== '%PDF') fail('O arquivo selecionado não é um PDF válido.');
    const user = await currentUser(); if (!user) fail('Entre na sua conta antes de enviar um PDF.');
    const path = `${user.id}/${crypto.randomUUID()}.pdf`;
    unwrap(await assertClient().storage.from('summary-pdfs').upload(path, file, { contentType: 'application/pdf', upsert: false }));
    return { path, name: file.name };
  };
  const publicPdfUrl = path => path ? assertClient().storage.from('summary-pdfs').getPublicUrl(path).data.publicUrl : '';
  const uploadTutorialVideo = async file => {
    if (!file) fail('Escolha um arquivo de vídeo.');
    if (!file.type.startsWith('video/')) fail('Escolha um arquivo de vídeo válido.');
    if (file.size > 100 * 1024 * 1024) fail('O vídeo deve ter no máximo 100 MB.');
    const user = await currentUser(); if (!user) fail('Entre na sua conta antes de enviar um vídeo.');
    const ext = (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'mp4';
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    unwrap(await assertClient().storage.from('tutorial-videos').upload(path, file, { contentType: file.type || 'video/mp4', cacheControl: '3600', upsert: false }));
    return { path, url: assertClient().storage.from('tutorial-videos').getPublicUrl(path).data.publicUrl, name: file.name };
  };
  const uploadTutorialThumbnail = async file => {
    if (!file) fail('Escolha uma imagem para a capa.');
    if (!file.type.startsWith('image/')) fail('Escolha uma imagem válida para a capa.');
    if (file.size > 5 * 1024 * 1024) fail('A capa deve ter no máximo 5 MB.');
    const user = await currentUser(); if (!user) fail('Entre na sua conta antes de enviar a capa.');
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'jpg';
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    unwrap(await assertClient().storage.from('tutorial-thumbnails').upload(path, file, { contentType: file.type || 'image/jpeg', cacheControl: '3600', upsert: false }));
    return { path, url: assertClient().storage.from('tutorial-thumbnails').getPublicUrl(path).data.publicUrl, name: file.name };
  };
  const deleteTutorialFile = async (bucket, path) => {
    if (!path) return;
    const { error } = await assertClient().storage.from(bucket).remove([path]);
    if (error) throw error;
  };
  const getFaqs = async (includeInactive = false) => {
    let query = assertClient().from('faqs').select('id,question,answer,display_order,active,created_at,updated_at').order('display_order', { ascending: true }).order('created_at', { ascending: true });
    if (!includeInactive) query = query.eq('active', true);
    return unwrap(await query) || [];
  };
  const saveFaq = async faq => unwrap(await assertClient().from('faqs').upsert({ id: faq.id || undefined, question: faq.question, answer: faq.answer, display_order: Number(faq.displayOrder || 0), active: faq.active !== false, updated_at: new Date().toISOString() }).select().single());
  const deleteFaq = async id => { unwrap(await assertClient().from('faqs').delete().eq('id', id)); };
  const getTutorials = async (includeInactive = false) => {
    let query = assertClient().from('tutorials').select('id,title,description,video_url,video_path,thumbnail_url,thumbnail_path,display_order,active,created_at,updated_at').order('display_order', { ascending: true }).order('created_at', { ascending: true });
    if (!includeInactive) query = query.eq('active', true);
    return unwrap(await query) || [];
  };
  const saveTutorial = async tutorial => unwrap(await assertClient().from('tutorials').upsert({
    id: tutorial.id || undefined,
    title: tutorial.title,
    description: tutorial.description || '',
    video_url: tutorial.videoUrl,
    video_path: tutorial.videoPath || null,
    thumbnail_url: tutorial.thumbnailUrl || null,
    thumbnail_path: tutorial.thumbnailPath || null,
    display_order: Number(tutorial.displayOrder || 0),
    active: tutorial.active !== false,
    updated_at: new Date().toISOString()
  }).select().single());
  const deleteTutorial = async id => {
    const item = unwrap(await assertClient().from('tutorials').select('video_path,thumbnail_path').eq('id', id).maybeSingle());
    unwrap(await assertClient().from('tutorials').delete().eq('id', id));
    await deleteTutorialFile('tutorial-videos', item?.video_path);
    await deleteTutorialFile('tutorial-thumbnails', item?.thumbnail_path);
  };
  window.nexaApi = { configured, currentUser, getExams, getSummaries, getSummary, saveExam, deleteExam, saveSummary, deleteSummary, favoriteIds, toggleFavorite, uploadPdf, publicPdfUrl, uploadTutorialVideo, uploadTutorialThumbnail, getFaqs, saveFaq, deleteFaq, getTutorials, saveTutorial, deleteTutorial };
  window.authService = {
    signUp: async (email, password) => { const { data, error } = await assertClient().auth.signUp({ email: email.trim(), password }); if (error) throw error; return data; },
    login: async (email, password) => { const { data, error } = await assertClient().auth.signInWithPassword({ email: email.trim(), password }); if (error) throw error; return data.user; },
    logout: async () => { const { error } = await assertClient().auth.signOut(); if (error) throw error; }
  };
})();