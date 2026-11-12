import { initRouter } from './router.js';
import { supabase } from './lib/supabase.js';

let currentUser = null;
let isLoginMode = true;
let allCategories = [];
let allKnowledges = [];
let currentReview = null;
let currentCalendarDate = new Date(); // Variável para o Calendário

// Variáveis do Modo Foco
let focusInterval = null;
let focusTimeLeft = 25 * 60; // 25 minutos em segundos
let isFocusRunning = false;

document.addEventListener('DOMContentLoaded', async () => {
  const authScreen = document.getElementById('auth-screen');
  const appScreen = document.getElementById('app-screen');
  const userNameDisplay = document.getElementById('user-name-display');
  
  checkUserSession();

  // --- AUTENTICAÇÃO ---
  document.getElementById('toggle-auth').addEventListener('click', (e) => {
    e.preventDefault();
    isLoginMode = !isLoginMode;
    document.getElementById('auth-title').textContent = isLoginMode ? 'Bem-vindo de volta' : 'Crie sua conta';
    document.getElementById('auth-submit').textContent = isLoginMode ? 'Entrar' : 'Cadastrar';
    document.getElementById('name-group').style.display = isLoginMode ? 'none' : 'block';
    document.getElementById('toggle-text').textContent = isLoginMode ? 'Ainda não tem conta?' : 'Já tem uma conta?';
    document.getElementById('toggle-auth').textContent = isLoginMode ? 'Cadastre-se' : 'Faça login';
  });

  document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('auth-submit');
    btn.disabled = true; btn.textContent = 'Carregando...';
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const name = document.getElementById('name').value;

    try {
      if (isLoginMode) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: name } } });
        if (error) throw error;
      }
      checkUserSession();
    } catch (error) { alert('Erro: ' + error.message); } 
    finally { btn.disabled = false; btn.textContent = isLoginMode ? 'Entrar' : 'Cadastrar'; }
  });

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await supabase.auth.signOut(); checkUserSession();
  });

  async function checkUserSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      currentUser = session.user;
      authScreen.style.display = 'none'; appScreen.style.display = 'flex';
      const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', currentUser.id).single();
      if (profile) userNameDisplay.textContent = profile.display_name;
      
      initRouter();
      await loadCategories();
      await loadKnowledges();
      await loadReviews();
      updateDashboard();
      loadStats();
      loadAchievements();
    } else {
      currentUser = null; authScreen.style.display = 'flex'; appScreen.style.display = 'none';
    }
  }

  window.addEventListener('hashchange', () => {
    const hash = window.location.hash;
    if (hash === '#stats') loadStats();
    if (hash === '#achievements') loadAchievements();
    if (hash === '#dashboard') updateDashboard();
    if (hash === '#library') loadKnowledges();
    if (hash === '#reviews') loadReviews();
    if (hash === '#history') loadHistory();
    if (hash === '#settings') loadSettings();
    if (hash === '#calendar') loadCalendar();
  });

  // --- CATEGORIAS E CONHECIMENTOS ---
  async function loadCategories() {
    const { data } = await supabase.from('categories').select('*').order('name');
    allCategories = data || [];
    const selectForm = document.getElementById('k-category');
    const selectFilter = document.getElementById('filter-category');
    if(!selectForm) return;
    selectForm.innerHTML = '<option value="">Selecione...</option>';
    selectFilter.innerHTML = '<option value="">Todas as categorias</option>';
    allCategories.forEach(cat => {
      selectForm.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
      selectFilter.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
    });
  }

  async function loadKnowledges() {
    const { data } = await supabase.from('knowledges').select('*, categories(name, color), knowledge_videos(url)').order('created_at', { ascending: false });
    allKnowledges = data || [];
    renderLibrary();
  }

  function renderLibrary() {
    const list = document.getElementById('knowledge-list');
    if(!list) return;
    const search = document.getElementById('search-input').value.toLowerCase();
    const filter = document.getElementById('filter-category').value;

    const filtered = allKnowledges.filter(k => {
      const matchSearch = k.title.toLowerCase().includes(search) || (k.notes && k.notes.toLowerCase().includes(search));
      const matchFilter = filter === '' || k.category_id === filter;
      return matchSearch && matchFilter;
    });

    if (filtered.length === 0) { list.innerHTML = '<p class="text-muted" style="grid-column: 1/-1;">Nenhum conhecimento encontrado.</p>'; return; }

    list.innerHTML = filtered.map(k => {
      const catName = k.categories ? k.categories.name : 'Sem categoria';
      const catColor = k.categories ? k.categories.color : '#64748b';
      const video = k.knowledge_videos && k.knowledge_videos.length > 0 ? k.knowledge_videos[0].url : '';
      
      return `
        <div class="card knowledge-item">
          <div>
            <span class="category-badge" style="background-color: ${catColor}">${catName}</span>
            <h3>${k.title}</h3>
            <p>${k.notes || 'Sem anotações...'}</p>
          </div>
          <div class="knowledge-actions" style="display: flex; gap: 0.5rem; margin-top: auto; padding-top: 1rem; border-top: 1px solid var(--border);">
            ${video ? `<a href="${video}" target="_blank" class="btn btn-outline" style="font-size: 0.8rem; padding: 0.5rem 1rem; flex: 1;">Vídeo</a>` : '<div style="flex: 1;"></div>'}
            <button onclick="editKnowledge('${k.id}')" class="btn btn-outline" style="font-size: 0.8rem; padding: 0.5rem 1rem;">Editar</button>
            <button onclick="deleteKnowledge('${k.id}')" class="btn" style="background-color: var(--danger); font-size: 0.8rem; padding: 0.5rem 1rem;">Excluir</button>
          </div>
        </div>
      `;
    }).join('');
  }

  document.getElementById('search-input')?.addEventListener('input', renderLibrary);
  document.getElementById('filter-category')?.addEventListener('change', renderLibrary);

  // --- CRIAÇÃO DE CONHECIMENTO ---
  document.getElementById('toggle-new-category')?.addEventListener('click', (e) => {
    e.preventDefault(); const group = document.getElementById('new-category-group');
    group.style.display = group.style.display === 'none' ? 'block' : 'none';
  });

  document.getElementById('btn-create-category')?.addEventListener('click', async () => {
    const input = document.getElementById('k-new-category'); const name = input.value.trim();
    if (!name) return alert('Digite um nome.');
    const colors = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#ec4899'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const { data, error } = await supabase.from('categories').insert([{ user_id: currentUser.id, name, color: randomColor }]).select().single();
    if (error) return alert('Erro: ' + error.message);
    input.value = ''; document.getElementById('new-category-group').style.display = 'none';
    await loadCategories(); document.getElementById('k-category').value = data.id;
  });

  document.getElementById('knowledge-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-save-knowledge');
    btn.disabled = true; btn.textContent = 'Salvando...';
    const title = document.getElementById('k-title').value;
    const question = document.getElementById('k-question')?.value || null;
    const answer = document.getElementById('k-answer')?.value || null;
    const category_id = document.getElementById('k-category').value || null;
    const notes = document.getElementById('k-notes').value;
    const videoUrl = document.getElementById('k-video').value;

    try {
      const { data: kData, error: kError } = await supabase.from('knowledges').insert([{ user_id: currentUser.id, category_id, title, notes, question, answer }]).select().single();
      if (kError) throw kError;
      if (videoUrl) {
        const { error: vError } = await supabase.from('knowledge_videos').insert([{ knowledge_id: kData.id, url: videoUrl }]);
        if (vError) throw vError;
      }
      await supabase.rpc('grant_xp', { p_user_id: currentUser.id, p_source_type: 'knowledge_created', p_source_id: kData.id, p_xp: 10 });
      await supabase.rpc('check_achievements', { p_user_id: currentUser.id });
      
      alert('Salvo com sucesso! 6 revisões programadas.');
      document.getElementById('knowledge-form').reset();
      await loadKnowledges(); await loadReviews(); updateDashboard();
      window.location.hash = '#library';
    } catch (error) { alert('Erro ao salvar: ' + error.message); } 
    finally { btn.disabled = false; btn.textContent = 'Salvar Conhecimento'; }
  });

  // --- EDITAR E EXCLUIR CONHECIMENTOS ---
  window.editKnowledge = (id) => {
    const knowledge = allKnowledges.find(k => k.id === id);
    if (!knowledge) return;

    document.getElementById('edit-id').value = knowledge.id;
    document.getElementById('edit-title').value = knowledge.title;
    document.getElementById('edit-question').value = knowledge.question || '';
    document.getElementById('edit-answer').value = knowledge.answer || '';
    document.getElementById('edit-notes').value = knowledge.notes;
    document.getElementById('edit-video').value = knowledge.knowledge_videos?.[0]?.url || '';

    document.getElementById('edit-modal').style.display = 'flex';
  };

  document.getElementById('btn-close-modal')?.addEventListener('click', () => {
    document.getElementById('edit-modal').style.display = 'none';
  });

  document.getElementById('edit-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    const title = document.getElementById('edit-title').value;
    const question = document.getElementById('edit-question')?.value || null;
    const answer = document.getElementById('edit-answer')?.value || null;
    const notes = document.getElementById('edit-notes').value;
    const videoUrl = document.getElementById('edit-video').value;

    try {
      const { error: kError } = await supabase.from('knowledges').update({ title, notes, question, answer }).eq('id', id);
      if (kError) throw kError;

      await supabase.from('knowledge_videos').delete().eq('knowledge_id', id);
      if (videoUrl) {
        await supabase.from('knowledge_videos').insert([{ knowledge_id: id, url: videoUrl }]);
      }

      document.getElementById('edit-modal').style.display = 'none';
      alert('Conhecimento atualizado!');
      await loadKnowledges();
    } catch (error) {
      alert('Erro ao editar: ' + error.message);
    }
  });

  window.deleteKnowledge = async (id) => {
    const confirmar = confirm('Tem certeza que deseja excluir este conhecimento? Todas as revisões dele serão apagadas.');
    if (!confirmar) return;

    try {
      const { error } = await supabase.from('knowledges').delete().eq('id', id);
      if (error) throw error;
      
      alert('Conhecimento excluído com sucesso.');
      await loadKnowledges();
      await loadReviews();
      updateDashboard();
    } catch (error) {
      alert('Erro ao excluir: ' + error.message);
    }
  };

  // --- LÓGICA DE REVISÕES ---
  async function loadReviews() {
    const today = new Date().toISOString();
    const { data } = await supabase.from('reviews')
      .select('*, knowledges(title, notes, question, answer, categories(name, color), knowledge_videos(url))')
      .eq('status', 'pending')
      .lte('scheduled_date', today)
      .order('scheduled_date', { ascending: true });
    
    const todasRevisoes = data || [];
    const revisoesDoDia = todasRevisoes.slice(0, 10);
    
    renderReviews(revisoesDoDia);
  }

  function renderReviews(reviews) {
    const list = document.getElementById('reviews-list');
    if(!list) return;
    if (reviews.length === 0) {
      list.innerHTML = '<div class="card"><p class="text-muted">Tudo em dia! Nenhuma revisão pendente no momento.</p></div>';
      return;
    }

    list.innerHTML = reviews.map(r => {
      const scheduled = new Date(r.scheduled_date);
      const today = new Date();
      today.setHours(0,0,0,0); scheduled.setHours(0,0,0,0);
      const isLate = scheduled < today;
      
      return `
        <div class="card review-card">
          <div class="review-info">
            <h3>${r.knowledges.title}</h3>
            <p>Revisão ${r.review_number} • Agendada para: ${scheduled.toLocaleDateString()}</p>
          </div>
          <div style="display: flex; align-items: center; gap: 1rem;">
            <span class="review-status ${isLate ? 'status-late' : 'status-today'}">${isLate ? 'Atrasada' : 'Para Hoje'}</span>
            <button class="btn btn-review" onclick="startReview('${r.id}')">Revisar</button>
          </div>
        </div>
      `;
    }).join('');
  }

  window.startReview = (reviewId) => {
    supabase.from('reviews')
      .select('*, knowledges(title, notes, question, answer, categories(name, color), knowledge_videos(url))')
      .eq('id', reviewId).single().then(({data}) => {
        if(!data) return;
        currentReview = data;
        
        document.getElementById('review-title').textContent = data.knowledges.title;
        document.getElementById('review-notes').textContent = data.knowledges.notes || 'Nenhuma anotação cadastrada.';
        
        const catBadge = document.getElementById('review-category');
        catBadge.textContent = data.knowledges.categories ? data.knowledges.categories.name : 'Sem categoria';
        catBadge.style.backgroundColor = data.knowledges.categories ? data.knowledges.categories.color : '#64748b';

        const videoLink = document.getElementById('review-video-link');
        const videoContainer = document.getElementById('review-video-container');
        if (data.knowledges.knowledge_videos && data.knowledges.knowledge_videos.length > 0) {
          videoLink.href = data.knowledges.knowledge_videos[0].url;
          videoContainer.style.display = 'block';
        } else {
          videoContainer.style.display = 'none';
        }

        // --- LÓGICA DO FLASHCARD ---
        const flashcardContainer = document.getElementById('flashcard-container');
        const noFlashcardMessage = document.getElementById('no-flashcard-message');
        const flashcardQuestion = document.getElementById('flashcard-question');
        const flashcardAnswer = document.getElementById('flashcard-answer');

        if (data.knowledges.question && data.knowledges.answer) {
          flashcardContainer.style.display = 'block';
          noFlashcardMessage.style.display = 'none';
          flashcardQuestion.textContent = data.knowledges.question;
          flashcardAnswer.textContent = data.knowledges.answer;
          flashcardAnswer.classList.add('hidden');
        } else {
          flashcardContainer.style.display = 'none';
          noFlashcardMessage.style.display = 'block';
        }

        document.getElementById('review-step-1').style.display = 'block';
        document.getElementById('review-step-2').style.display = 'none';
        window.location.hash = '#active-review';
      });
  };

  document.getElementById('flashcard')?.addEventListener('click', () => {
    document.getElementById('flashcard-answer').classList.toggle('hidden');
  });

  document.getElementById('btn-show-notes')?.addEventListener('click', () => {
    document.getElementById('review-step-1').style.display = 'none';
    document.getElementById('review-step-2').style.display = 'block';
  });

  document.getElementById('btn-complete-review')?.addEventListener('click', async () => {
    if (!currentReview) return;
    const btn = document.getElementById('btn-complete-review');
    btn.disabled = true; btn.textContent = 'Concluindo...';

    try {
      const now = new Date().toISOString();
      const { error: rError } = await supabase.from('reviews').update({ status: 'done', completed_at: now }).eq('id', currentReview.id);
      if (rError) throw rError;

      await supabase.from('review_history').insert([{ user_id: currentUser.id, review_id: currentReview.id, method_used: 'notes' }]);

      const nextReviewNum = currentReview.review_number + 1;
      if (nextReviewNum <= 6) {
        const intervals = [1, 3, 7, 14, 30, 60];
        const nextInterval = intervals[nextReviewNum - 1];
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + nextInterval);

        await supabase.from('reviews').update({ scheduled_date: nextDate.toISOString() })
          .eq('knowledge_id', currentReview.knowledge_id)
          .eq('review_number', nextReviewNum);
      }

      await supabase.rpc('grant_xp', { p_user_id: currentUser.id, p_source_type: 'review_completed', p_source_id: currentReview.id, p_xp: 15 });
      await supabase.rpc('check_achievements', { p_user_id: currentUser.id });

      alert('Revisão concluída! +15 XP');
      await loadReviews(); updateDashboard();
      window.location.hash = '#reviews';
    } catch (error) {
      alert('Erro ao concluir: ' + error.message);
    } finally {
      btn.disabled = false; btn.textContent = 'Sim, concluí a revisão (+15 XP)';
      currentReview = null;
    }
  });

  // --- DASHBOARD ---
  async function updateDashboard() {
    if (!currentUser) return;
    const today = new Date().toISOString();
    const { count: kCount } = await supabase.from('knowledges').select('*', { count: 'exact', head: true });
    const { count: rCount } = await supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('status', 'pending').lte('scheduled_date', today);
    const { data: profile } = await supabase.from('profiles').select('xp_total, level').eq('id', currentUser.id).single();

    const dashK = document.getElementById('dash-knowledges');
    const dashR = document.getElementById('dash-reviews');
    const dashXP = document.getElementById('dash-xp');
    
    if(dashK) dashK.textContent = kCount || 0;
    if(dashR) dashR.textContent = rCount || 0;
    
    if(dashXP && profile) {
      dashXP.textContent = profile.xp_total;
      
      const currentLevel = profile.level;
      const currentLevelXP = 25 * currentLevel * (currentLevel - 1);
      const nextLevelXP = 25 * (currentLevel + 1) * currentLevel;
      
      const progress = ((profile.xp_total - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100;
      
      const bar = document.getElementById('xp-progress-bar');
      if(bar) bar.style.width = `${Math.min(progress, 100)}%`;
      
      const nextLvlText = document.getElementById('xp-next-level');
      if(nextLvlText) nextLvlText.textContent = `Nível ${currentLevel} • Faltam ${nextLevelXP - profile.xp_total} XP para o Nível ${currentLevel + 1}`;
    }
  }

  // --- ESTATÍSTICAS ---
  async function loadStats() {
    if (!currentUser) return;
    const { count: reviewCount } = await supabase.from('review_history').select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id);
    
    const statsRev = document.getElementById('stats-total-reviews');
    if(statsRev) statsRev.textContent = reviewCount || 0;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { data: history } = await supabase.from('review_history').select('completed_at').eq('user_id', currentUser.id).gte('completed_at', sevenDaysAgo.toISOString());
    
    const uniqueDays = new Set(history?.map(h => new Date(h.completed_at).toDateString()) || []);
    const statsDays = document.getElementById('stats-active-days');
    if(statsDays) statsDays.textContent = uniqueDays.size;

    const { data: knowledges } = await supabase.from('knowledges').select('categories(name, color)').eq('user_id', currentUser.id);
    
    const categoryCounts = {};
    const categoryColors = {};
    
    knowledges?.forEach(k => {
      const name = k.categories ? k.categories.name : 'Sem categoria';
      const color = k.categories ? k.categories.color : '#64748b';
      categoryCounts[name] = (categoryCounts[name] || 0) + 1;
      categoryColors[name] = color;
    });

    const canvas = document.getElementById('chart-categories');
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    
    if (window.myChart) window.myChart.destroy();
    
    window.myChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: Object.keys(categoryCounts),
        datasets: [{
          data: Object.values(categoryCounts),
          backgroundColor: Object.keys(categoryCounts).map(name => categoryColors[name]),
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { color: '#94a3b8', font: { family: 'Inter' } } }
        }
      }
    });
  }

  // --- CONQUISTAS ---
  async function loadAchievements() {
    if (!currentUser) return;
    const { data: allAch } = await supabase.from('achievements').select('*').order('xp_reward');
    const { data: userAch } = await supabase.from('user_achievements').select('achievement_id').eq('user_id', currentUser.id);
    
    const unlockedIds = userAch?.map(a => a.achievement_id) || [];
    const list = document.getElementById('achievements-list');
    if(!list) return;

    list.innerHTML = allAch?.map(ach => {
      const isUnlocked = unlockedIds.includes(ach.id);
      const icons = { 'book-open': '📖', 'library': '📚', 'check-circle': '✅', 'award': '🏆', 'calendar-check': '📅', 'compass': '🧭', 'star': '⭐', 'zap': '⚡' };
      const iconStr = icons[ach.icon] || '🎖️';

      return `
        <div class="card achievement-card ${isUnlocked ? 'unlocked' : ''}">
          <div class="achievement-icon" style="font-size: 1.5rem;">${iconStr}</div>
          <div class="achievement-info">
            <h3>${ach.name}</h3>
            <p>${ach.description}</p>
            <small style="color: var(--primary); font-weight: 500;">+${ach.xp_reward} XP</small>
          </div>
        </div>
      `;
    }).join('');
  }

  // --- HISTÓRICO ---
  async function loadHistory() {
    if (!currentUser) return;
    const { data: historyData } = await supabase.from('review_history')
      .select('*, reviews(knowledges(title))')
      .eq('user_id', currentUser.id)
      .order('completed_at', { ascending: false })
      .limit(20);

    const list = document.getElementById('history-list');
    if (!list) return;

    if (!historyData || historyData.length === 0) {
      list.innerHTML = '<div class="card"><p class="text-muted">Nenhuma atividade registrada ainda.</p></div>';
      return;
    }

    list.innerHTML = historyData.map(h => {
      const date = new Date(h.completed_at).toLocaleString('pt-BR');
      const title = h.reviews?.knowledges?.title || 'Conhecimento apagado';
      return `
        <div class="card" style="padding: 1rem;">
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem;">${date}</p>
          <p><strong style="color: var(--success);">✔ Revisão concluída:</strong> ${title}</p>
        </div>
      `;
    }).join('');
  }

  // --- CONFIGURAÇÕES ---
  async function loadSettings() {
    if (!currentUser) return;
    const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', currentUser.id).single();
    const input = document.getElementById('settings-name');
    if (profile && input) input.value = profile.display_name;
  }

  document.getElementById('btn-save-profile')?.addEventListener('click', async () => {
    const newName = document.getElementById('settings-name').value;
    const { error } = await supabase.from('profiles').update({ display_name: newName }).eq('id', currentUser.id);
    if (error) return alert('Erro: ' + error.message);
    alert('Nome atualizado com sucesso!');
    document.getElementById('user-name-display').textContent = newName;
  });

  document.getElementById('btn-delete-account')?.addEventListener('click', async () => {
    const confirmacao = prompt("Tem certeza? Digite 'APAGAR' para confirmar:");
    if (confirmacao !== 'APAGAR') return;
    alert('Por segurança, entre em contato com o suporte para apagar sua conta permanentemente.');
  });

  // --- CALENDÁRIO (ATUALIZADO COM TÍTULOS) ---
  async function loadCalendar() {
    if (!currentUser) return;
    
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    document.getElementById('calendar-month-year').textContent = currentCalendarDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
    
    // Busca a data, o número da revisão e o título do conhecimento
    const { data: reviews } = await supabase.from('reviews')
      .select('scheduled_date, review_number, knowledges(title)')
      .eq('user_id', currentUser.id)
      .eq('status', 'pending');

    // Agrupa as revisões por data
    const reviewMap = new Map();
    reviews?.forEach(r => {
      const d = new Date(r.scheduled_date);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      
      // Formato: "Rev 1 - Introdução ao React"
      const reviewText = `Rev ${r.review_number} - ${r.knowledges?.title || 'Sem título'}`;
      
      if (!reviewMap.has(key)) reviewMap.set(key, []);
      reviewMap.get(key).push(reviewText);
    });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const calendarDays = document.getElementById('calendar-days');
    if (!calendarDays) return;
    calendarDays.innerHTML = '';

    for (let i = 0; i < firstDay; i++) {
      calendarDays.innerHTML += `<div class="calendar-day empty"></div>`;
    }

    const today = new Date();
    for (let day = 1; day <= daysInMonth; day++) {
      const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
      const dateKey = `${year}-${month}-${day}`;
      const dayReviews = reviewMap.get(dateKey) || [];
      
      // Junta as revisões com quebra de linha no atributo 'title'
      const tooltipText = dayReviews.join('&#10;');

      calendarDays.innerHTML += `
        <div class="calendar-day ${isToday ? 'today' : ''} ${dayReviews.length > 0 ? 'has-review' : ''}" title="${tooltipText}">
          <span>${day}</span>
        </div>
      `;
    }
  }

  document.getElementById('btn-prev-month')?.addEventListener('click', () => {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
    loadCalendar();
  });

  document.getElementById('btn-next-month')?.addEventListener('click', () => {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
    loadCalendar();
  });

  // --- MODO FOCO ---
  function updateFocusDisplay() {
    const minutes = Math.floor(focusTimeLeft / 60);
    const seconds = focusTimeLeft % 60;
    document.getElementById('focus-time').textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  document.getElementById('btn-start-focus')?.addEventListener('click', () => {
    if (isFocusRunning) return;
    document.getElementById('btn-start-focus').style.display = 'none';
    document.getElementById('focus-widget').style.display = 'block';
    isFocusRunning = true;
    
    if (focusTimeLeft === 0) focusTimeLeft = 25 * 60;
    updateFocusDisplay();

    focusInterval = setInterval(() => {
      focusTimeLeft--;
      updateFocusDisplay();

      if (focusTimeLeft <= 0) {
        clearInterval(focusInterval);
        isFocusRunning = false;
        alert('Foco concluído! Faça uma pausa de 5 minutos.');
        document.getElementById('focus-widget').style.display = 'none';
        document.getElementById('btn-start-focus').style.display = 'flex';
        focusTimeLeft = 25 * 60;
      }
    }, 1000);
  });

  document.getElementById('btn-focus-stop')?.addEventListener('click', () => {
    clearInterval(focusInterval);
    isFocusRunning = false;
    focusTimeLeft = 25 * 60;
    document.getElementById('focus-widget').style.display = 'none';
    document.getElementById('btn-start-focus').style.display = 'flex';
  });
});