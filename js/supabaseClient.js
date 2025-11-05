const SUPABASE_CONFIG_KEY = 'planning.supabaseConfig';
const CURRENT_USER_KEY = 'planning.currentUser';
const DEFAULT_SUPABASE_URL = 'https://yexnvarduablpgddxwzd.supabase.co';
const DEFAULT_SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlleG52YXJkdWFibHBnZGR4d3pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMjM0ODksImV4cCI6MjA3NDc5OTQ4OX0.auEQsFBWC0ADDYtKstakP2y-BxYWN8FvAEV8F8wk-3s';

let supabaseModulePromise = null;
let supabaseClient = null;
let supabaseReadyPromise = null;
let isModalInitialized = false;
let currentModal = null;
let currentForm = null;
let modalPreviouslyFocused = null;

const ROLE_ALIASES = new Map([
  ['administrateur', ['administrateur', 'admin', 'administrator', 'gestionnaire']],
  ['medecin', ['medecin', 'médecin', 'doctor', 'docteur']],
  ['remplacant', ['remplacant', 'remplaçant', 'replacement', 'remplacement']]
]);

const toPlainString = (value) => (typeof value === 'string' ? value : String(value ?? ''));

const sanitizeString = (value) => toPlainString(value).trim();

const readStoredConfig = () => {
  try {
    const raw = window.localStorage.getItem(SUPABASE_CONFIG_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    const url = sanitizeString(parsed.url);
    const key = sanitizeString(parsed.key);
    if (!url || !key) {
      return null;
    }
    return { url, key };
  } catch (error) {
    console.error('Impossible de lire la configuration Supabase', error);
    return null;
  }
};

const storeConfig = (config) => {
  if (!config) {
    window.localStorage.removeItem(SUPABASE_CONFIG_KEY);
    return;
  }
  try {
    window.localStorage.setItem(
      SUPABASE_CONFIG_KEY,
      JSON.stringify({ url: sanitizeString(config.url), key: sanitizeString(config.key) })
    );
  } catch (error) {
    console.error("Impossible d'enregistrer la configuration Supabase", error);
  }
};

const clearSupabaseClient = () => {
  supabaseClient = null;
  supabaseReadyPromise = null;
};

const ensureSupabaseModule = async () => {
  if (!supabaseModulePromise) {
    supabaseModulePromise = import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  }
  return supabaseModulePromise;
};

const createSupabaseClient = async (url, key) => {
  const sanitizedUrl = sanitizeString(url);
  const sanitizedKey = sanitizeString(key);
  if (!sanitizedUrl || !sanitizedKey) {
    return null;
  }
  try {
    const { createClient } = await ensureSupabaseModule();
    return createClient(sanitizedUrl, sanitizedKey, {
      auth: {
        persistSession: false
      }
    });
  } catch (error) {
    console.error('Impossible de créer le client Supabase', error);
    return null;
  }
};

const connectSupabase = (url, key) => {
  if (!url || !key) {
    clearSupabaseClient();
    return Promise.resolve(null);
  }
  supabaseReadyPromise = (async () => {
    supabaseClient = await createSupabaseClient(url, key);
    return supabaseClient;
  })();
  return supabaseReadyPromise;
};

const initializeSupabase = () => {
  if (supabaseReadyPromise) {
    return supabaseReadyPromise;
  }
  const stored = readStoredConfig();
  if (stored) {
    return connectSupabase(stored.url, stored.key);
  }
  return Promise.resolve(null);
};

const hideModal = () => {
  if (!currentModal) {
    return;
  }
  currentModal.classList.add('hidden');
  currentModal.setAttribute('aria-hidden', 'true');
  currentModal.removeAttribute('aria-modal');
  document.body.classList.remove('modal-open');
  if (modalPreviouslyFocused instanceof HTMLElement) {
    modalPreviouslyFocused.focus({ preventScroll: true });
  }
  modalPreviouslyFocused = null;
};

const showModal = () => {
  if (!currentModal) {
    return;
  }
  modalPreviouslyFocused = document.activeElement;
  currentModal.classList.remove('hidden');
  currentModal.removeAttribute('aria-hidden');
  currentModal.setAttribute('aria-modal', 'true');
  document.body.classList.add('modal-open');
  const firstField = currentModal.querySelector('input, button, select, textarea');
  if (firstField instanceof HTMLElement) {
    firstField.focus({ preventScroll: true });
  }
};

const handleEscape = (event) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    hideModal();
  }
};

const fillFormDefaults = (config = null) => {
  if (!currentForm) {
    return;
  }
  const urlInput = currentForm.querySelector('#supabaseUrl');
  const keyInput = currentForm.querySelector('#supabaseKey');
  if (urlInput instanceof HTMLInputElement) {
    urlInput.value = config?.url ?? DEFAULT_SUPABASE_URL;
  }
  if (keyInput instanceof HTMLInputElement) {
    keyInput.value = config?.key ?? DEFAULT_SUPABASE_KEY;
  }
};

