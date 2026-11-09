import { initRouter } from './router.js';
import { supabase } from './lib/supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Inicia o roteador
  initRouter();

  // Testa a conexão com o banco
  try {
    const { data, error } = await supabase.from('achievements').select('count');
    if (error) throw error;
    console.log('✅ Conectado ao Supabase com sucesso!');
  } catch (err) {
    console.error('❌ Erro ao conectar no Supabase:', err.message);
  }
});