import { initRouter } from './router.js';
import { supabase } from './lib/supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Elementos de Autenticação
  const authScreen = document.getElementById('auth-screen');
  const appScreen = document.getElementById('app-screen');
  const authForm = document.getElementById('auth-form');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const nameInput = document.getElementById('name');
  const nameGroup = document.getElementById('name-group');
  const authTitle = document.getElementById('auth-title');
  const authSubtitle = document.getElementById('auth-subtitle');
  const authSubmit = document.getElementById('auth-submit');
  const toggleText = document.getElementById('toggle-text');
  const toggleLink = document.getElementById('toggle-auth');
  const logoutBtn = document.getElementById('logout-btn');
  const userNameDisplay = document.getElementById('user-name-display');

  // Elementos de Conhecimento
  const knowledgeForm = document.getElementById('knowledge-form');
  const selectCategory = document.getElementById('k-category');
  const toggleNewCategory = document.getElementById('toggle-new-category');
  const newCategoryGroup = document.getElementById('new-category-group');
  const newCategoryInput = document.getElementById('k-new-category');
  const btnCreateCategory = document.getElementById('btn-create-category');
  const btnSaveKnowledge = document.getElementById('btn-save-knowledge');

  let isLoginMode = true;
  let currentUser = null;

  // ---- LÓGICA DE AUTENTICAÇÃO ----
  function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    if (isLoginMode) {
      authTitle.textContent = 'Bem-vindo de volta';
      authSubtitle.textContent = 'Faça login para continuar estudando.';
      authSubmit.textContent = 'Entrar';
      toggleText.textContent = 'Ainda não tem conta?';
      toggleLink.textContent = 'Cadastre-se';
      nameGroup.style.display = 'none';
    } else {
      authTitle.textContent = 'Crie sua conta';
      authSubtitle.textContent = 'Comece a organizar seus estudos hoje.';
      authSubmit.textContent = 'Cadastrar';
      toggleText.textContent = 'Já tem uma conta?';
      toggleLink.textContent = 'Faça login';
      nameGroup.style.display = 'block';
    }
  }

  toggleLink.addEventListener('click', (e) => {
    e.preventDefault();
    toggleAuthMode();
  });

  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authSubmit.disabled = true;
    authSubmit.textContent = 'Carregando...';
    const email = emailInput.value;
    const password = passwordInput.value;

    try {
      if (isLoginMode) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const name = nameInput.value;
        const { error } = await supabase.auth.signUp({ 
          email, password, options: { data: { display_name: name } }
        });
        if (error) throw error;
        alert('Conta criada com sucesso!');
      }
      checkUserSession();
    } catch (error) {
      alert('Erro: ' + error.message);
    } finally {
      authSubmit.disabled = false;
      authSubmit.textContent = isLoginMode ? 'Entrar' : 'Cadastrar';
    }
  });

  logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    checkUserSession();
  });

  // ---- LÓGICA DO APP ----
  async function checkUserSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      currentUser = session.user;
      authScreen.style.display = 'none';
      appScreen.style.display = 'flex';
      
      const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', session.user.id).single();
      if (profile) userNameDisplay.textContent = profile.display_name;
      
      initRouter();
      loadCategories(); // Carrega as categorias ao logar

    } else {
      currentUser = null;
      authScreen.style.display = 'flex';
      appScreen.style.display = 'none';
    }
  }

  // ---- LÓGICA DE CATEGORIAS E CONHECIMENTOS ----
  async function loadCategories() {
    if (!currentUser) return;
    const { data, error } = await supabase.from('categories').select('*').order('name');
    if (error) return console.error(error);

    selectCategory.innerHTML = '<option value="">Selecione uma categoria...</option>';
    data.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.id;
      opt.textContent = cat.name;
      selectCategory.appendChild(opt);
    });
  }

  toggleNewCategory.addEventListener('click', (e) => {
    e.preventDefault();
    newCategoryGroup.style.display = newCategoryGroup.style.display === 'none' ? 'block' : 'none';
  });

  btnCreateCategory.addEventListener('click', async () => {
    const name = newCategoryInput.value.trim();
    if (!name) return alert('Digite o nome da categoria.');
    
    btnCreateCategory.disabled = true;
    const { data, error } = await supabase.from('categories').insert([{ user_id: currentUser.id, name }]).select().single();
    
    if (error) {
      alert('Erro ao criar categoria: ' + error.message);
    } else {
      newCategoryInput.value = '';
      newCategoryGroup.style.display = 'none';
      await loadCategories();
      selectCategory.value = data.id; // Seleciona a categoria recém-criada
    }
    btnCreateCategory.disabled = false;
  });

  knowledgeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    btnSaveKnowledge.disabled = true;
    btnSaveKnowledge.textContent = 'Salvando...';

    const category_id = selectCategory.value || null;
    const title = document.getElementById('k-title').value;
    const notes = document.getElementById('k-notes').value;
    const videoUrl = document.getElementById('k-video').value;

    try {
      // 1. Salva o conhecimento
      const { data: kData, error: kError } = await supabase.from('knowledges').insert([{ 
        user_id: currentUser.id, category_id, title, notes 
      }]).select().single();

      if (kError) throw kError;

      // 2. Salva o vídeo (se tiver sido preenchido)
      if (videoUrl) {
        const { error: vError } = await supabase.from('knowledge_videos').insert([{ 
          knowledge_id: kData.id, url: videoUrl 
        }]);
        if (vError) throw vError;
      }

      alert('Conhecimento cadastrado com sucesso! Suas revisões já foram programadas.');
      knowledgeForm.reset();
      window.location.hash = '#library'; // Redireciona para a biblioteca

    } catch (error) {
      alert('Erro ao salvar: ' + error.message);
    } finally {
      btnSaveKnowledge.disabled = false;
      btnSaveKnowledge.textContent = 'Salvar Conhecimento';
    }
  });

  // Inicialização
  checkUserSession();
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') checkUserSession();
  });
});