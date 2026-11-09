import { initRouter } from './router.js';
import { supabase } from './lib/supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Elementos da tela
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

  let isLoginMode = true;

  // Função para trocar entre Login e Cadastro
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

  // Lógica de Entrar / Cadastrar
  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authSubmit.disabled = true;
    authSubmit.textContent = 'Carregando...';

    const email = emailInput.value;
    const password = passwordInput.value;

    try {
      if (isLoginMode) {
        // Fazer Login
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        // Fazer Cadastro
        const name = nameInput.value;
        const { error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: { data: { display_name: name } }
        });
        if (error) throw error;
        alert('Conta criada com sucesso! Você já está logado.');
      }
      
      // Atualiza a tela
      checkUserSession();
      
    } catch (error) {
      alert('Erro: ' + error.message);
    } finally {
      authSubmit.disabled = false;
      authSubmit.textContent = isLoginMode ? 'Entrar' : 'Cadastrar';
    }
  });

  // Logout
  logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    checkUserSession();
  });

  // Verifica se o usuário já está logado
  async function checkUserSession() {
    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
      // Usuário logado
      authScreen.style.display = 'none';
      appScreen.style.display = 'flex';
      
      // Pega o nome do usuário no banco
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', session.user.id)
        .single();

      if (profile) userNameDisplay.textContent = profile.display_name;
      
      // Inicia o roteador das telas internas
      initRouter();

    } else {
      // Usuário deslogado
      authScreen.style.display = 'flex';
      appScreen.style.display = 'none';
    }
  }

  // Executa na carga da página
  checkUserSession();

  // Ouve mudanças de autenticação (login, logout, token expirado)
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
      checkUserSession();
    }
  });
});