export function initRouter() {
  const routes = ['dashboard', 'library', 'new-knowledge', 'reviews', 'stats', 'achievements'];
  
  const renderRoute = () => {
    // Pega a hash atual da URL (ex: #dashboard)
    let hash = window.location.hash.replace('#', '') || 'dashboard';
    
    // Remove 'active' de todos os links
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
      if(link.getAttribute('href') === `#${hash}`) link.classList.add('active');
    });

    // Esconde todas as páginas
    document.querySelectorAll('.page').forEach(page => page.style.display = 'none');
    
    // Mostra a página atual
    const currentPage = document.getElementById(`page-${hash}`);
    if (currentPage) {
      currentPage.style.display = 'block';
    } else {
      document.getElementById('page-dashboard').style.display = 'block'; // fallback
    }
  };

  window.addEventListener('hashchange', renderRoute);
  renderRoute(); // Roda na primeira carga
}
