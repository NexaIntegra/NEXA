(() => {
  const get = selector => document.querySelector(selector);

  const showFallback = () => {
    const dialog = get('#quizDialog');
    const reader = get('#readerDialog');

    try {
      if (reader && reader.open) reader.close();
      if (dialog && !dialog.open && typeof dialog.showModal === 'function') dialog.showModal();
    } catch (error) {
      console.error('[NEXA Quiz] Falha ao abrir o dialog:', error);
      return;
    }

    const body = get('#quizBody');
    const footer = get('#quizFooter');
    if (body) body.innerHTML = '<div class="quiz-empty"><div>!</div><h3>Quiz temporariamente indisponível</h3><p>O módulo do quiz não carregou corretamente. Recarregue a página para tentar novamente.</p></div>';
    if (footer) footer.innerHTML = '<button type="button" class="outline-button" id="quizCloseBottom">Fechar</button>';
  };

  const handleClick = event => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const button = target.closest('#aiQuizButton');
    if (!button) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    if (typeof window.nexaQuizOpen === 'function') {
      window.nexaQuizOpen();
    } else {
      showFallback();
    }
  };

  document.addEventListener('click', handleClick, true);
})();