const attachFormHandler = () => {
  if (!currentForm || currentForm.dataset.ready === 'true') {
    return;
  }
  currentForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(currentForm);
    const url = sanitizeString(formData.get('supabaseUrl'));
    const key = sanitizeString(formData.get('supabaseKey'));
    if (!url || !key) {
      alert('Veuillez renseigner une URL et une clé API Supabase valides.');
      return;
    }
    storeConfig({ url, key });
    await connectSupabase(url, key);
    hideModal();
  });
  currentForm.dataset.ready = 'true';
};

const prepareDisconnectButton = () => {
  const disconnectBtn = document.querySelector('#disconnect');
  if (disconnectBtn instanceof HTMLButtonElement && disconnectBtn.dataset.ready !== 'true') {
    disconnectBtn.addEventListener('click', () => {
      disconnectSupabase();
      showModal();
    });
    disconnectBtn.dataset.ready = 'true';
  }
};

export const initializeConnectionModal = () => {
  if (isModalInitialized) {
    prepareDisconnectButton();
    return;
  }
  currentModal = document.querySelector('#connection-modal');
  currentForm = document.querySelector('#connection-form');
  if (!currentModal || !currentForm) {
    console.warn('Aucun composant de connexion Supabase détecté.');
    return;
  }

  fillFormDefaults(readStoredConfig() ?? { url: DEFAULT_SUPABASE_URL, key: DEFAULT_SUPABASE_KEY });
  attachFormHandler();
  prepareDisconnectButton();

  currentModal.addEventListener('click', (event) => {
    if (event.target === currentModal) {
      hideModal();
    }
  });
  document.addEventListener('keydown', handleEscape);

  initializeSupabase().then((client) => {
    if (!client) {
      showModal();
    }
  });

  isModalInitialized = true;
};

export const openConnectionModal = () => {
  initializeConnectionModal();
  showModal();
};

export const disconnectSupabase = () => {
  storeConfig(null);
  clearSupabaseClient();
};

export const onSupabaseReady = async () => {
  await initializeSupabase();
  return supabaseReadyPromise ?? null;
};

export const getSupabaseClient = () => supabaseClient;

const normalize = (value) =>
  sanitizeString(value)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

export const normalizeRole = (role) => {
  const cleaned = normalize(role ?? '');
  for (const [canonical, aliases] of ROLE_ALIASES.entries()) {
    if (aliases.some((alias) => normalize(alias) === cleaned)) {
      return canonical;
    }
  }
  return cleaned || null;
};

export const getCurrentUser = () => {
  try {
    const raw = window.localStorage.getItem(CURRENT_USER_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    if (parsed.role) {
      parsed.normalizedRole = normalizeRole(parsed.role);
    }
    return parsed;
  } catch (error) {
    console.error("Impossible de lire l'utilisateur courant", error);
    return null;
  }
};

export const setCurrentUser = (user) => {
  if (!user) {
    window.localStorage.removeItem(CURRENT_USER_KEY);
    return null;
  }
  const payload = {
    ...user,
    normalizedRole: normalizeRole(user.role)
  };
  try {
    window.localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(payload));
  } catch (error) {
    console.error("Impossible d'enregistrer l'utilisateur courant", error);
  }
  return payload;
};

export const requireRole = (expectedRole, { redirectTo = 'index.html' } = {}) => {
  const expected = normalizeRole(expectedRole);
  const current = getCurrentUser();
  if (!current) {
    window.location.replace(redirectTo);
    return false;
  }
  const normalizedCurrent = normalizeRole(current.role ?? current.normalizedRole ?? '');
  if (!expected || normalizedCurrent === expected) {
    return true;
  }
  window.location.replace(redirectTo);
  return false;
};

export const getStoredSupabaseConfig = () => readStoredConfig();

export const updateSupabaseConfig = async ({ url, key }) => {
  const sanitizedUrl = sanitizeString(url);
  const sanitizedKey = sanitizeString(key);
  if (!sanitizedUrl || !sanitizedKey) {
    throw new Error('URL ou clé API Supabase invalide');
  }
  storeConfig({ url: sanitizedUrl, key: sanitizedKey });
  await connectSupabase(sanitizedUrl, sanitizedKey);
};

// Initialisation optimiste pour GitHub Pages : si aucune configuration n'est enregistrée,
// on enregistre automatiquement les paramètres fournis par défaut.
(() => {
  const stored = readStoredConfig();
  if (!stored) {
    storeConfig({ url: DEFAULT_SUPABASE_URL, key: DEFAULT_SUPABASE_KEY });
  }
  initializeSupabase();
})();
