import {
  getCurrentUser,
  getSupabaseClient,
  initializeConnectionModal,
  onSupabaseReady,
  openConnectionModal
} from './supabaseClient.js';

const STEP_ORDER = ['1', '2', '3'];

const GUARD_LABEL = {
  normale: 'Gardes normales',
  bonne: 'Bonnes gardes'
};

const formatDate = (value) => {
  if (!value) {
    return 'Date inconnue';
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

const createEmptyState = (nature) => {
  const container = document.createElement('div');
  container.className = 'planning-empty-state';
  container.innerHTML = `
    <p>
      Aucune garde ${nature === 'bonne' ? 'en bonne garde' : 'normale'} n'est enregistrée pour le moment.
      Utilisez le bouton “Enregistrer” pour rafraîchir les données après vos saisies dans Supabase.
    </p>
  `;
  return container;
};

const renderBoard = (choices) => {
  const board = document.querySelector('#planning-tables');
  if (!board) {
    return;
  }
  board.innerHTML = '';
  if (!Array.isArray(choices) || choices.length === 0) {
    board.appendChild(createEmptyState('normale'));
    return;
  }
  const list = document.createElement('ul');
  list.className = 'planning-choice-list';
  choices.forEach((choice) => {
    const item = document.createElement('li');
    item.className = 'planning-choice-item';
    item.innerHTML = `
      <strong>${formatDate(choice.day)} — Colonne ${choice.column_number}</strong>
      <span>${choice.column_label ?? 'Créneau'}</span>
      <span>Qualité : ${choice.guard_nature === 'bonne' ? 'Bonne garde' : 'Garde normale'}</span>
      <span>État : ${choice.etat ?? 'en attente'}</span>
    `;
    list.appendChild(item);
  });
  board.appendChild(list);
};

const renderSummary = (choices) => {
  const summaries = document.querySelectorAll('.summary-list');
  summaries.forEach((list) => {
    const nature = list.dataset.summaryNature;
    const relevant = Array.isArray(choices)
      ? choices.filter((choice) => choice.guard_nature === nature)
      : [];
    list.innerHTML = '';
    if (!relevant.length) {
      const empty = document.createElement('li');
      empty.className = 'summary-empty-row';
      empty.textContent = "Aucun créneau enregistré.";
      list.appendChild(empty);
      return;
    }
    relevant.forEach((choice, index) => {
      const item = document.createElement('li');
      item.className = 'summary-item';
      item.innerHTML = `
        <span class="summary-rank">#${index + 1}</span>
        <span class="summary-slot">${formatDate(choice.day)} – ${choice.column_label ?? 'Créneau'} (Col. ${choice.column_number})</span>
        <span class="summary-status">${choice.etat ?? 'en attente'}</span>
      `;
      list.appendChild(item);
    });
  });
};

const setFeedback = (selector, message) => {
  const target = document.querySelector(selector);
  if (target) {
    target.textContent = message ?? '';
  }
};

const groupChoices = (choices) => {
  const byNature = new Map();
  choices.forEach((choice) => {
    const nature = choice.guard_nature === 'bonne' ? 'bonne' : 'normale';
    if (!byNature.has(nature)) {
      byNature.set(nature, []);
    }
    byNature.get(nature).push(choice);
  });
  return byNature;
};

const renderStepHosts = (choices) => {
  const grouped = groupChoices(choices);
  STEP_ORDER.slice(0, 2).forEach((stepKey, index) => {
    const nature = index === 0 ? 'normale' : 'bonne';
    const host = document.querySelector(`.planning-host[data-step-host="${stepKey}"]`);
    if (!host) {
      return;
    }
    host.innerHTML = '';
    const container = document.createElement('div');
    container.className = 'planning-step-placeholder';
    const relevant = grouped.get(nature) ?? [];
    container.innerHTML = `
      <h3>${GUARD_LABEL[nature]}</h3>
      <p>
        ${
          relevant.length
            ? 'Vos gardes enregistrées sont listées ci-dessous. Les modifications doivent être réalisées depuis Supabase ou par un administrateur.'
            : "Aucune garde n'est enregistrée pour cette catégorie."
        }
      </p>
    `;
    if (relevant.length) {
      const list = document.createElement('ul');
      list.className = 'planning-choice-list';
      relevant.forEach((choice) => {
        const item = document.createElement('li');
        item.className = 'planning-choice-item';
        item.innerHTML = `
          <strong>${formatDate(choice.day)}</strong>
          <span>${choice.column_label ?? 'Créneau'} (Col. ${choice.column_number})</span>
          <span>Priorité #${choice.choice_order + 1}</span>
          <span>État : ${choice.etat ?? 'en attente'}</span>
        `;
        list.appendChild(item);
      });
      container.appendChild(list);
    }
    host.appendChild(container);
  });
};

const setupStepper = () => {
  const steps = document.querySelectorAll('.stepper-step');
  const panes = document.querySelectorAll('[data-step-pane]');
  const activate = (targetStep) => {
    steps.forEach((step) => {
      const match = step.dataset.step === targetStep;
      step.classList.toggle('is-active', match);
    });
    panes.forEach((pane) => {
      const match = pane.dataset.stepPane === targetStep;
      pane.classList.toggle('is-active', match);
    });
  };
  steps.forEach((step) => {
    if (step.dataset.ready === 'true') {
      return;
    }
    step.addEventListener('click', () => {
      activate(step.dataset.step);
    });
    step.dataset.ready = 'true';
  });
  document.querySelectorAll('.step-nav').forEach((nav) => {
    if (nav.dataset.ready === 'true') {
      return;
    }
    nav.addEventListener('click', () => {
      const action = nav.dataset.action;
      const current = document.querySelector('.stepper-step.is-active');
      const currentIndex = STEP_ORDER.indexOf(current?.dataset.step ?? '1');
      if (action === 'next') {
        activate(STEP_ORDER[Math.min(currentIndex + 1, STEP_ORDER.length - 1)]);
      } else if (action === 'previous') {
        activate(STEP_ORDER[Math.max(currentIndex - 1, 0)]);
      }
    });
    nav.dataset.ready = 'true';
  });
};

const fetchChoices = async (supabase, user, userRole) => {
  const { data, error } = await supabase
    .from('planning_choices')
    .select(
      'id, day, column_number, column_label, guard_nature, planning_day_label, etat, choice_order, created_at, planning_reference'
    )
    .eq('trigram', user.trigram)
    .eq('user_type', userRole)
    .order('choice_order', { ascending: true });
  if (error) {
    throw error;
  }
  return Array.isArray(data) ? data : [];
};

export const initializePlanningChoices = ({ userRole }) => {
  initializeConnectionModal();
  setupStepper();

  const disconnectBtn = document.querySelector('#disconnect');
  if (disconnectBtn && disconnectBtn.dataset.modalReady !== 'true') {
    disconnectBtn.addEventListener('click', () => {
      openConnectionModal();
    });
    disconnectBtn.dataset.modalReady = 'true';
  }

  const saveBtn = document.querySelector('#save-choices');
  if (saveBtn) {
    saveBtn.textContent = 'Rafraîchir';
  }

  const loadAndRender = async () => {
    setFeedback('#planning-feedback', 'Chargement des données…');
    setFeedback('#summary-feedback', '');
    setFeedback('#save-feedback', '');

    await onSupabaseReady();
    const supabase = getSupabaseClient();
    const user = getCurrentUser();
    if (!supabase) {
      setFeedback('#planning-feedback', 'Veuillez configurer la connexion à Supabase.');
      return;
    }
    if (!user) {
      setFeedback('#planning-feedback', 'Utilisateur non authentifié.');
      return;
    }

    try {
      const choices = await fetchChoices(supabase, user, userRole);
      if (!choices.length) {
        setFeedback('#planning-feedback', 'Aucun choix enregistré pour le moment.');
      } else {
        setFeedback('#planning-feedback', `${choices.length} choix récupérés.`);
      }
      renderBoard(choices);
      renderSummary(choices);
      renderStepHosts(choices);
    } catch (error) {
      console.error(error);
      setFeedback('#planning-feedback', "Impossible de récupérer les données depuis Supabase.");
    }
  };

  if (saveBtn && saveBtn.dataset.ready !== 'true') {
    saveBtn.addEventListener('click', (event) => {
      event.preventDefault();
      setFeedback('#save-feedback', 'Actualisation en cours…');
      loadAndRender().finally(() => {
        setFeedback('#save-feedback', '');
      });
    });
    saveBtn.dataset.ready = 'true';
  }

  loadAndRender();
};
