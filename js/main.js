import { initRouter } from './router.js';
import { supabase } from './lib/supabase.js';

// Variáveis Globais
let currentUser = null;
let isLoginMode = true;
let allCategories = [];
let allKnowledges = [];

document.addEventListener('DOMContentLoaded', async () => {
  // --- ELEMENTOS DA TELA ---
  const authScreen = document.getElementById('auth-screen');
  const appScreen = document.getElementById('app-screen');
  const authForm = document.getElementById('auth-form');
  const userNameDisplay = document.getElementById('user-name-display');
  
  // --- INICIALIZAÇÃO ---
  checkUserSession();

  // --- LÓGICA DE AUTENTICAÇÃO ---
  const toggleAuth = document.getElementById('toggle-auth');
  toggleAuth.addEventListener('click', (e) => {
    e.preventDefault();
    isLoginMode = !isLoginMode;
    document.getElementById('auth-title').textContent = isLoginMode ? 'Bem-vindo de volta' : 'Crie sua conta';
    document.getElementById('auth-submit').textContent = isLoginMode ? 'Entrar' : 'Cadastrar';
    document.getElementById('name-group').style.display = isLoginMode ? 'none' : 'block';
    document.getElementById('toggle-text').textContent = isLoginMode ? 'Ainda não tem conta?' : 'Já tem uma conta?';
    toggleAuth.textContent = isLoginMode ? 'Cadastre-se' : 'Faça login';
  });

  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('auth-submit');
    btn.disabled = true;
    btn.textContent = 'Carregando...';

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
    } catch (error) {
      alert('Erro: ' + error.message);
    } finally {
      btn.disabled = false;
      btn.textContent = isLoginMode ? 'Entrar' : 'Cadastrar';
    }
  });

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await supabase.auth.signOut();
    checkUserSession();
  });

  async function checkUserSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      currentUser = session.user;
      authScreen.style.display = 'none';
      appScreen.style.display = 'flex';
      
      const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', currentUser.id).single();
      if (profile) userNameDisplay.textContent = profile.display_name;
      
      initRouter();
      await loadCategories();
      await loadKnowledges();
      updateDashboard();
    } else {
      currentUser = null;
      authScreen.style.display = 'flex';
      appScreen.style.display = 'none';
    }
  }

  // --- LÓGICA DE CATEGORIAS E CONHECIMENTOS ---
  async function loadCategories() {
    const { data } = await supabase.from('categories').select('*').order('name');
    allCategories = data || [];
    
    // Preenche o select do formulário
    const selectForm = document.getElementById('k-category');
    selectForm.innerHTML = '<option value="">Selecione...</option>';
    // Preenche o filtro da biblioteca
    const selectFilter = document.getElementById('filter-category');
    selectFilter.innerHTML = '<option value="">Todas as categorias</option>';

    allCategories.forEach(cat => {
      selectForm.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
      selectFilter.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
    });
  }

  async function loadKnowledges() {
    const { data } = await supabase.from('knowledges')
      .select('*, categories(name, color), knowledge_videos(url)')
      .order('created_at', { ascending: false });
    allKnowledges = data || [];
    renderLibrary();
  }

  function renderLibrary() {
    const list = document.getElementById('knowledge-list');
    const search = document.getElementById('search-input').value.toLowerCase();
    const filter = document.getElementById('filter-category').value;

    const filtered = allKnowledges.filter(k => {
      const matchSearch = k.title.toLowerCase().includes(search) || k.notes.toLowerCase().includes(search);
      const matchFilter = filter === '' || k.category_id === filter;
      return matchSearch && matchFilter;
    });

    if (filtered.length === 0) {
      list.innerHTML = '<p class="text-muted" style="grid-column: 1/-1; text-align: center; padding: 2rem;">Nenhum conhecimento encontrado.</p>';
      return;
    }

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
            <button onclick="alert('Em breve: editar conhecimento')" class="btn btn-outline" style="font-size: 0.8rem; padding: 0.5rem 1rem; margin-left: auto;">Editar</button>
          </div>
        </div>
      `;
    }).join('');
  }

  // Eventos de busca e filtro
  document.getElementById('search-input').addEventListener('input', renderLibrary);
  document.getElementById('filter-category').addEventListener('change', renderLibrary);

  // --- LÓGICA DO FORMULÁRIO DE NOVO CONHECIMENTO ---
  document.getElementById('toggle-new-category').addEventListener('click', (e) => {
    e.preventDefault();
    const group = document.getElementById('new-category-group');
    group.style.display = group.style.display === 'none' ? 'block' : 'none';
  });

  document.getElementById('btn-create-category').addEventListener('click', async () => {
    const input = document.getElementById('k-new-category');
    const name = input.value.trim();
    if (!name) return alert('Digite um nome para a categoria.');

    const colors = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#ec4899'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const { data, error } = await supabase.from('categories').insert([{ user_id: currentUser.id, name, color: randomColor }]).select().single();
    if (error) return alert('Erro ao criar categoria: ' + error.message);

    input.value = '';
    document.getElementById('new-category-group').style.display = 'none';
    await loadCategories();
    document.getElementById('k-category').value = data.id;
  });

  document.getElementById('knowledge-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-save-knowledge');
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    const title = document.getElementById('k-title').value;
    const category_id = document.getElementById('k-category').value || null;
    const notes = document.getElementById('k-notes').value;
    const videoUrl = document.getElementById('k-video').value;

    try {
      // 1. Salvar conhecimento
      const { data: kData, error: kError } = await supabase.from('knowledges').insert([{ user_id: currentUser.id, category_id, title, notes }]).select().single();
      if (kError) throw kError;

      // 2. Salvar vídeo se existir
      if (videoUrl) {
        const { error: vError } = await supabase.from('knowledge_videos').insert([{ knowledge_id: kData.id, url: videoUrl }]);
        if (vError) throw vError;
      }

      // 3. Dar XP
      await supabase.rpc('grant_xp', { p_user_id: currentUser.id, p_source_type: 'knowledge_created', p_source_id: kData.id, p_xp: 10 });
      await supabase.rpc('check_achievements', { p_user_id: currentUser.id });

      alert('Conhecimento salvo com sucesso! As revisões foram programadas.');
      document.getElementById('knowledge-form').reset();
      
      await loadKnowledges();
      updateDashboard();
      window.location.hash = '#library';

    } catch (error) {
      alert('Erro ao salvar: ' + error.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Salvar Conhecimento';
    }
  });

  // --- ATUALIZAR DASHBOARD ---
  async function updateDashboard() {
    if (!currentUser) return;
    
    const { count: kCount } = await supabase.from('knowledges').select('*', { count: 'exact', head: true });
    const { count: rCount } = await supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('status', 'pending').lte('scheduled_date', new Date().toISOString());
    const { data: profile } = await supabase.from('profiles').select('xp_total').eq('id', currentUser.id).single();

    document.getElementById('dash-knowledges').textContent = kCount || 0;
    document.getElementById('dash-reviews').textContent = rCount || 0;
    document.getElementById('dash-xp').textContent = profile ? profile.xp_total : 0;
  }
});