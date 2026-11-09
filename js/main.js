import { initRouter } from './router.js';
import { supabase } from './lib/supabase.js';

let currentUser = null;
let isLoginMode = true;
let allCategories = [];
let allKnowledges = [];
let currentReview = null; // Guarda a revisão que está sendo feita

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
    } else {
      currentUser = null; authScreen.style.display = 'flex'; appScreen.style.display = 'none';
    }
  }

  // --- CATEGORIAS E CONHECIMENTOS ---
  async function loadCategories() {
    const { data } = await supabase.from('categories').select('*').order('name');
    allCategories = data || [];
    const selectForm = document.getElementById('k-category');
    const selectFilter = document.getElementById('filter-category');
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
      const video = k.knowledge_videos && k.knowledge_videos.length > 0 ? k.knowledge_videos[0].url : null;
      
      return `
        <div class="card knowledge-item">
          <div>
            <span class="category-badge" style="background-color: ${catColor}">${catName}</span>
            <h3>${k.title}</h3>
            <p>${k.notes || 'Sem anotações...'}</p>
          </div>
          <div class="knowledge-actions">
            ${video ? `<a href="${video}" target="_blank" class="btn btn-outline" style="font-size: 0.8rem; padding: 0.5rem 1rem;">Vídeo</a>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  document.getElementById('search-input').addEventListener('input', renderLibrary);
  document.getElementById('filter-category').addEventListener('change', renderLibrary);

  // --- CRIAÇÃO DE CONHECIMENTO ---
  document.getElementById('toggle-new-category').addEventListener('click', (e) => {
    e.preventDefault(); const group = document.getElementById('new-category-group');
    group.style.display = group.style.display === 'none' ? 'block' : 'none';
  });

  document.getElementById('btn-create-category').addEventListener('click', async () => {
    const input = document.getElementById('k-new-category'); const name = input.value.trim();
    if (!name) return alert('Digite um nome.');
    const colors = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#ec4899'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const { data, error } = await supabase.from('categories').insert([{ user_id: currentUser.id, name, color: randomColor }]).select().single();
    if (error) return alert('Erro: ' + error.message);
    input.value = ''; document.getElementById('new-category-group').style.display = 'none';
    await loadCategories(); document.getElementById('k-category').value = data.id;
  });

  document.getElementById('knowledge-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-save-knowledge');
    btn.disabled = true; btn.textContent = 'Salvando...';
    const title = document.getElementById('k-title').value;
    const category_id = document.getElementById('k-category').value || null;
    const notes = document.getElementById('k-notes').value;
    const videoUrl = document.getElementById('k-video').value;

    try {
      const { data: kData, error: kError } = await supabase.from('knowledges').insert([{ user_id: currentUser.id, category_id, title, notes }]).select().single();
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

  // --- LÓGICA DE REVISÕES ---
  async function loadReviews() {
    const today = new Date().toISOString();
    // Busca revisões pendentes que já passaram da data
    const { data } = await supabase.from('reviews')
      .select('*, knowledges(title, notes, categories(name, color), knowledge_videos(url))')
      .eq('status', 'pending')
      .lte('scheduled_date', today)
      .order('scheduled_date', { ascending: true });
    
    renderReviews(data || []);
  }

  function renderReviews(reviews) {
    const list = document.getElementById('reviews-list');
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

  // Expõe a função de iniciar revisão globalmente para o botão do HTML funcionar
  window.startReview = (reviewId) => {
    // Como não temos a revisão em memória com todos os dados aqui, refazemos a consulta rápida
    supabase.from('reviews')
      .select('*, knowledges(title, notes, categories(name, color), knowledge_videos(url))')
      .eq('id', reviewId).single().then(({data}) => {
        if(!data) return;
        currentReview = data;
        
        // Preenche a tela de Revisão Ativa
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

        // Reseta os passos
        document.getElementById('review-step-1').style.display = 'block';
        document.getElementById('review-step-2').style.display = 'none';
        
        // Muda a tela
        window.location.hash = '#active-review';
      });
  };

  document.getElementById('btn-show-notes').addEventListener('click', () => {
    document.getElementById('review-step-1').style.display = 'none';
    document.getElementById('review-step-2').style.display = 'block';
  });

  document.getElementById('btn-complete-review').addEventListener('click', async () => {
    if (!currentReview) return;
    const btn = document.getElementById('btn-complete-review');
    btn.disabled = true; btn.textContent = 'Concluindo...';

    try {
      const now = new Date().toISOString();
      
      // 1. Atualiza a revisão atual para 'done'
      const { error: rError } = await supabase.from('reviews').update({ status: 'done', completed_at: now }).eq('id', currentReview.id);
      if (rError) throw rError;

      // 2. Adiciona ao histórico
      await supabase.from('review_history').insert([{ user_id: currentUser.id, review_id: currentReview.id, method_used: 'notes' }]);

      // 3. Recalcula a próxima revisão (Regra: a próxima data conta a partir da data REAL de conclusão)
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

      // 4. Dar XP (+15)
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
    const { data: profile } = await supabase.from('profiles').select('xp_total').eq('id', currentUser.id).single();

    document.getElementById('dash-knowledges').textContent = kCount || 0;
    document.getElementById('dash-reviews').textContent = rCount || 0;
    document.getElementById('dash-xp').textContent = profile ? profile.xp_total : 0;
  }
});