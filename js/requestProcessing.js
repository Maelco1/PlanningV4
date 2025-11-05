import {
  getSupabaseClient,
  initializeConnectionModal,
  onSupabaseReady,
  openConnectionModal,
  requireRole,
  setCurrentUser
} from './supabaseClient.js';

initializeConnectionModal();
requireRole('administrateur');

const tableBody = document.querySelector('#requests-body');
const feedback = document.querySelector('#request-feedback');
const connectionButton = document.querySelector('#disconnect');
const logoutButton = document.querySelector('#logout');
const backToAdmin = document.querySelector('#back-to-admin');
const userTypeTabs = document.querySelectorAll('[data-user-type-tab]');
const statusTabsContainer = document.querySelector('#request-tabs');
const filtersForm = document.querySelector('#request-filters');

const STATUS_VALUES = [
  { value: '', label: 'Tous' },
  { value: 'en attente', label: 'En attente' },
  { value: 'validé', label: 'Acceptées' },
  { value: 'refusé', label: 'Refusées' }
];

let allRequests = [];
let activeUserType = '';
let activeStatus = '';

if (connectionButton && connectionButton.dataset.modalReady !== 'true') {
  connectionButton.addEventListener('click', () => {
    openConnectionModal();
  });
  connectionButton.dataset.modalReady = 'true';
}

if (logoutButton && logoutButton.dataset.ready !== 'true') {
  logoutButton.addEventListener('click', () => {
    setCurrentUser(null);
    window.location.replace('index.html');
  });
  logoutButton.dataset.ready = 'true';
}

if (backToAdmin && backToAdmin.dataset.ready !== 'true') {
  backToAdmin.addEventListener('click', () => {
    window.location.replace('admin.html');
  });
  backToAdmin.dataset.ready = 'true';
}

const setFeedback = (message) => {
  if (feedback) {
    feedback.textContent = message ?? '';
  }
};

const formatDateTime = (value) => {
  if (!value) {
    return '—';
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleString('fr-FR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatDate = (value) => {
  if (!value) {
    return '—';
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

const createActionButton = (label, status, choiceId) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'table-action';
  button.textContent = label;
  button.addEventListener('click', async () => {
    try {
      await updateChoiceStatus(choiceId, status);
      await loadRequests();
    } catch (error) {
      console.error(error);
      setFeedback("Impossible de mettre à jour le statut.");
    }
  });
  return button;
};

const renderRequests = (requests) => {
  if (!tableBody) {
    return;
  }
  tableBody.innerHTML = '';
  if (!requests.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 10;
    cell.textContent = 'Aucune demande à traiter.';
    row.appendChild(cell);
    tableBody.appendChild(row);
    return;
  }

  requests.forEach((request) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${formatDate(request.day)}</td>
      <td>${request.column_label ?? '—'}</td>
      <td>${request.column_number ?? '—'}</td>
      <td>${request.slot_type_code ?? '—'}</td>
      <td>${request.planning_day_label ?? '—'}</td>
      <td>${request.trigram ?? '—'} (${request.user_type ?? '—'})</td>
      <td>${request.choice_order != null ? request.choice_order + 1 : '—'}</td>
      <td>${request.guard_nature ?? '—'}</td>
      <td>${request.etat ?? 'en attente'}</td>
      <td>${formatDateTime(request.created_at)}</td>
      <td class="table-actions"></td>
    `;
    const actionsCell = row.querySelector('.table-actions');
    if (actionsCell) {
      actionsCell.appendChild(createActionButton('Valider', 'validé', request.id));
      actionsCell.appendChild(createActionButton('Refuser', 'refusé', request.id));
      actionsCell.appendChild(createActionButton('Réinitialiser', 'en attente', request.id));
    }
    tableBody.appendChild(row);
  });
};

const updateUserTypeTabs = () => {
  userTypeTabs.forEach((tab) => {
    const value = tab.dataset.userTypeTab ?? '';
    tab.setAttribute('aria-selected', value === activeUserType ? 'true' : 'false');
    tab.classList.toggle('is-active', value === activeUserType);
  });
};

const updateStatusTabs = () => {
  if (!statusTabsContainer) {
    return;
  }
  statusTabsContainer.querySelectorAll('[data-status-value]').forEach((button) => {
    const value = button.dataset.statusValue ?? '';
    button.setAttribute('aria-selected', value === activeStatus ? 'true' : 'false');
    button.classList.toggle('is-active', value === activeStatus);
  });
};

const buildStatusTabs = () => {
  if (!statusTabsContainer || statusTabsContainer.dataset.ready === 'true') {
    return;
  }
  statusTabsContainer.innerHTML = '';
  STATUS_VALUES.forEach(({ value, label }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'request-tab';
    button.dataset.statusValue = value;
    button.textContent = label;
    button.setAttribute('aria-selected', value === activeStatus ? 'true' : 'false');
    button.addEventListener('click', () => {
      activeStatus = value;
      updateStatusTabs();
      if (filtersForm) {
        const statusSelect = filtersForm.querySelector('#filter-status');
        if (statusSelect) {
          statusSelect.value = value;
        }
      }
      refreshView(true);
    });
    statusTabsContainer.appendChild(button);
  });
  statusTabsContainer.dataset.ready = 'true';
};

const getFilterValue = (selector) => filtersForm?.querySelector(selector)?.value?.trim() ?? '';

const applyFilters = () => {
  const dateFilter = getFilterValue('#filter-date');
  const typeFilter = getFilterValue('#filter-type');
  const doctorFilter = getFilterValue('#filter-doctor').toLowerCase();
  const columnFilter = getFilterValue('#filter-column').toLowerCase();
  const statusFilter = getFilterValue('#filter-status');

  return allRequests.filter((request) => {
    if (activeUserType && request.user_type !== activeUserType) {
      return false;
    }
    const statusToMatch = activeStatus || statusFilter;
    if (statusToMatch && request.etat !== statusToMatch) {
      return false;
    }
    if (dateFilter) {
      const iso = request.day ? new Date(request.day).toISOString().slice(0, 10) : '';
      if (iso !== dateFilter) {
        return false;
      }
    }
    if (typeFilter && request.activity_type !== typeFilter) {
      return false;
    }
    if (doctorFilter) {
      const trigram = (request.trigram ?? '').toLowerCase();
      if (!trigram.includes(doctorFilter)) {
        return false;
      }
    }
    if (columnFilter) {
      const label = (request.column_label ?? '').toLowerCase();
      const code = (request.slot_type_code ?? '').toLowerCase();
      if (!label.includes(columnFilter) && !code.includes(columnFilter)) {
        return false;
      }
    }
    return true;
  });
};

const refreshView = (announceTotal = false) => {
  const filtered = applyFilters();
  renderRequests(filtered);
  if (announceTotal) {
    setFeedback(filtered.length ? `${filtered.length} demande(s) affichée(s).` : 'Aucune demande à afficher.');
  }
};

const bindFilterEvents = () => {
  userTypeTabs.forEach((tab) => {
    if (tab.dataset.ready === 'true') {
      return;
    }
    tab.addEventListener('click', () => {
      const value = tab.dataset.userTypeTab ?? '';
      activeUserType = activeUserType === value ? '' : value;
      updateUserTypeTabs();
      refreshView(true);
    });
    tab.dataset.ready = 'true';
  });

  if (filtersForm && filtersForm.dataset.ready !== 'true') {
    filtersForm.addEventListener('input', () => refreshView(true));
    filtersForm.addEventListener('change', () => refreshView(true));
    filtersForm.addEventListener('reset', () => {
      activeStatus = '';
      updateStatusTabs();
      refreshView(true);
    });
    filtersForm.dataset.ready = 'true';
  }
};

const updateChoiceStatus = async (id, status) => {
  await onSupabaseReady();
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Client Supabase indisponible');
  }
  const { error } = await supabase.from('planning_choices').update({ etat: status }).eq('id', id);
  if (error) {
    throw error;
  }
};

const loadRequests = async () => {
  setFeedback('Chargement des demandes…');
  await onSupabaseReady();
  const supabase = getSupabaseClient();
  if (!supabase) {
    setFeedback('Veuillez configurer la connexion à Supabase.');
    return;
  }
  const { data, error } = await supabase
    .from('planning_choices')
    .select(
      'id, trigram, user_type, column_number, column_label, guard_nature, etat, created_at, choice_order, day, slot_type_code, planning_day_label, activity_type'
    )
    .order('created_at', { ascending: false });
  if (error) {
    console.error(error);
    setFeedback("Impossible de récupérer les demandes.");
    return;
  }
  allRequests = Array.isArray(data) ? data : [];
  updateUserTypeTabs();
  buildStatusTabs();
  updateStatusTabs();
  bindFilterEvents();
  refreshView(true);
};

loadRequests();
